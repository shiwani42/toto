// Account-level auth via Supabase magic-link OTP. Wraps Supabase Auth so
// the rest of the app talks to a small surface: signIn, signOut, getUser,
// onAuthChange. Sign-in is optional everywhere; guests use localStorage.

import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";

export const authConfigured = supabaseConfigured;

export async function getSession(): Promise<Session | null> {
  if (!authConfigured) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session;
  } catch (err) {
    console.warn("getSession failed:", err);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** True when the URL looks like a magic-link / OAuth callback
 *  (hash tokens). While this is set we should keep a loading
 *  skeleton up instead of flashing the sign-in form. */
export function hasAuthCallback(): boolean {
  try {
    return /(?:^|[&#])(?:access_token|refresh_token|error)=/.test(window.location.hash);
  } catch {
    return false;
  }
}

/** Resolve the current user without flashing a signed-out UI during
 *  magic-link return. If the URL has auth callback tokens, wait for
 *  `onAuthStateChange` (or a short timeout) before returning null. */
export async function waitForAuthUser(timeoutMs = 4000): Promise<User | null> {
  if (!authConfigured) return null;
  const immediate = await getCurrentUser();
  if (immediate) return immediate;
  if (!hasAuthCallback()) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsub();
      resolve(user);
    };
    const unsub = onAuthChange((user) => {
      if (user) finish(user);
    });
    const timer = window.setTimeout(() => {
      void getCurrentUser().then(finish);
    }, timeoutMs);
    // Race: getSession may already have processed the hash by now.
    void getCurrentUser().then((u) => {
      if (u) finish(u);
    });
  });
}

/** Sends a magic-link email. User clicks the link, lands back on the app
 *  authenticated. We don't sit on this promise — UI shows a 'check your
 *  email' state immediately.
 *
 *  `landingScreen` controls where the user is sent after the link click:
 *  admins want to come back to the dashboard; settings sign-ins go home.
 *
 *  Note: the URL passed as `emailRedirectTo` only works if it matches
 *  an entry in the Supabase project's allowed Redirect URLs list. If
 *  the magic link is landing on localhost, fix it in
 *  Supabase Dashboard → Authentication → URL Configuration. */
export async function signInWithEmail(email: string, landingScreen: string = "home"): Promise<void> {
  if (!authConfigured) throw new Error("Sign-in isn't available here yet.");
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/?screen=${landingScreen}`,
    },
  });
  if (error) {
    console.error("signInWithEmail failed:", error);
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  if (!authConfigured) return;
  try {
    await getSupabase().auth.signOut();
  } catch (err) {
    console.warn("signOut failed:", err);
  }
}

/** Subscribe to auth state changes. Returns an unsubscribe fn. */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!authConfigured) return () => {};
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
