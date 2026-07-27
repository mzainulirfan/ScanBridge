import { createClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "../../../shared/contracts";
import { buildSessionChannel } from "../../../shared/contracts";

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
  onScan: (event: RealtimeEvent) => Promise<void>,
  onConnected: () => Promise<void>,
  onSubscribed?: () => Promise<void>
): Promise<void> {
  const channel = supabase.channel(buildSessionChannel(sessionId), {
    config: { broadcast: { self: true } }
  });

  channel.on("broadcast", { event: "client_joined" }, async () => {
    await onConnected();
  });

  channel.on("broadcast", { event: "scan" }, async (payload) => {
    await onScan(payload.payload as RealtimeEvent);
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
}
