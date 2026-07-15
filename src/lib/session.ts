import { type RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";

export { supabaseConfigured };

function client() {
  return getSupabase();
}

export type Mode = "partner" | "family";

export type Member = {
  id: string;
  name: string;
  emoji: string;
  zone?: string; // "A".."G" or "entry"
};

export type SessionEvent =
  | { kind: "list:added"; from: string; code: string }
  | { kind: "list:removed"; from: string; code: string }
  | { kind: "list:snapshot"; from: string; codes: string[] }
  | { kind: "list:request-snapshot"; from: string }
  | { kind: "scan:found"; from: string; code: string }
  | { kind: "vote"; from: string; code: string; vote: "yes" | "maybe" | "no" }
  | { kind: "chat"; from: string; text: string };

export type SessionListener = {
  onPresence?: (members: Member[]) => void;
  onEvent?: (event: SessionEvent) => void;
};

const STORAGE = "toto.session";

export type SessionState = {
  code: string;
  mode: Mode;
  me: Member;
};

export function loadSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(state: SessionState) {
  sessionStorage.setItem(STORAGE, JSON.stringify(state));
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE);
}

// 4-letter human-friendly code (no ambiguous chars).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode(prefix: "FAM" | "PAR"): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${s}`;
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 11);
}

const EMOJI = ["🧗", "🏔️", "🐾", "🌲", "🛶", "🦌", "🦊", "🌻", "⛺", "🥾"];
export function randomEmoji(): string {
  return EMOJI[Math.floor(Math.random() * EMOJI.length)];
}

// ----- Realtime channel wrapper -----

export class Session {
  private channel: RealtimeChannel | null = null;
  private readonly code: string;
  private readonly me: Member;
  public listener: SessionListener;

  constructor(code: string, me: Member, listener: SessionListener = {}) {
    this.code = code;
    this.me = me;
    this.listener = listener;
  }

  async connect(): Promise<void> {
    const c = client();
    const channel = c.channel(`toto:${this.code}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.me.id },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<Member>>;
      const members: Member[] = [];
      for (const [id, presences] of Object.entries(state)) {
        const p = presences[0];
        if (!p) continue;
        members.push({
          id,
          name: p.name,
          emoji: p.emoji,
          zone: p.zone,
        });
      }
      this.listener.onPresence?.(members);
    });

    channel.on("broadcast", { event: "session-event" }, (msg) => {
      const event = msg.payload as SessionEvent;
      this.listener.onEvent?.(event);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: this.me.name,
            emoji: this.me.emoji,
            zone: this.me.zone ?? "entry",
          });
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Realtime status: ${status}`));
        }
      });
    });

    this.channel = channel;
  }

  async setZone(zone: string): Promise<void> {
    if (!this.channel) return;
    await this.channel.track({
      name: this.me.name,
      emoji: this.me.emoji,
      zone,
    });
  }

  async send(event: SessionEvent): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: "broadcast",
      event: "session-event",
      payload: event,
    });
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export let globalSession: Session | null = null;

export function initGlobalSession() {
  const state = loadSession();
  if (state && !globalSession) {
    globalSession = new Session(state.code, state.me);
    globalSession.connect().catch(console.error);
  }
}

export function destroyGlobalSession() {
  if (globalSession) {
    globalSession.disconnect();
    globalSession = null;
  }
}

/** Best-effort broadcast on the live shopping channel. Prefers the
 *  long-lived `globalSession` so we don't open a throwaway connection
 *  for every scan / vote. No-ops when nobody is in a session. */
export function broadcastSessionEvent(
  event: { kind: SessionEvent["kind"]; from?: string } & Record<string, unknown>,
): void {
  const state = loadSession();
  if (!state) return;
  const payload = { ...event, from: event.from ?? state.me.id } as SessionEvent;
  if (globalSession) {
    globalSession.send(payload).catch(() => { /* best-effort */ });
    return;
  }
  try {
    const s = new Session(state.code, state.me, {});
    s.connect()
      .then(() => s.send(payload))
      .then(() => s.disconnect())
      .catch(() => { /* swallow */ });
  } catch {
    /* ignore */
  }
}
