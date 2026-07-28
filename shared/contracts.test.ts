import { buildConnectUrl, buildSessionChannel, isRealtimeEvent, normalizeBarcode } from "./contracts.ts";

function expectEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

expectEqual(
  buildSessionChannel("123"),
  "scanbridge:session:123",
  "buildSessionChannel"
);

expectEqual(
  buildConnectUrl("123"),
  "https://scanbridge-mobile.vercel.app/connect?session=123",
  "buildConnectUrl"
);

expectEqual(normalizeBarcode("  JP123  "), "JP123", "normalizeBarcode");
expectEqual(
  isRealtimeEvent({
    type: "client_heartbeat",
    sessionId: "ABC123",
    clientId: "client-1",
    timestamp: new Date().toISOString(),
    source: "mobile"
  }),
  true,
  "isRealtimeEvent"
);
