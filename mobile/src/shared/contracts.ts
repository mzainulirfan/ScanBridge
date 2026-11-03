export type RealtimeEventType =
  | "client_joined"
  | "client_left"
  | "client_heartbeat"
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

export interface ClientLeftEvent extends BaseEvent {
  type: "client_left";
  clientId: string;
  source: "mobile";
}

export interface ClientHeartbeatEvent extends BaseEvent {
  type: "client_heartbeat";
  clientId: string;
  source: "mobile";
}

export interface ScanEvent extends BaseEvent {
  type: "scan";
  scanId: string;
  clientId: string;
  barcode: string;
  symbology?: string;
  source: ScanSource;
}

export interface ScanAckEvent extends BaseEvent {
  type: "scan_ack";
  scanId: string;
  barcode: string;
  success: boolean;
  message?: string;
}

export interface DesktopStatusEvent extends BaseEvent {
  type: "desktop_status";
  status: DesktopStatus;
  deviceCount: number;
  clientId?: string;
}

export type RealtimeEvent =
  | ClientJoinedEvent
  | ClientLeftEvent
  | ClientHeartbeatEvent
  | ScanEvent
  | ScanAckEvent
  | DesktopStatusEvent;

export function isScanEvent(value: unknown): value is ScanEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ScanEvent>;
  return (
    event.type === "scan" &&
    typeof event.scanId === "string" &&
    typeof event.clientId === "string" &&
    isValidPairingCode(event.sessionId ?? "") &&
    typeof event.barcode === "string" &&
    isValidTimestamp(event.timestamp) &&
    event.source === "mobile"
  );
}

export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<RealtimeEvent>;
  if (!isValidPairingCode(event.sessionId ?? "") || !isValidTimestamp(event.timestamp)) return false;

  switch (event.type) {
    case "client_joined":
    case "client_left":
    case "client_heartbeat":
      return typeof event.clientId === "string" && event.clientId.length > 0 && event.source === "mobile";
    case "scan":
      return isScanEvent(event);
    case "scan_ack":
      return (
        typeof event.scanId === "string" &&
        typeof event.barcode === "string" &&
        typeof event.success === "boolean" &&
        (event.message === undefined || typeof event.message === "string")
      );
    case "desktop_status":
      return (
        ["idle", "waiting_pairing", "connected", "reconnecting"].includes(event.status ?? "") &&
        typeof event.deviceCount === "number" &&
        Number.isInteger(event.deviceCount) &&
        event.deviceCount >= 0 &&
        (event.clientId === undefined || (typeof event.clientId === "string" && event.clientId.length > 0))
      );
    default:
      return false;
  }
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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
  return (normalizePairingCode(value).match(/.{1,8}/g) ?? []).join(" ");
}

export function isValidPairingCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-F0-9]{32}$/.test(normalizePairingCode(value));
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

export function createClientLeftEvent(sessionId: string, clientId: string): ClientLeftEvent {
  return {
    type: "client_left",
    sessionId,
    clientId,
    timestamp: new Date().toISOString(),
    source: "mobile"
  };
}

export function createClientHeartbeatEvent(sessionId: string, clientId: string): ClientHeartbeatEvent {
  return {
    type: "client_heartbeat",
    sessionId,
    clientId,
    timestamp: new Date().toISOString(),
    source: "mobile"
  };
}

export function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").toUpperCase();
  }
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
