import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "../shared/contracts";
import { SessionConnection, type ConnectionState } from "../../../shared/realtime-session";
export type { ConnectionState } from "../../../shared/realtime-session";


export interface RealtimeClient {
  readonly configured: boolean;
  connect(sessionId: string, clientId?: string): Promise<void>;
  publish(event: RealtimeEvent): Promise<void>;
  disconnect(): Promise<void>;
  onEvent?(handler: (event: RealtimeEvent) => void): void;
  onStateChange?(handler: (state: ConnectionState) => void): void;
  onPeerLeft?(handler: () => void): void;
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

export class SupabaseRealtimeClient extends SessionConnection implements RealtimeClient {
  readonly configured = true;
  constructor(supabase: SupabaseClient) { super(supabase, "mobile"); }
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
