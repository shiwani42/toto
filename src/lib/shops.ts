// Multi-tenant shops: types + Supabase helpers + active-shop context.
//
// The shopper carries a `?shop=<slug>` URL param when they're shopping
// at a specific store. We resolve that to a Shop row once on mount and
// cache it in sessionStorage so screens that need shop context (event
// logging, cross-shop search) can read it cheaply.
//
// Shop owners hit /?screen=shop-onboarding to sign up their store —
// that flow creates a row in `shops` and a matching `shop_admins`
// row in one go.

import { getSupabase, supabaseConfigured } from "./supabase";

export type Shop = {
  id: string;
  slug: string;
  name: string;
  owner_email: string;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  brand_color: string | null;
  zone_map_url: string | null;
};

const ACTIVE_SHOP_KEY = "toto.activeShop";

/** Read the currently-active shop, if any. Returns null when the
 *  shopper hasn't picked a shop yet (the shopper-side app falls back
 *  to the demo catalog in that case). */
export function getActiveShop(): Shop | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SHOP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Shop;
  } catch {
    return null;
  }
}

export function setActiveShop(shop: Shop | null) {
  if (shop) sessionStorage.setItem(ACTIVE_SHOP_KEY, JSON.stringify(shop));
  else      sessionStorage.removeItem(ACTIVE_SHOP_KEY);
}

/** Look up a shop by its URL slug. Used when a shopper arrives via
 *  ?shop=alpine-store. Returns null if no such shop or Supabase isn't
 *  configured. */
export async function fetchShopBySlug(slug: string): Promise<Shop | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase()
      .from("shops")
      .select("*")
      .eq("slug", slug)
      .maybeSingle<Shop>();
    if (error) {
      console.warn("fetchShopBySlug failed:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("fetchShopBySlug threw:", err);
    return null;
  }
}

/** Shops the signed-in user can administer. One row per shop they're
 *  on the admin list of. Empty array if not signed in or no rows. */
export async function fetchMyShops(): Promise<Shop[]> {
  if (!supabaseConfigured) return [];
  try {
    // Two-step: get the shop_ids I'm an admin of, then load those rows.
    // Could be one join but the RLS-aware function call is clearer.
    const { data, error } = await getSupabase()
      .from("shops")
      .select("*, shop_admins!inner(email)")
      .order("created_at", { ascending: false })
      .returns<Shop[]>();
    if (error) {
      console.warn("fetchMyShops failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("fetchMyShops threw:", err);
    return [];
  }
}

/** Find shops near a point. Used by the shopper's "which shop near me
 *  has my list items?" view. Returns shops sorted by haversine distance
 *  ascending, with a coarse `distance_km` field tacked on. The actual
 *  product-presence join is a follow-up build. */
export async function fetchShopsNear(
  lat: number,
  lng: number,
  radiusKm = 25,
  limit = 20,
): Promise<Array<Shop & { distance_km: number }>> {
  if (!supabaseConfigured) return [];
  try {
    // Crude bounding-box prefilter at ~0.012° per km of latitude. We
    // refine to true distance client-side. Cheap enough for the
    // current scale (tens of shops).
    const dLat = radiusKm * 0.012;
    const dLng = radiusKm * 0.012 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const { data, error } = await getSupabase()
      .from("shops")
      .select("*")
      .gte("lat", lat - dLat)
      .lte("lat", lat + dLat)
      .gte("lng", lng - dLng)
      .lte("lng", lng + dLng)
      .returns<Shop[]>();
    if (error) {
      console.warn("fetchShopsNear failed:", error.message);
      return [];
    }
    const withDistance = (data ?? [])
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        ...s,
        distance_km: haversineKm(lat, lng, s.lat as number, s.lng as number),
      }))
      .filter((s) => s.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);
    return withDistance;
  } catch (err) {
    console.warn("fetchShopsNear threw:", err);
    return [];
  }
}

/** Create a new shop and add the current user as its owner-admin.
 *  Runs both inserts in sequence — the owner_email check on the
 *  shops insert + the policy on shop_admins both gate on the
 *  signed-in user's email. */
export async function createShop(params: {
  slug: string;
  name: string;
  ownerEmail: string;
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  brandColor?: string;
}): Promise<Shop> {
  if (!supabaseConfigured) throw new Error("Supabase isn't configured.");
  const supabase = getSupabase();
  const { data: shop, error } = await supabase
    .from("shops")
    .insert({
      slug: params.slug,
      name: params.name,
      owner_email: params.ownerEmail,
      address: params.address ?? null,
      city: params.city ?? null,
      country: params.country ?? null,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      brand_color: params.brandColor ?? null,
    })
    .select("*")
    .single<Shop>();
  if (error || !shop) {
    throw new Error(error?.message ?? "Couldn't create the shop.");
  }
  const { error: aerr } = await supabase
    .from("shop_admins")
    .insert({ shop_id: shop.id, email: params.ownerEmail, role: "owner" });
  if (aerr) {
    console.warn("shop_admins insert failed (shop already created):", aerr.message);
  }
  return shop;
}

/** Slug-ify a free-text shop name into a URL-safe short code. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ─── Internal ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
