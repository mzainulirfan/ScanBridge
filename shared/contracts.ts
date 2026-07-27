export type RealtimeEventType =
  | "client_joined"
  | "scan"
  | "scan_ack"
  | "desktop_status";

export type DesktopStatus = "idle" | "waiting_pairing" | "connected" | "reconnecting";
export type ScanSource = "mobile";

export interface BaseEvent {
  type: RealtimeEventType;
  sessionId: string;
  timestamp: string;
}

export interface ClientJoinedEvent extends BaseEvent {
  type: "client_joined";
  clientId: string;
  clientName?: string;
  source: "mobile";
}

export interface ScanEvent extends BaseEvent {
  type: "scan";
  barcode: string;
  symbology?: string;
  source: ScanSource;
}

export interface ScanAckEvent extends BaseEvent {
  type: "scan_ack";
  barcode: string;
  success: boolean;
  message?: string;
}

export interface DesktopStatusEvent extends BaseEvent {
  type: "desktop_status";
  status: DesktopStatus;
  deviceCount: number;
}

export type RealtimeEvent =
  | ClientJoinedEvent
  | ScanEvent
  | ScanAckEvent
  | DesktopStatusEvent;

export function isScanEvent(value: unknown): value is ScanEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ScanEvent>;
  return event.type === "scan" && typeof event.sessionId === "string" && typeof event.barcode === "string";
}

export function buildSessionChannel(sessionId: string): string {
  return `scanbridge:session:${normalizePairingCode(sessionId)}`;
}

export function buildConnectUrl(sessionId: string): string {
  const url = new URL("https://scanbridge-mobile.vercel.app/connect");
  url.searchParams.set("session", normalizePairingCode(sessionId));
  return url.toString();
}

export function normalizePairingCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatPairingCode(value: string): string {
  const clean = normalizePairingCode(value).slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
}

export function isValidPairingCode(value: string): boolean {
  return normalizePairingCode(value).length === 6;
}

export function normalizeBarcode(barcode: string): string {
  return barcode.trim();
}

export function createClientJoinedEvent(sessionId: string, clientId?: string): ClientJoinedEvent {
  return {
    type: "client_joined",
    sessionId,
    clientId: clientId ?? createSessionId(),
    timestamp: new Date().toISOString(),
    source: "mobile"
  };
}

export function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomBytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
  const hex = randomBytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10, 16).join("")}`;
}
