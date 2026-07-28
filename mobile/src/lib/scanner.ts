import type { ScanEvent } from "../shared/contracts";
import { normalizeBarcode } from "../shared/contracts";

export interface ScanResult {
  barcode: string;
  symbology?: string;
}

export function createScanEvent(sessionId: string, result: ScanResult): ScanEvent {
  return {
    type: "scan",
    scanId: createScanId(),
    sessionId,
    barcode: normalizeBarcode(result.barcode),
    symbology: result.symbology,
    timestamp: new Date().toISOString(),
    source: "mobile"
  };
}

function createScanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isValidScanValue(value: string): boolean {
  return normalizeBarcode(value).length > 0;
}

export function nextScanAllowedAt(previousAt: number, cooldownMs: number): number {
  return previousAt + cooldownMs;
}
