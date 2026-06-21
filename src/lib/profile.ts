// Profile sync against Supabase. Guests use localStorage only; once signed
// in, prefs round-trip through public.profiles.prefs (JSONB).
//
// Reconciliation on sign-in: remote wins for any non-null field, local
// fills the gaps. That way a user who set sizes locally before signing in
// doesn't lose them, but a user signing in on a new device picks up what
// they set elsewhere.

import { getSupabase, supabaseConfigured } from "./supabase";
import { getCurrentUser, onAuthChange } from "./auth";
import { getPrefs, setPrefs, subscribePrefs, type Prefs } from "./prefs";

const TABLE = "profiles";

type Remote = { prefs: Partial<Prefs> | null };

async function fetchRemote(userId: string): Promise<Partial<Prefs> | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("prefs")
    .eq("user_id", userId)
    .maybeSingle<Remote>();
  if (error) {
    console.warn("profile fetch failed:", error.message);
    return null;
  }
  return data?.prefs ?? null;
}

async function pushRemote(userId: string, prefs: Prefs): Promise<void> {
  if (!supabaseConfigured) return;
  const { error } = await getSupabase()
    .from(TABLE)
    .upsert({ user_id: userId, prefs }, { onConflict: "user_id" });
  if (error) console.warn("profile push failed:", error.message);
}

// Merge: remote non-null fields beat local; null/undefined in remote leaves
// local intact. We never delete a field this way; only the user can.
function reconcile(local: Prefs, remote: Partial<Prefs>): Prefs {
  const merged: Prefs = { ...local };
  for (const key of Object.keys(remote) as Array<keyof Prefs>) {
    const value = remote[key];
    if (value !== null && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

let pushTimer: number | null = null;
let activeUserId: string | null = null;

function schedulePush(): void {
  if (!activeUserId) return;
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    const uid = activeUserId;
    if (!uid) return;
    void pushRemote(uid, getPrefs());
  }, 600);
}

async function adoptUser(userId: string): Promise<void> {
  activeUserId = userId;
  const remote = await fetchRemote(userId);
  if (remote && Object.keys(remote).length > 0) {
    // Remote exists: merge into local. setPrefs persists and re-triggers
    // a push, but the data is identical so it's effectively a no-op.
    const merged = reconcile(getPrefs(), remote);
    setPrefs(merged);
  } else {
    // First sign-in on this account: seed remote from local prefs.
    await pushRemote(userId, getPrefs());
  }
}

function releaseUser(): void {
  activeUserId = null;
  if (pushTimer !== null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
}

let initialized = false;

/** Wire auth state to profile sync. Safe to call once at app boot. */
export function initProfileSync(): void {
  if (!supabaseConfigured || initialized) return;
  initialized = true;

  // Every local pref write pushes to remote if signed in.
  subscribePrefs(() => {
    if (activeUserId) schedulePush();
  });

  // Adopt the user already in session at boot, if any.
  void getCurrentUser().then((user) => {
    if (user) void adoptUser(user.id);
  });

  onAuthChange((user) => {
    if (user) {
      if (user.id !== activeUserId) void adoptUser(user.id);
    } else {
      releaseUser();
    }
  });
}
