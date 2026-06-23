// Anonymous shopper analytics. Events queue up locally and flush in
// batches to the public.events table. Payloads are categorical only —
// no email, no name, no free-text. Session id is random per visit and
// kept in sessionStorage so it dies when the tab closes.
//
// No-ops gracefully when Supabase isn't configured: the queue just
// grows and never flushes. That keeps the local-only build clean.

import { getSupabase, supabaseConfigured } from "./supabase";
import { getCurrentUser } from "./auth";
import { getActiveShop } from "./shops";

const SESSION_KEY = "toto.analytics.session";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 25;

type Row = {
  shop_id: string;
  session_id: string;
  user_id: string | null;
  event: string;
  payload: Record<string, unknown>;
};

let queue: Row[] = [];
let timer: number | null = null;
let cachedUserId: string | null = null;
let initialized = false;

function newId(): string {
  // 12 chars of base36 from crypto. Not cryptographically critical, just
  // needs to be unique enough across concurrent sessions.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(36).padStart(2, "0");
  return s.slice(0, 12);
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = newId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

async function flush(): Promise<void> {
  if (!supabaseConfigured) return;
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    const { error } = await getSupabase().from("events").insert(batch);
    if (error) {
      console.warn("analytics flush failed:", error.message);
      // Drop the batch on insert error rather than retry forever; we'd
      // rather lose a few events than spam the user with retry loops.
    }
  } catch (err) {
    console.warn("analytics flush threw:", err);
  }
}

function scheduleFlush(): void {
  if (timer !== null) return;
  timer = window.setTimeout(async () => {
    timer = null;
    await flush();
    if (queue.length > 0) scheduleFlush();
  }, FLUSH_INTERVAL_MS);
}

/** Fire-and-forget. Drops payload fields that look like emails or look
 *  long enough to be free text, just to be safe. */
function sanitize(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      if (v.includes("@")) continue;       // skip emails
      if (v.length > 80) continue;          // skip free text
      out[k] = v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.filter((x) => typeof x === "string" && x.length <= 40);
    } else if (typeof v === "object") {
      // shallow keep, recurse one level
      out[k] = sanitize(v as Record<string, unknown>);
    }
  }
  return out;
}

export function track(event: string, payload?: Record<string, unknown>): void {
  // Stamp the active shop's uuid when the shopper is in a shop
  // context (?shop=<slug> resolved on boot). Without a shop, send
  // 'default' so legacy analytics views keep working through the
  // transition. The events.shop_id column is text for exactly this
  // reason — uuid strings sit alongside the literal 'default'.
  const activeShop = getActiveShop();
  queue.push({
    shop_id: activeShop?.id ?? "default",
    session_id: sessionId(),
    user_id: cachedUserId,
    event,
    payload: sanitize(payload),
  });
  scheduleFlush();
}

/** Called once at boot. Watches for sign-in so we can stamp user_id on
 *  future events (useful for repeat-customer analytics). */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  if (supabaseConfigured) {
    void getCurrentUser().then((u) => { cachedUserId = u?.id ?? null; });
  }

  // Flush on unload so the last few events make it. Best-effort; the
  // browser may kill the request, that's fine.
  window.addEventListener("pagehide", () => { void flush(); });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
