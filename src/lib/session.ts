import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!supabaseConfigured) {
    // Surfaced to the user as "Live sessions aren't available here yet." The
    // full env-var hint stays in the console for the dev.
    console.error("Live sessions not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).");
    throw new Error("Live sessions aren't available here yet.");
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }
  return _client;
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
  | { kind: "vote"; from: string; code: string; vote: "yes" | "no" }
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
