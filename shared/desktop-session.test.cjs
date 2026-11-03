const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const code = "A".repeat(32);

async function desktop({ failSubscribe = false } = {}) {
  let now = 100000, connected = false, trusted = null, visible = true, resets = 0, reloads = 0;
  const elements = new Map(), nativeEvents = new Map(), browserEvents = new Map(), attempts = [];
  const relay = { failSubscribe };
  const status = () => ({ status: connected ? "connected" : "waiting_pairing", clientId: connected ? trusted : undefined });
  const pairing = { sessionId: code, pairingUrl: "https://example.com/connect?session=" + code, hasTrustedClient: false };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: "", dataset: {}, value: "", checked: false,
      addEventListener() {}, classList: { toggle() {} }, setAttribute() {}, close() {}, showModal() {} });
    return elements.get(id);
  }
  async function invoke(command, args) {
    switch (command) {
      case "get_pairing_info": return pairing;
      case "get_status": return status();
      case "get_settings": return { autoEnter: true, autoTab: false, historyEnabled: true, historyLimit: 100, prefix: "", suffix: "" };
      case "get_history": return [];
      case "mark_connected":
        if (trusted && trusted !== args.clientId) throw Error("Unknown phone");
        trusted = args.clientId; connected = true; return status();
      case "mark_disconnected": connected = false; return status();
      case "show_main_window": visible = true; return;
      case "hide_main_window": visible = false; return;
      case "reset_pairing_code": resets++; connected = false; trusted = null; return pairing;
      case "receive_scan": throw Error("Unexpected keyboard invocation");
      default: throw Error(command);
    }
  }
  const imports = {
    "@tauri-apps/api/core": { invoke },
    "@tauri-apps/api/event": { async listen(name, handler) { nativeEvents.set(name, handler); return () => nativeEvents.delete(name); } },
    "@tauri-apps/plugin-process": { async relaunch() {} },
    "@tauri-apps/plugin-updater": { async check() { return null; } },
    qrcode: { async toDataURL() { return "data:image/png;base64,test"; } },
    "./styles.css": {},
    "../../shared/realtime-session": { HEARTBEAT_INTERVAL_MS: 4000, PEER_TIMEOUT_MS: 12000 },
    "./lib/realtime": {
      createSupabaseDesktopClient: () => ({}),
      async subscribeDesktopSession(_, sessionId, scan, joined, left, heartbeat, subscribed, unavailable, state) {
        const attempt = { sessionId, scan, joined, left, heartbeat, unavailable, state, sent: [], disposed: false,
          async publish(event) { this.sent.push(event); if (this.failPublish) throw Error("network failed"); },
          async disconnect() { this.disposed = true; } };
        attempts.push(attempt);
        if (relay.failSubscribe) throw Error("network failed");
        state("connected"); await subscribed(); return attempt;
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "../desktop/src/main.ts"), "utf8") +
    "\nmodule.exports = { disconnectSession };";
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports,
    require(name) { if (!(name in imports)) throw Error(name); return imports[name]; },
    document: { querySelector: element, querySelectorAll: () => [] },
    window: { setInterval() {}, addEventListener(name, handler) { browserEvents.set(name, handler); }, location: { reload() { reloads++; } } },
    navigator: { onLine: true }, Date: class extends Date { static now() { return now; } }, Intl
  });
  async function flush() { for (let i = 0; i < 60; i++) await Promise.resolve(); }
  await flush();
  return { attempts, relay, element, flush,
    async tick(ms) { now += ms; nativeEvents.get("connection-tick")(); await flush(); },
    reset: () => module.exports.disconnectSession(),
    get connected() { return connected; }, get trusted() { return trusted; }, get visible() { return visible; },
    get resets() { return resets; }, get reloads() { return reloads; }
  };
}

test("desktop shows a disconnect notice and restores its hidden window when mobile presence leaves", async () => {
  const app = await desktop();
  await app.attempts[0].joined("phone-A");
  assert.equal(app.visible, false);
  await app.attempts[0].unavailable("phone-A");
  assert.equal(app.connected, false);
  assert.equal(app.visible, true);
  assert.equal(app.trusted, "phone-A");
  assert.equal(app.resets, 0);
  assert.equal(app.element("#mobile-status").textContent, "terputus");
  assert.match(app.element("#summary-message").textContent, /Mobile terputus/);
});

test("native ticks detect a silent phone without relying on WebView JavaScript timers", async () => {
  const app = await desktop();
  await app.attempts[0].joined("phone-A");
  await app.tick(12000);
  assert.equal(app.connected, false);
  assert.equal(app.visible, true);
  assert.equal(app.resets, 0);
  await app.attempts[0].heartbeat("phone-A");
  assert.equal(app.connected, true);
  assert.equal(app.element("#mobile-status").textContent, "terhubung");
});

test("heartbeat from another phone cannot keep the paired phone online", async () => {
  const app = await desktop();
  await app.attempts[0].joined("phone-A");
  await app.tick(8000);
  await app.attempts[0].heartbeat("phone-B");
  await app.tick(4000);
  assert.equal(app.connected, false);
});

test("desktop relay loss clears connected status and retries with a single replacement channel", async () => {
  const app = await desktop();
  await app.attempts[0].joined("phone-A");
  app.attempts[0].state("disconnected"); await app.flush();
  assert.equal(app.connected, false);
  assert.equal(app.visible, true);
  await app.tick(4000);
  assert.equal(app.attempts.length, 2);
  assert.equal(app.attempts[0].disposed, true);
  assert.equal(app.attempts[1].sessionId, code);
  await app.attempts[1].joined("phone-A");
  assert.equal(app.connected, true);
});

test("failed initial desktop connection retries without restarting the app", async () => {
  const app = await desktop({ failSubscribe: true });
  assert.equal(app.attempts.length, 1);
  app.relay.failSubscribe = false;
  await app.tick(4000);
  assert.equal(app.attempts.length, 2);
  assert.equal(app.element("#relay-status").textContent, "aktif");
});

test("native ticks keep sending desktop heartbeat while the window is in the tray", async () => {
  const app = await desktop();
  await app.attempts[0].joined("phone-A");
  const before = app.attempts[0].sent.length;
  await app.tick(4000);
  assert.ok(app.attempts[0].sent.length > before);
  assert.equal(app.visible, false);
});

test("reset pairing still completes if the final broadcast cannot be sent", async () => {
  const app = await desktop();
  app.attempts[0].failPublish = true;
  await app.reset();
  assert.equal(app.resets, 1);
  assert.equal(app.reloads, 1);
  assert.equal(app.attempts[0].disposed, true);
});
