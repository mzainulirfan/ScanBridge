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

// Run the real hook source with deterministic hook state, relay responses and timers.
function makeSession({ stored = null, failConnect = false } = {}) {
  let cursor = 0, dirty = false, result, timerId = 0;
  const slots = [], effects = [], timers = new Map();
  const relay = {
    configured: true, connects: 0, failConnect, handler: null,
    async connect() {
      this.connects++;
      if (this.failConnect) throw new Error("network failed");
    },
    async disconnect() {}, async publish() {},
    onEvent(handler) { this.handler = handler; }
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
    "../lib/scanner": loadSource("mobile/src/lib/scanner.ts", { "../shared/contracts": contracts }),
    "../lib/session": {
      getSessionFromLocation: () => null, getStoredPairingCode: () => stored,
      getOrCreateStoredClientId: () => "phone-A", getPairingCodeFromScan: () => null,
      storePairingCode() {}, clearStoredPairingCode() {}, clearSessionFromLocation() {}
    },
    "../shared/contracts": contracts
  }, {
    window: {
      setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
      clearTimeout(id) { timers.delete(id); },
      setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, interval: true }); return id; },
      clearInterval(id) { timers.delete(id); }
    },
    document: { addEventListener() {}, removeEventListener() {} }
  });
  function render() {
    cursor = 0; dirty = false; result = useScannerSession();
    while (effects.length) effects.shift()();
  }
  async function flush() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); if (dirty) render(); }
  }
  render();
  return { relay, timers, flush, get result() { return result; } };
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
