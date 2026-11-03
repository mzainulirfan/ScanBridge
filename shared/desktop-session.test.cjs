const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const code = "A".repeat(32);

async function desktop({ failSubscribe = false, history = [], historyLimit = 100, failUpdate = false } = {}) {
  let now = 100000, connected = false, trusted = null, visible = true, resets = 0, reloads = 0;
  const elements = new Map(), nativeEvents = new Map(), browserEvents = new Map(), attempts = [];
  const relay = { failSubscribe };
  let settings = { autoEnter: true, autoTab: false, historyEnabled: true, historyLimit, prefix: "", suffix: "" };
  const status = () => ({ status: connected ? "connected" : "waiting_pairing", clientId: connected ? trusted : undefined });
  const pairing = { sessionId: code, pairingUrl: "https://example.com/connect?session=" + code, hasTrustedClient: false };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: "", dataset: {}, value: "", checked: false, hidden: id === "#update-banner",
      addEventListener() {}, classList: { toggle() {} }, setAttribute() {}, close() {}, showModal() {} });
    return elements.get(id);
  }
  async function invoke(command, args) {
    switch (command) {
      case "get_pairing_info": return pairing;
      case "get_status": return status();
      case "get_settings": return settings;
      case "update_settings": settings = { ...args.settings, prefix: args.settings.prefix.slice(0, 64) }; return settings;
      case "get_history": return history;
      case "clear_history": history = []; return;
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
    "@tauri-apps/api/app": { async getVersion() { return "0.1.5"; } },
    "@tauri-apps/api/event": { async listen(name, handler) { nativeEvents.set(name, handler); return () => nativeEvents.delete(name); } },
    "@tauri-apps/plugin-process": { async relaunch() {} },
    "@tauri-apps/plugin-updater": { async check() { if (failUpdate) throw Error("Updater unavailable"); return null; } },
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
    "\nmodule.exports = { disconnectSession, renderHistoryList, renderOutputPreview, saveSettings, clearHistory };";
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
    search(value) { element("#history-search").value = value; module.exports.renderHistoryList(); },
    preview: () => module.exports.renderOutputPreview(),
    save: () => module.exports.saveSettings(),
    clear: () => module.exports.clearHistory(),
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

const sampleHistory = [
  { barcode: "899123", symbology: "EAN_13", typed: true, receivedAt: "2026-11-03T10:00:00Z" },
  { barcode: "SKU-00428", symbology: "CODE_128", typed: false, message: "Keyboard busy", receivedAt: "2026-11-03T09:59:00Z" },
  { barcode: '<img src=x onerror="alert(1)">', symbology: "QR_CODE", typed: true, receivedAt: "2026-11-03T09:58:00Z" }
];

test("dashboard restores the last saved scan and counts actual local history", async () => {
  const app = await desktop({ history: sampleHistory, historyLimit: 10 });
  assert.equal(app.element("#last-scan").textContent, "899123");
  assert.equal(app.element("#last-scan-result").textContent, "Berhasil diketik");
  assert.equal(app.element("#scan-total").textContent, "3");
  assert.equal(app.element("#scan-success").textContent, "2");
  assert.equal(app.element("#scan-failed").textContent, "1");
  assert.match(app.element("#activity-count").textContent, /maksimal 10 terbaru/);
  assert.equal(app.element("#app-version").textContent, "v0.1.5");
});

test("history searches formats and error text while escaping barcode markup", async () => {
  const app = await desktop({ history: sampleHistory });
  assert.ok(app.element("#activity-list").innerHTML.includes("&lt;img"));
  assert.ok(!app.element("#activity-list").innerHTML.includes("<img"));
  app.search("keyboard BUSY");
  assert.ok(app.element("#activity-list").innerHTML.includes("SKU-00428"));
  assert.ok(!app.element("#activity-list").innerHTML.includes("899123"));
  app.search("ean_13");
  assert.ok(app.element("#activity-list").innerHTML.includes("899123"));
  app.search("does not exist");
  assert.match(app.element("#activity-list").innerHTML, /Tidak ada hasil yang cocok/);
});

test("unsaved output edits remain separate from the applied output summary", async () => {
  const app = await desktop();
  app.element("#prefix").value = "SKU-";
  app.element("#auto-enter").checked = false;
  app.element("#auto-tab").checked = true;
  app.preview();
  assert.equal(app.element("#preview-prefix").textContent, "SKU-");
  assert.equal(app.element("#settings-state").textContent, "Belum disimpan");
  assert.equal(app.element("#output-mode").textContent, "Barcode + Enter");
  await app.save();
  assert.equal(app.element("#settings-state").textContent, "Tersimpan");
  assert.equal(app.element("#output-mode").textContent, "Barcode + Tab");
});

test("deleting history also clears its dashboard values", async () => {
  const app = await desktop({ history: sampleHistory });
  await app.clear();
  assert.equal(app.element("#last-scan").textContent, "—");
  assert.equal(app.element("#scan-total").textContent, "0");
  assert.equal(app.element("#last-scan-result").textContent, "Belum ada scan");
});

test("unavailable update service does not advertise an installable update", async () => {
  const app = await desktop({ failUpdate: true });
  assert.equal(app.element("#update-banner").hidden, true);
  assert.equal(app.element("#update-status").textContent, "Pembaruan belum dapat diperiksa");
  assert.equal(app.element("#connection-title").textContent, "Hubungkan ponsel Anda");
  await app.attempts[0].joined("phone-A");
  assert.equal(app.element("#connection-title").textContent, "Siap menerima barcode");
  await app.attempts[0].unavailable("phone-A");
  assert.equal(app.element("#connection-title").textContent, "Menunggu ponsel kembali");
});
