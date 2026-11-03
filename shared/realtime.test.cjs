const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");

function source(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports,
    require(name) { if (!(name in imports)) throw Error(name); return imports[name]; },
    window: { setTimeout, clearTimeout }, URL, Date, crypto: globalThis.crypto
  });
  return module.exports;
}
const contracts = source("mobile/src/shared/contracts.ts", {});
const { SessionConnection } = source("shared/realtime-session.ts", { "./contracts": contracts });
const code = "A".repeat(32);

function backend() {
  const channels = [];
  const auth = {
    checks: 0, signIns: 0, session: null,
    async getSession() { this.checks++; return { data: { session: this.session }, error: null }; },
    async signInAnonymously() { this.signIns++; this.session = {}; return { error: null }; }
  };
  const api = { auth,
    channel(name, options) {
      const handlers = [];
      const channel = { name, options, handlers, presence: {}, sent: [], removed: false,
        on(type, filter, callback) { handlers.push({ type, filter, callback }); return this; },
        subscribe(callback) { this.status = callback; queueMicrotask(() => callback("SUBSCRIBED")); return this; },
        async track() { return "ok"; },
        presenceState() { return this.presence; },
        async send(event) { this.sent.push(event); return "ok"; },
        sync(presence) { this.presence = presence; handlers.find(h => h.type === "presence").callback(); },
        event(event) { handlers.find(h => h.type === "broadcast").callback({ payload: event }); }
      };
      channels.push(channel); return channel;
    },
    async removeChannel(channel) { channel.removed = true; channel.status("CLOSED"); return "ok"; }
  };
  return { api, channels };
}

test("transport reports errors occurring after the subscription promise already resolved", async () => {
  const { api, channels } = backend();
  const connection = new SessionConnection(api, "mobile"); const states = [];
  connection.onStateChange(state => states.push(state));
  await connection.connect(code, "phone-A");
  channels[0].status("CLOSED");
  assert.deepEqual(states, ["connecting", "connected", "disconnected"]);
  await assert.rejects(connection.publish(contracts.createClientHeartbeatEvent(code, "phone-A")), /tidak terhubung/);
  await connection.disconnect();
});

test("presence loss waits until all connections belonging to a peer have left", async () => {
  const { api, channels } = backend();
  const connection = new SessionConnection(api, "desktop"); const left = [];
  connection.onPeerLeft(id => left.push(id));
  await connection.connect(code);
  const peer = { role: "mobile", sessionId: code, clientId: "phone-A" };
  channels[0].sync({ phone: [peer, peer] });
  channels[0].sync({ phone: [peer] });
  assert.equal(left.length, 0);
  channels[0].sync({});
  assert.deepEqual(left, ["phone-A"]);
  await connection.disconnect();
});

test("mobile receives desktop departure even without a goodbye broadcast", async () => {
  const { api, channels } = backend();
  const connection = new SessionConnection(api, "mobile"); let departures = 0;
  connection.onPeerLeft(() => departures++);
  await connection.connect(code, "phone-A");
  channels[0].sync({ desktop: [{ role: "desktop", sessionId: code }] });
  channels[0].sync({});
  assert.equal(departures, 1);
  await connection.disconnect();
});

test("old channel callbacks cannot disconnect a replacement channel", async () => {
  const { api, channels } = backend();
  const connection = new SessionConnection(api, "mobile"); const states = [];
  connection.onStateChange(state => states.push(state));
  await connection.connect(code, "phone-A");
  await connection.connect("B".repeat(32), "phone-A");
  channels[0].status("CHANNEL_ERROR");
  assert.equal(states.at(-1), "connected");
  assert.equal(states.filter(state => state === "disconnected").length, 0);
  assert.ok(channels[0].removed);
  await connection.publish(contracts.createClientHeartbeatEvent("B".repeat(32), "phone-A"));
  await connection.disconnect();
});

test("disconnect during authentication prevents a ghost subscription", async () => {
  const { api, channels } = backend();
  let resolveAuth;
  api.auth.getSession = () => new Promise(resolve => { resolveAuth = resolve; });
  const connection = new SessionConnection(api, "mobile");
  const cancelled = assert.rejects(connection.connect(code, "phone-A"), /cancelled/);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await connection.disconnect();
  resolveAuth({ data: { session: {} }, error: null });
  await cancelled;
  assert.equal(channels.length, 0);
});

test("overlapping connects keep only the newest session", async () => {
  const { api, channels } = backend();
  const connection = new SessionConnection(api, "mobile");
  const old = assert.rejects(connection.connect(code, "phone-A"), /cancelled/);
  await connection.connect("B".repeat(32), "phone-A");
  await old;
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, "scanbridge:session:" + "B".repeat(32));
  await connection.disconnect();
});

test("reconnect checks authentication again instead of caching a fulfilled login forever", async () => {
  const { api } = backend(); const connection = new SessionConnection(api, "desktop");
  await connection.connect(code);
  api.auth.session = null;
  await connection.connect(code);
  assert.equal(api.auth.checks, 2);
  assert.equal(api.auth.signIns, 2);
  await connection.disconnect();
});

test("only valid events belonging to the active session are delivered", async () => {
  const { api, channels } = backend(); const connection = new SessionConnection(api, "desktop");
  const received = []; connection.onEvent(event => received.push(event));
  await connection.connect(code);
  channels[0].event({ type: "scan" });
  channels[0].event(contracts.createClientHeartbeatEvent("B".repeat(32), "phone-A"));
  channels[0].event(contracts.createClientHeartbeatEvent(code, "phone-A"));
  assert.equal(received.length, 1);
  await connection.disconnect();
});

test("broadcast failures notify the UI and require reconnection", async () => {
  const { api, channels } = backend(); const connection = new SessionConnection(api, "mobile");
  const states = []; connection.onStateChange(state => states.push(state));
  await connection.connect(code, "phone-A");
  channels[0].send = async () => "timed out";
  await assert.rejects(connection.publish(contracts.createClientHeartbeatEvent(code, "phone-A")), /broadcast failed/);
  assert.equal(states.at(-1), "disconnected");
  await connection.disconnect();
});
