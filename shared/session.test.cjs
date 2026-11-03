const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function loadSource(relative, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    module: mod, exports: mod.exports,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    URL, URLSearchParams, crypto: globalThis.crypto, ...globals
  }, { filename: relative });
  return mod.exports;
}

const code = "A".repeat(32);
const contracts = loadSource("mobile/src/shared/contracts.ts");
const realtimeSession = loadSource("shared/realtime-session.ts", { "./contracts": contracts });

// Run the real hook source with deterministic hook state, relay responses and timers.
function makeSession({ stored = null, failConnect = false } = {}) {
  let cursor = 0, dirty = false, result, timerId = 0, now = 100000, storedCode = stored;
  const slots = [], effects = [], timers = new Map();
  function target(extra = {}) {
    const listeners = new Map();
    return Object.assign(extra, {
      addEventListener(event, handler) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(handler); },
      removeEventListener(event, handler) { listeners.get(event)?.delete(handler); },
      emit(event) { for (const handler of [...(listeners.get(event) ?? [])]) handler(); }
    });
  }
  const browser = target({
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: now + ms, interval: true }); return id; },
    clearInterval(id) { timers.delete(id); }
  });
  const document = target({ visibilityState: "visible" });
  const navigator = { onLine: true };
  const relay = {
    configured: true, connects: 0, disconnects: 0, failConnect, failPublish: false, handler: null, published: [],
    async connect() {
      this.connects++;
      if (this.failConnect) throw new Error("network failed");
    },
    async disconnect() { this.disconnects++; },
    async publish(event) { this.published.push(event); if (this.failPublish) throw new Error("publish failed"); },
    onEvent(handler) { this.handler = handler; },
    onStateChange(handler) { this.stateHandler = handler; },
    onPeerLeft(handler) { this.peerLeftHandler = handler; }
  };
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(init) {
      const i = cursor++;
      slots[i] ??= { value: typeof init === "function" ? init() : init };
      return [slots[i].value, value => {
        const next = typeof value === "function" ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      }];
    },
    useRef(init) { const i = cursor++; return slots[i] ??= { current: init }; },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: factory(), deps };
      return slots[i].value;
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps };
        effects.push(() => { cleanup?.(); slots[i].cleanup = callback(); });
      }
    }
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const { useScannerSession } = loadSource("mobile/src/hooks/useScannerSession.ts", {
    react,
    "../lib/feedback": { prepareScannerSound() {}, scannerSuccessSound() {}, vibrate() {} },
    "../lib/realtime": { createRealtimeClient: () => relay },
    "../../../shared/realtime-session": realtimeSession,
    "../lib/scanner": loadSource("mobile/src/lib/scanner.ts", { "../shared/contracts": contracts }),
    "../lib/session": {
      getSessionFromLocation: () => null, getStoredPairingCode: () => stored,
      getOrCreateStoredClientId: () => "phone-A", getPairingCodeFromScan: () => null,
      storePairingCode(code) { storedCode = code; }, clearStoredPairingCode() { storedCode = null; }, clearSessionFromLocation() {}
    },
    "../shared/contracts": contracts
  }, {
    window: browser, document, navigator,
    Date: class extends Date { static now() { return now; } }
  });
  function render() {
    cursor = 0; dirty = false; result = useScannerSession();
    while (effects.length) effects.shift()();
  }
  async function flush() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); if (dirty) render(); }
  }
  render();
  async function advance(ms) {
    const end = now + ms;
    for (let count = 0; count < 1000; count++) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; now = timer.at;
      if (timer.interval) timer.at += timer.ms; else timers.delete(id);
      timer.fn(); await flush();
    }
    now = end; await flush();
  }
  return { relay, timers, flush, advance, browser, document, navigator, get storedCode() { return storedCode; }, get result() { return result; } };
}

test("same pairing code can be retried after a network failure", async () => {
  const session = makeSession({ failConnect: true });
  session.result.connectWithCode(code);
  await session.flush();
  assert.equal(session.result.status, "Terputus");
  session.relay.failConnect = false;
  session.result.connectWithCode(code);
  await session.flush();
  assert.equal(session.relay.connects, 2);
  assert.equal(session.result.status, "Terhubung ke relay");
});

