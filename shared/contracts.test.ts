import { buildConnectUrl, buildSessionChannel, normalizeBarcode } from "./contracts";

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
  "https://scanbridge.app/connect?session=123",
  "buildConnectUrl"
);

expectEqual(normalizeBarcode("  JP123  "), "JP123", "normalizeBarcode");
