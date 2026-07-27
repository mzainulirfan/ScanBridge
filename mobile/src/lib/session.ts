import { isValidPairingCode, normalizePairingCode } from "../shared/contracts";

const PAIRING_CODE_STORAGE_KEY = "scanbridge.pairingCode";

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

export function clearSessionFromLocation(location = window.location, history = window.history): void {
  const url = new URL(location.href);
  url.searchParams.delete("session");
  if (url.pathname.startsWith("/connect")) {
    url.pathname = "/";
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