test("failed saved pairing schedules and executes automatic retry", async () => {
  const session = makeSession({ stored: code, failConnect: true });
  await session.flush();
  const retry = [...session.timers.entries()].find(([, timer]) => timer.ms === 5000);
  assert.ok(retry, "automatic retry was scheduled");
  session.timers.delete(retry[0]);
  session.relay.failConnect = false;
  retry[1].fn();
  await session.flush();
  assert.equal(session.relay.connects, 2);
});

test("only a status addressed to this phone confirms pairing without reconnecting", async () => {
  const session = makeSession();
  session.result.connectWithCode(code);
  await session.flush();
  const status = {
    type: "desktop_status", sessionId: code, status: "connected",
    deviceCount: 1, timestamp: new Date().toISOString()
  };
  for (const clientId of [undefined, "phone-B"]) {
    session.relay.handler({ ...status, clientId });
    await session.flush();
    assert.equal(session.result.screen, "home");
  }
  session.relay.handler({ ...status, clientId: "phone-A" });
  await session.flush();
  assert.equal(session.result.screen, "scanner");
  assert.equal(session.relay.connects, 1);
  assert.equal([...session.timers.values()].some(timer => !timer.interval && timer.ms === 10000), false);
});

test("disconnect cancels a scheduled automatic retry", async () => {
  const session = makeSession({ stored: code, failConnect: true });
  await session.flush();
  await session.result.disconnect();
  await session.flush();
  assert.equal(session.result.sessionId, "");
  assert.equal(session.timers.size, 0);
});

test("blocked localStorage access uses a fallback client ID", () => {
  const window = Object.defineProperty({}, "localStorage", {
    get() { throw new Error("SecurityError: storage blocked"); }
  });
  const session = loadSource("mobile/src/lib/session.ts", { "../shared/contracts": contracts }, { window });
  assert.ok(session.getOrCreateStoredClientId());
});

async function pairedSession() {
  const session = makeSession();
  session.result.connectWithCode(code);
  await session.flush();
  session.relay.handler({ type: "desktop_status", sessionId: code, status: "connected",
    clientId: "phone-A", deviceCount: 1, timestamp: new Date().toISOString() });
  await session.flush();
  assert.equal(session.result.screen, "scanner");
  return session;
}

test("desktop presence leaving stops the scanner and keeps pairing for reconnect", async () => {
  const session = await pairedSession();
  session.relay.peerLeftHandler(); await session.flush();
  assert.equal(session.result.screen, "home");
  assert.equal(session.result.status, "Desktop offline");
  assert.equal(session.storedCode, code);
  await session.advance(5000);
  assert.equal(session.relay.connects, 2);
});

test("a frozen desktop is detected by the heartbeat deadline", async () => {
  const session = await pairedSession();
  await session.advance(realtimeSession.PEER_TIMEOUT_MS);
  assert.equal(session.result.status, "Desktop offline");
  assert.equal(session.result.screen, "home");
  assert.equal(session.storedCode, code);
});

test("relay closure after pairing immediately clears the connected UI", async () => {
  const session = await pairedSession();
  session.relay.stateHandler("disconnected"); await session.flush();
  assert.equal(session.result.status, "Koneksi terputus");
  assert.equal(session.result.screen, "home");
  assert.equal(session.storedCode, code);
});

test("backgrounding releases the socket without forgetting pairing and resumes when visible", async () => {
  const session = await pairedSession();
  const previous = session.relay.disconnects;
  session.document.visibilityState = "hidden";
  session.document.emit("visibilitychange"); await session.flush();
  assert.equal(session.relay.disconnects, previous + 1);
  assert.equal(session.result.screen, "home");
  assert.equal(session.storedCode, code);
  await session.advance(20000);
  assert.equal(session.relay.connects, 1, "no reconnect loop while backgrounded");
  session.document.visibilityState = "visible";
  session.document.emit("visibilitychange"); await session.flush();
  assert.equal(session.relay.connects, 2);
});

