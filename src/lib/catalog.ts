import type { Product } from "./types";
import productsRaw from "../../data/products.json";
import { getSupabase, supabaseConfigured } from "./supabase";

// The catalog is intentionally a synchronous read everywhere in the
// shopper UI (getProduct, search, zonesForCodes). To keep that contract
// while supporting per-shop catalogs from Supabase, we maintain a
// mutable in-memory cache that's primed once on boot:
//   * No shop context → use the bundled JSON. Existing demo unchanged.
//   * ?shop=<slug> resolves → primeCatalog(shopId) fetches that shop's
//     rows from Supabase and swaps them in. Falls back silently to
//     bundled JSON if the network query fails (better to render the
//     demo than to break the app).
// Screens never await catalog lookups, so the shopper-facing code
// stays exactly as it was.

const bundled = productsRaw as Product[];

// `current` is the live array screens read from. We re-assign it as a
// whole instead of mutating in place so the indexed maps below stay
// consistent on swap.
let current: Product[] = bundled;
let byBarcode = buildByBarcode(current);
let haystack = buildHaystack(current);

function buildByBarcode(list: Product[]): Map<string, Product> {
  return new Map<string, Product>(list.map((p) => [p.product_code, p]));
}

function buildHaystack(list: Product[]): Map<string, string> {
  return new Map<string, string>(
    list.map((p) => [
      p.product_code,
      [
        p.name,
        p.brand,
        p.category,
        p.color,
        p.size,
        `size ${p.size}`,
        p.material,
        p.zone_name,
        ...(p.tags ?? []),
      ]
        .join(" ")
        .toLowerCase(),
    ]),
  );
}

function setCurrent(list: Product[]) {
  current = list;
  byBarcode = buildByBarcode(list);
  haystack = buildHaystack(list);
}

// Light stopword strip so "X for Y" / "X in size Y" still match.
const STOPWORDS = new Set([
  "for", "of", "the", "a", "an", "with", "my", "and", "or", "in", "to",
]);

export function getProduct(barcode: string): Product | undefined {
  return byBarcode.get(barcode);
}

export function allProducts(): Product[] {
  return current;
}

// Compact projection of the catalog for LLM prompts — small enough that the
// full catalog fits comfortably in a single Claude message.
export function compactCatalog() {
  return current.map((p) => ({
    code: p.product_code,
    name: p.name,
    category: p.category,
    tags: p.tags,
    size: p.size,
    color: p.color,
    weight_g: p.weight_g,
    waterproof_rating_mm: p.waterproof_rating_mm,
    temp_rating_c: p.temp_rating_c,
    price_chf: p.price_chf,
  }));
}

export function search(query: string, limit = 12): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const out: Product[] = [];
  for (const p of current) {
    const hs = haystack.get(p.product_code) ?? "";
    if (tokens.every((t) => hs.includes(t))) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function zonesForCodes(codes: string[]): {
  zone: string;
  zone_name: string;
  count: number;
}[] {
  const counts = new Map<string, { zone_name: string; count: number }>();
  for (const code of codes) {
    const p = byBarcode.get(code);
    if (!p) continue;
    const prev = counts.get(p.zone);
    if (prev) prev.count += 1;
    else counts.set(p.zone, { zone_name: p.zone_name, count: 1 });
  }
  return Array.from(counts, ([zone, { zone_name, count }]) => ({
    zone,
    zone_name,
    count,
  })).sort((a, b) => a.zone.localeCompare(b.zone));
}

// ─── Per-shop priming ───────────────────────────────────────────────────────

// Cache of per-shop catalogs in sessionStorage so repeat visits don't
// re-fetch. Versioned by shop_id; bumping the constant invalidates all.
const SHOP_CACHE_KEY = "toto.shopCatalog";
const SHOP_CACHE_VERSION = 1;

type ShopCacheEntry = { v: number; shop_id: string; products: Product[]; at: number };

function readShopCache(shopId: string): Product[] | null {
  try {
    const raw = sessionStorage.getItem(SHOP_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ShopCacheEntry;
    if (entry.v !== SHOP_CACHE_VERSION) return null;
    if (entry.shop_id !== shopId) return null;
    // 10-minute freshness — short enough that admin edits show up
    // promptly, long enough to avoid re-fetching on every navigation.
    if (Date.now() - entry.at > 10 * 60 * 1000) return null;
    return entry.products;
  } catch { return null; }
}

function writeShopCache(shopId: string, products: Product[]) {
  try {
    const entry: ShopCacheEntry = { v: SHOP_CACHE_VERSION, shop_id: shopId, products, at: Date.now() };
    sessionStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota — fine to skip */ }
}

/** Swap the in-memory catalog over to a specific shop's Supabase rows.
 *  Reads cached rows synchronously first (so screens that mount in the
 *  same tick see the right catalog), then fires an async refresh in the
 *  background. If the fetch fails for any reason (offline, RLS, empty),
 *  we leave the bundled JSON in place — no error is shown to the user. */
export async function primeCatalog(shopId: string): Promise<void> {
  const cached = readShopCache(shopId);
  if (cached && cached.length > 0) setCurrent(cached);

  if (!supabaseConfigured) return;
  try {
    const { data, error } = await getSupabase()
      .from("products")
      .select("*")
      .eq("shop_id", shopId)
      .returns<Product[]>();
    if (error) {
      console.warn("primeCatalog failed:", error.message);
      return;
    }
    if (data && data.length > 0) {
      writeShopCache(shopId, data);
      setCurrent(data);
    }
  } catch (err) {
    console.warn("primeCatalog threw:", err);
  }
}

/** Reset to the bundled JSON catalog. Called when the user leaves a
 *  shop context (clears the cached per-shop rows). */
export function resetCatalog() {
  sessionStorage.removeItem(SHOP_CACHE_KEY);
  setCurrent(bundled);
}
