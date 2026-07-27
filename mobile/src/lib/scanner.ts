import type { ScanEvent } from "../../../shared/contracts";
import { normalizeBarcode } from "../../../shared/contracts";

export interface ScanResult {
  barcode: string;
  symbology?: string;
}

export function createScanEvent(sessionId: string, result: ScanResult): ScanEvent {
  return {
    type: "scan",
    sessionId,
    barcode: normalizeBarcode(result.barcode),
    symbology: result.symbology,
    timestamp: new Date().toISOString(),
    source: "mobile"
  };
}

export function isValidScanValue(value: string): boolean {
  return normalizeBarcode(value).length > 0;
}

export function nextScanAllowedAt(previousAt: number, cooldownMs: number): number {
  return previousAt + cooldownMs;
}
