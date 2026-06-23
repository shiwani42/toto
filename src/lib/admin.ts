// Admin auth gate. Two paths to admin:
//   1. The legacy single-shop allow-list (public.admins) — kept so the
//      original 'default' shop continues to work for the demo.
//   2. The multi-tenant flow (public.shop_admins) — anyone who owns or
//      staffs a shop sees that shop's dashboard.
//
// We don't trust client-side checks for data access — RLS on events /
// shop_admins / products is what actually enforces the gate. These
// helpers are for show/hide UI without extra queries.

import { getCurrentUser } from "./auth";
import { getSupabase, supabaseConfigured } from "./supabase";

/** True if the signed-in user can see ANY admin dashboard (legacy
 *  allow-list OR any shop's admin team). */
export async function isAdmin(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  const user = await getCurrentUser();
  if (!user?.email) return false;
  const email = user.email.toLowerCase();
  try {
    const supabase = getSupabase();
    // Check both lists in parallel — whichever returns a row wins.
    const [legacyRes, shopRes] = await Promise.all([
      supabase.from("admins").select("email").eq("email", email).maybeSingle(),
      supabase.from("shop_admins").select("email").eq("email", email).limit(1).maybeSingle(),
    ]);
    if (legacyRes.error) console.warn("isAdmin legacy check failed:", legacyRes.error.message);
    if (shopRes.error)   console.warn("isAdmin shop check failed:",   shopRes.error.message);
    return Boolean(legacyRes.data) || Boolean(shopRes.data);
  } catch (err) {
    console.warn("isAdmin threw:", err);
    return false;
  }
}
