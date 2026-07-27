import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "../../../shared/contracts";
import { buildSessionChannel } from "../../../shared/contracts";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface RealtimeClient {
  connect(sessionId: string): Promise<void>;
  publish(event: RealtimeEvent): Promise<void>;
  disconnect(): Promise<void>;
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
}

export class SupabaseRealtimeClient implements RealtimeClient {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;

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
}

export class MockRealtimeClient implements RealtimeClient {
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
    this.state = "connecting";
    this.sessionId = sessionId;
    this.state = "connected";
  }

  async publish(event: RealtimeEvent): Promise<void> {
    if (this.sessionId !== event.sessionId) {
      throw new Error("session mismatch");
    }
    this.events.push(event);
  }

  async disconnect(): Promise<void> {
    this.state = "disconnected";
    this.sessionId = null;
  }
}

export function createRealtimeClient(): RealtimeClient {
  const supabase = createSupabaseBrowserClient();
  return supabase ? new SupabaseRealtimeClient(supabase) : new MockRealtimeClient();
}
