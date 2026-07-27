export function getSessionFromLocation(search = window.location.search): string | null {
  const params = new URLSearchParams(search);
  const session = params.get("session");
  return session && session.trim().length > 0 ? session : null;
}

export function buildConnectUrl(sessionId: string): string {
  const url = new URL("https://scanbridge.app/connect");
  url.searchParams.set("session", sessionId);
  return url.toString();
}
