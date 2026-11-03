import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { buildSessionChannel, isRealtimeEvent, type RealtimeEvent } from "./contracts";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
export const HEARTBEAT_INTERVAL_MS = 4000;
export const PEER_TIMEOUT_MS = 12000;

type Peer = { role: "desktop" | "mobile"; clientId?: string; sessionId: string };

// Presence handles closed sockets; heartbeats also catch a frozen app whose socket is still open.
export class SessionConnection {
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private generation = 0;
  private ready = false;
  private cancelSubscribe: (() => void) | null = null;
  private eventHandler: ((event: RealtimeEvent) => void) | null = null;
  private stateHandler: ((state: ConnectionState) => void) | null = null;
  private peerLeftHandler: ((clientId?: string) => void) | null = null;

  constructor(private supabase: SupabaseClient, private role: Peer["role"]) {}

  onEvent(handler: (event: RealtimeEvent) => void) { this.eventHandler = handler; }
  onStateChange(handler: (state: ConnectionState) => void) { this.stateHandler = handler; }
  onPeerLeft(handler: (clientId?: string) => void) { this.peerLeftHandler = handler; }

  async connect(sessionId: string, clientId?: string): Promise<void> {
    const closing = this.disconnect();
    const generation = this.generation;
    const current = () => this.generation === generation;
    await closing;
    if (!current()) throw new Error("Connection cancelled");
    this.stateHandler?.("connecting");
    const { data, error } = await this.supabase.auth.getSession();
    if (!current()) throw new Error("Connection cancelled");
    if (error) throw error;
    if (!data.session) {
      const { error: signInError } = await this.supabase.auth.signInAnonymously();
      if (!current()) throw new Error("Connection cancelled");
      if (signInError) throw signInError;
    }
    this.sessionId = sessionId;
    const channel = this.supabase.channel(buildSessionChannel(sessionId), {
      config: { broadcast: { self: false, ack: true }, presence: { key: `${this.role}:${clientId ?? sessionId}` } }
    });
    this.channel = channel;
    let peers = new Set<string>();
    channel.on("presence", { event: "sync" }, () => {
      if (!current()) return;
      const next = new Set<string>();
      for (const peer of Object.values(channel.presenceState<Peer>()).flat()) {
        if (peer.sessionId !== sessionId || peer.role === this.role) continue;
        if (this.role === "desktop" && (peer.role !== "mobile" || !peer.clientId)) continue;
        if (this.role === "mobile" && peer.role !== "desktop") continue;
        next.add(peer.clientId ?? "desktop");
      }
      const previous = peers;
      peers = next;
      for (const id of previous) {
        if (!next.has(id)) this.peerLeftHandler?.(this.role === "mobile" ? undefined : id);
      }
    });
    channel.on("broadcast", { event: "*" }, ({ payload }) => {
      if (current() && isRealtimeEvent(payload) && payload.sessionId === sessionId) this.eventHandler?.(payload);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = (error: Error) => {
          if (!current()) return;
          this.ready = false;
          this.stateHandler?.("disconnected");
          if (!settled) { settled = true; window.clearTimeout(timeout); reject(error); }
        };
        const timeout = window.setTimeout(() => fail(new Error("Supabase subscribe timeout")), 10000);
        this.cancelSubscribe = () => {
          window.clearTimeout(timeout);
          if (!settled) { settled = true; reject(new Error("Connection cancelled")); }
        };
        channel.subscribe((status) => {
          if (!current()) return;
          if (status === "SUBSCRIBED") {
            void channel.track({ role: this.role, sessionId, clientId }).then((response) => {
              if (!current()) return;
              if (response !== "ok") { fail(new Error(`Supabase presence ${response}`)); return; }
              this.ready = true;
              this.stateHandler?.("connected");
              if (!settled) { settled = true; window.clearTimeout(timeout); resolve(); }
            }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("Presence failed")));
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            fail(new Error(`Supabase channel ${status}`));
          }
        });
      });
    } catch (error) {
      if (current()) await this.disconnect();
      throw error;
    }
  }

  async publish(event: RealtimeEvent): Promise<void> {
    const channel = this.channel;
    if (!channel || !this.ready || this.sessionId !== event.sessionId) throw new Error("Realtime tidak terhubung");
    const generation = this.generation;
    try {
      const response = await channel.send({ type: "broadcast", event: event.type, payload: event });
      if (generation !== this.generation) throw new Error("Connection cancelled");
      if (response !== "ok") throw new Error(`Supabase broadcast failed: ${response}`);
    } catch (error) {
      if (generation === this.generation) {
        this.ready = false;
        this.stateHandler?.("disconnected");
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    ++this.generation;
    this.cancelSubscribe?.();
    this.cancelSubscribe = null;
    const channel = this.channel;
    this.channel = null;
    this.sessionId = null;
    this.ready = false;
    if (channel) await this.supabase.removeChannel(channel);
  }
}
