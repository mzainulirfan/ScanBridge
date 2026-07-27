export function getSessionFromLocation(location = window.location): string | null {
  const params = new URLSearchParams(location.search);
  const session = params.get("session");
  if (session && session.trim().length > 0) {
    return session.trim();
  }

  const match = location.pathname.match(/^\/connect\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
}
