import { createClient } from "@supabase/supabase-js";
import type { RealtimeEvent, ScanAckEvent } from "../../../shared/contracts";
import { SessionConnection, type ConnectionState } from "../../../shared/realtime-session";

type DesktopSupabase = ReturnType<typeof createClient>;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createSupabaseDesktopClient(): DesktopSupabase | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (!url || !anonKey || !isHttpUrl(url)) {
    return null;
  }

  try {
    return createClient(url, anonKey, {
      realtime: { worker: true },
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  } catch {
    return null;
  }
}

export async function subscribeDesktopSession(
  supabase: DesktopSupabase,
  sessionId: string,
  onScan: (event: RealtimeEvent) => Promise<ScanAckEvent | null>,
  onConnected: (clientId: string) => Promise<void>,
  onDisconnected: (clientId: string) => Promise<void>,
  onHeartbeat: (clientId: string) => Promise<void>,
  onSubscribed?: () => Promise<void>,
  onUnavailable?: (clientId: string) => Promise<void>,
  onRelayState?: (state: ConnectionState) => void
): Promise<SessionConnection> {
  const connection = new SessionConnection(supabase, "desktop");
  let events = Promise.resolve();
  const enqueue = (action: () => Promise<void>) => {
    events = events.then(action).catch(() => onRelayState?.("disconnected"));
  };
  connection.onEvent((event) => enqueue(async () => {
    switch (event.type) {
      case "client_joined": await onConnected(event.clientId); break;
      case "client_left": await onDisconnected(event.clientId); break;
      case "client_heartbeat": await onHeartbeat(event.clientId); break;
      case "scan": {
        const ack = await onScan(event);
        if (ack) await connection.publish(ack);
      }
    }
  }));
  connection.onPeerLeft((clientId) => {
    if (clientId) enqueue(async () => { await onUnavailable?.(clientId); });
  });
  connection.onStateChange((state) => {
    onRelayState?.(state);
    if (state === "connected") enqueue(async () => { await onSubscribed?.(); });
  });
  await connection.connect(sessionId);
  return connection;
}
