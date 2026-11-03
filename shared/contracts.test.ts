import {
  buildConnectUrl,
  buildSessionChannel,
  isRealtimeEvent,
  isScanEvent,
  normalizeBarcode
} from "../mobile/src/shared/contracts.ts";

function expectEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

expectEqual(
  buildSessionChannel("A1234567890BCDEF1234567890ABCDEF"),
  "scanbridge:session:A1234567890BCDEF1234567890ABCDEF",
  "buildSessionChannel"
);

expectEqual(
  buildConnectUrl("A1234567890BCDEF1234567890ABCDEF"),
  "https://scanbridge-mobile.vercel.app/connect?session=A1234567890BCDEF1234567890ABCDEF",
  "buildConnectUrl"
);

expectEqual(normalizeBarcode("  JP123  "), "JP123", "normalizeBarcode");
expectEqual(
  isRealtimeEvent({
    type: "client_heartbeat",
    sessionId: "A1234567890BCDEF1234567890ABCDEF",
    clientId: "client-1",
    timestamp: new Date().toISOString(),
    source: "mobile"
  }),
  true,
  "isRealtimeEvent"
);

for (const sessionId of [123, true, {}, [], null, undefined]) {
  const event = {
    type: "scan", sessionId, scanId: "scan-1", clientId: "client-1",
    barcode: "899123", source: "mobile", timestamp: new Date().toISOString()
  };
  expectEqual(isRealtimeEvent(event), false, "reject malformed realtime sessionId");
  expectEqual(isScanEvent(event), false, "reject malformed scan sessionId");
}

expectEqual(isRealtimeEvent({
  type: "desktop_status", sessionId: "A".repeat(32), status: "connected",
  deviceCount: 1, clientId: 123, timestamp: new Date().toISOString()
}), false, "reject malformed desktop clientId");
