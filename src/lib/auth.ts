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

/** Sends a magic-link email. User clicks the link, lands back on the app
 *  authenticated. We don't sit on this promise — UI shows a 'check your
 *  email' state immediately. */
export async function signInWithEmail(email: string): Promise<void> {
  if (!authConfigured) throw new Error("Sign-in isn't available here yet.");
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: {
      // Land them back on the home screen after the link click.
      emailRedirectTo: `${window.location.origin}/?screen=home`,
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
