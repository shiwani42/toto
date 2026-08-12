// Admin auth gates. Two audiences share ?screen=dashboard
// (legacy ?screen=admin redirects here):
//   1. Platform admin (public.admins) — Toto product usage metrics.
//   2. Shop owner / staff (public.shop_admins) — retailer demand insights.
 //
 // We don't trust client-side checks for data access — RLS on events /
 // shop_admins / products is what actually enforces the gate. These
 // helpers are for show/hide UI without extra queries.

import { getCurrentUser } from "./auth";
import { getSupabase, supabaseConfigured } from "./supabase";

export type AdminRoles = {
  platform: boolean;
  owner: boolean;
};

/** True if the signed-in user can see ANY admin surface. */
export async function isAdmin(): Promise<boolean> {
  const roles = await getAdminRoles();
  return roles.platform || roles.owner;
}

/** Platform operator (legacy allow-list). Sees Toto usage / funnel. */
export async function isPlatformAdmin(): Promise<boolean> {
  const roles = await getAdminRoles();
  return roles.platform;
}

/** Shop owner or staff. Sees demand / intent insights for their shops. */
export async function isShopOwner(): Promise<boolean> {
  const roles = await getAdminRoles();
  return roles.owner;
}

/** Resolve both roles in one round-trip pair. */
export async function getAdminRoles(): Promise<AdminRoles> {
  if (!supabaseConfigured) return { platform: false, owner: false };
  const user = await getCurrentUser();
  if (!user?.email) return { platform: false, owner: false };
  const email = user.email.toLowerCase();
  try {
    const supabase = getSupabase();
    const [legacyRes, shopRes] = await Promise.all([
      supabase.from("admins").select("email").eq("email", email).maybeSingle(),
      supabase.from("shop_admins").select("email").eq("email", email).limit(1).maybeSingle(),
    ]);
    if (legacyRes.error) console.warn("isPlatformAdmin check failed:", legacyRes.error.message);
    if (shopRes.error) console.warn("isShopOwner check failed:", shopRes.error.message);
    return {
      platform: Boolean(legacyRes.data),
      owner: Boolean(shopRes.data),
    };
  } catch (err) {
    console.warn("getAdminRoles threw:", err);
    return { platform: false, owner: false };
  }
}
