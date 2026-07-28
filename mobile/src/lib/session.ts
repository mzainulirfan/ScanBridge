import { isValidPairingCode, normalizePairingCode } from "../shared/contracts";

const PAIRING_CODE_STORAGE_KEY = "scanbridge.pairingCode";
const CLIENT_ID_STORAGE_KEY = "scanbridge.clientId";

export function getSessionFromLocation(location = window.location): string | null {
  const params = new URLSearchParams(location.search);
  const session = params.get("session");
  if (session && session.trim().length > 0) {
    return session.trim();
  }

  const match = location.pathname.match(/^\/connect\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
}

export function getStoredPairingCode(storage?: Storage): string | null {
  try {
    const pairingCode = normalizePairingCode((storage ?? window.localStorage).getItem(PAIRING_CODE_STORAGE_KEY) ?? "");
    return isValidPairingCode(pairingCode) ? pairingCode : null;
  } catch {
    return null;
  }
}

export function storePairingCode(pairingCode: string, storage?: Storage): void {
  const normalizedCode = normalizePairingCode(pairingCode);
  if (!isValidPairingCode(normalizedCode)) {
    return;
  }

  try {
    (storage ?? window.localStorage).setItem(PAIRING_CODE_STORAGE_KEY, normalizedCode);
  } catch {
    // Pairing still works when storage is unavailable or blocked.
  }
}

export function clearStoredPairingCode(storage?: Storage): void {
  try {
    (storage ?? window.localStorage).removeItem(PAIRING_CODE_STORAGE_KEY);
  } catch {
    // The in-memory session can still be disconnected.
  }
}

export function getOrCreateStoredClientId(storage?: Storage): string {
  const target = storage ?? window.localStorage;
  try {
    const stored = target.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
    if (stored) return stored;
    const clientId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    target.setItem(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function clearStoredClientId(storage?: Storage): void {
  try {
    (storage ?? window.localStorage).removeItem(CLIENT_ID_STORAGE_KEY);
  } catch {
    // Disconnect still completes when storage is unavailable.
  }
}

export function clearSessionFromLocation(location = window.location, history = window.history): void {
  const url = new URL(location.href);
  url.searchParams.delete("session");
  if (url.pathname.startsWith("/connect")) {
    url.pathname = "/";
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
