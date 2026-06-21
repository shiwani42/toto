// Admin auth gate. Two checks:
//   1. The user is signed in via Supabase.
//   2. Their email matches the public.admins allow-list (server-side).
// We don't trust client-side checks for data access — RLS on the events
// table is what actually enforces the gate. The is_admin() helper below
// is purely for showing/hiding UI quickly without an extra query.
//
// We could also configure a build-time allow-list via VITE_ADMIN_EMAILS
// for environments without Supabase, but for the dashboard to be useful
// you need the database anyway.

import { getCurrentUser } from "./auth";
import { getSupabase, supabaseConfigured } from "./supabase";

export async function isAdmin(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  const user = await getCurrentUser();
  if (!user?.email) return false;
  try {
    const { data, error } = await getSupabase()
      .from("admins")
      .select("email")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();
    if (error) {
      console.warn("isAdmin check failed:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn("isAdmin threw:", err);
    return false;
  }
}