test("offline and online events suspend and immediately retry saved pairing", async () => {
  const session = await pairedSession();
  session.navigator.onLine = false;
  session.browser.emit("offline"); await session.flush();
  assert.equal(session.result.status, "Internet terputus");
  await session.advance(10000);
  assert.equal(session.relay.connects, 1);
  session.navigator.onLine = true;
  session.browser.emit("online"); await session.flush();
  assert.equal(session.relay.connects, 2);
});

test("peer loss settles pending scans immediately instead of showing false success", async () => {
  const session = await pairedSession();
  const result = session.result.submitScan("899123");
  await session.flush();
  session.relay.peerLeftHandler(); await session.flush();
  assert.equal(await result, false);
  assert.equal(session.result.screen, "home");
});

test("desktop typing failure keeps the healthy connection available", async () => {
  const session = await pairedSession();
  const pending = session.result.submitScan("899123");
  await session.flush();
  const scan = session.relay.published.find(event => event.type === "scan");
  session.relay.handler({ type: "scan_ack", sessionId: code, scanId: scan.scanId,
    barcode: scan.barcode, success: false, message: "Keyboard busy", timestamp: new Date().toISOString() });
  await session.flush();
  assert.equal(await pending, false);
  assert.equal(session.result.screen, "scanner");
  assert.equal(session.result.status, "Desktop siap");
  assert.equal(session.result.lastAck, "Keyboard busy");
  assert.equal(session.result.scanOutcome.state, "error");
  assert.equal(session.result.toastTone, "error");
});

test("unpaired scans never enter the relay", async () => {
  const session = makeSession();
  assert.equal(await session.result.submitScan("899123"), false);
  assert.equal(session.relay.published.length, 0);
});

test("reset during a pending scan keeps the reset status and does not reconnect", async () => {
  const session = await pairedSession();
  const pending = session.result.submitScan("899123"); await session.flush();
  await session.result.disconnect(); await session.flush();
  assert.equal(await pending, false);
  assert.equal(session.result.status, "Siap pairing");
  assert.equal(session.storedCode, null);
  assert.equal(session.result.scanOutcome, null);
  await session.advance(20000);
  assert.equal(session.relay.connects, 1);
});

test("scan result is pending until the desktop confirms successful typing", async () => {
  const session = await pairedSession();
  const pending = session.result.submitScan("899123"); await session.flush();
  assert.equal(session.result.scanOutcome.state, "pending");
  const scan = session.relay.published.find(event => event.type === "scan");
  session.relay.handler({ type: "scan_ack", sessionId: code, scanId: scan.scanId,
    barcode: "899123", success: true, timestamp: new Date().toISOString() });
  assert.equal(await pending, true); await session.flush();
  assert.equal(session.result.scanOutcome.state, "success");
  assert.equal(session.result.toastTone, "success");
});

test("unconfirmed scan is shown as uncertain rather than successful", async () => {
  const session = await pairedSession();
  const pending = session.result.submitScan("899123"); await session.flush();
  session.relay.peerLeftHandler(); await session.flush();
  assert.equal(await pending, false); await session.flush();
  assert.equal(session.result.scanOutcome.state, "error");
  assert.match(session.result.scanOutcome.message, /Periksa kolom tujuan/);
});

test("oversized barcode is rejected locally without losing the desktop connection", async () => {
  const session = await pairedSession();
  assert.equal(await session.result.submitScan("X".repeat(257)), false); await session.flush();
  assert.equal(session.relay.published.some(event => event.type === "scan"), false);
  assert.match(session.result.lastAck, /256 karakter/);
  assert.equal(session.result.toastTone, "error");
  assert.equal(session.result.screen, "scanner");
});

test("barcode limit counts Unicode characters the same way as the desktop", () => {
  const { isValidScanValue } = loadSource("mobile/src/lib/scanner.ts", { "../shared/contracts": contracts });
  assert.equal(isValidScanValue("😀".repeat(256)), true);
  assert.equal(isValidScanValue("😀".repeat(257)), false);
  assert.equal(isValidScanValue("  "), false);
});
