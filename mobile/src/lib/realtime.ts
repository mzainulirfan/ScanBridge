import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "../shared/contracts";
import { buildSessionChannel, isRealtimeEvent } from "../shared/contracts";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface RealtimeClient {
  readonly configured: boolean;
  connect(sessionId: string): Promise<void>;
  publish(event: RealtimeEvent): Promise<void>;
  disconnect(): Promise<void>;
  onEvent?(handler: (event: RealtimeEvent) => void): void;
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (!url || !anonKey || !isHttpUrl(url)) {
    return null;
  }

  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class SupabaseRealtimeClient implements RealtimeClient {
  readonly configured = true;
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private eventHandler: ((event: RealtimeEvent) => void) | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async connect(sessionId: string): Promise<void> {
    await this.disconnect();
    this.sessionId = sessionId;
    this.channel = this.supabase.channel(buildSessionChannel(sessionId), {
      config: {
        broadcast: { self: true }
      }
    });

    this.channel.on("broadcast", { event: "desktop_status" }, (payload) => {
      if (isRealtimeEvent(payload.payload)) this.eventHandler?.(payload.payload);
    });
    this.channel.on("broadcast", { event: "scan_ack" }, (payload) => {
      if (isRealtimeEvent(payload.payload)) this.eventHandler?.(payload.payload);
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Supabase subscribe timeout")), 10000);
      this.channel?.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timeout);
          reject(new Error(`Supabase channel ${status}`));
        }
      });
    });
  }

  async publish(event: RealtimeEvent): Promise<void> {
    if (!this.channel || this.sessionId !== event.sessionId) {
      throw new Error("Realtime channel is not connected to this session");
    }

    const response = await this.channel.send({
      type: "broadcast",
      event: event.type,
      payload: event
    });

    if (response !== "ok") {
      throw new Error(`Supabase broadcast failed: ${response}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.sessionId = null;
  }

  onEvent(handler: (event: RealtimeEvent) => void): void {
    this.eventHandler = handler;
  }
}

export class MockRealtimeClient implements RealtimeClient {
  readonly configured = false;
  private state: ConnectionState = "disconnected";
  private sessionId: string | null = null;
  private events: RealtimeEvent[] = [];

  get snapshot() {
    return {
      state: this.state,
      sessionId: this.sessionId,
      events: [...this.events]
    };
  }

  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.state = "disconnected";
    throw new Error("Supabase belum dikonfigurasi");
  }

  async publish(event: RealtimeEvent): Promise<void> {
    this.events.push(event);
    throw new Error("Supabase belum dikonfigurasi");
  }

  async disconnect(): Promise<void> {
    this.state = "disconnected";
    this.sessionId = null;
  }

  onEvent(): void {
    // no-op for local fallback
  }
}

export function createRealtimeClient(): RealtimeClient {
  const supabase = createSupabaseBrowserClient();
  return supabase ? new SupabaseRealtimeClient(supabase) : new MockRealtimeClient();
}
