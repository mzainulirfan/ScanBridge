import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { RealtimeEvent, ScanAckEvent } from "../../../shared/contracts";
import { buildSessionChannel, isRealtimeEvent, isScanEvent } from "../../../shared/contracts";

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
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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
  onSubscribed?: () => Promise<void>
): Promise<RealtimeChannel> {
  const channel = supabase.channel(buildSessionChannel(sessionId), {
    config: { broadcast: { self: true } }
  });

  channel.on("broadcast", { event: "client_joined" }, async (payload) => {
    if (!isRealtimeEvent(payload.payload) || payload.payload.type !== "client_joined") return;
    await onConnected(payload.payload.clientId);
  });

  channel.on("broadcast", { event: "client_left" }, async (payload) => {
    if (!isRealtimeEvent(payload.payload) || payload.payload.type !== "client_left") return;
    await onDisconnected(payload.payload.clientId);
  });

  channel.on("broadcast", { event: "client_heartbeat" }, async (payload) => {
    if (!isRealtimeEvent(payload.payload) || payload.payload.type !== "client_heartbeat") return;
    await onHeartbeat(payload.payload.clientId);
  });

  channel.on("broadcast", { event: "scan" }, async (payload) => {
    if (!isScanEvent(payload.payload) || payload.payload.sessionId !== sessionId) return;
    const ack = await onScan(payload.payload);
    if (!ack) return;
    await channel.send({
      type: "broadcast",
      event: "scan_ack",
      payload: ack
    });
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Supabase subscribe timeout")), 10000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        void channel.send({
          type: "broadcast",
          event: "desktop_status",
          payload: {
            type: "desktop_status",
            sessionId,
            status: "waiting_pairing",
            deviceCount: 0,
            timestamp: new Date().toISOString()
          }
        });
        void onSubscribed?.();
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        window.clearTimeout(timeout);
        reject(new Error(`Supabase channel ${status}`));
      }
    });
  });

  return channel;
}
