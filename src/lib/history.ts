// Per-user shopping history. Records what the user took on past visits
// so Toto can surface "you went for navy last time" / "your kind of brand"
// kinds of moments without needing to ask the user anything new.
//
// Storage:
//   * localStorage `toto.history` is the canonical store. Capped at 10
//     most-recent trips, each up to 20 items, to stay well under quota.
//   * Round-trips through Supabase via prefs.history when signed in
//     (handled by the existing profile sync, since prefs is JSONB).
//
// No PII is recorded: only product codes, derived attributes (category,
// brand, color, size), and a timestamp.

import { getPrefs, setPrefs } from "./prefs";
import { getProduct } from "./catalog";

export type TripItem = {
  code: string;
  category: string;
  brand: string;
  color: string;
  size: string;
};

export type Trip = {
  at: number;          // ms timestamp
  items: TripItem[];
};

const KEY = "toto.history";
const MAX_TRIPS = 10;
const MAX_ITEMS_PER_TRIP = 20;

function readLocal(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Trip[];
  } catch {
    return [];
  }
}

function writeLocal(trips: Trip[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(trips));
  } catch {
    /* localStorage quota; lose the oldest silently next time */
  }
}

export function getHistory(): Trip[] {
  // Merge local with prefs.history (if any). Prefs comes from Supabase
  // profile sync on signed-in users; locally-only users will have an
  // empty prefs.history and rely on localStorage.
  const local = readLocal();
  const remote = getPrefs().history ?? [];
  if (remote.length === 0) return local;
  if (local.length === 0) return remote;
  // Merge by timestamp dedupe, prefer the entry with more items.
  const map = new Map<number, Trip>();
  for (const t of [...remote, ...local]) {
    const existing = map.get(t.at);
    if (!existing || (t.items?.length ?? 0) > (existing.items?.length ?? 0)) {
      map.set(t.at, t);
    }
  }
  return [...map.values()].sort((a, b) => b.at - a.at).slice(0, MAX_TRIPS);
}

/** Record a completed trip. Pass the product codes the shopper added to
 *  their list. Trips with no items are skipped. */
export function recordTrip(codes: string[]): void {
  if (codes.length === 0) return;
  const items: TripItem[] = [];
  for (const code of codes.slice(0, MAX_ITEMS_PER_TRIP)) {
    const p = getProduct(code);
    if (!p) continue;
    items.push({
      code: p.product_code,
      category: p.category,
      brand: p.brand,
      color: p.color,
      size: p.size,
    });
  }
  if (items.length === 0) return;
  const trip: Trip = { at: Date.now(), items };
  const trips = [trip, ...readLocal()].slice(0, MAX_TRIPS);
  writeLocal(trips);
  // Also push into prefs so the profile-sync layer picks it up.
  setPrefs({ history: trips });
}

// ─── Derived insights ───────────────────────────────────────────────────────

export type Insights = {
  /** Total completed trips. */
  tripCount: number;
  /** Most-recent trip, if any. */
  lastTrip: Trip | null;
  /** Categories the user has shopped, ranked by count. */
  topCategories: Array<{ category: string; count: number }>;
  /** Brands the user has chosen, ranked by count. */
  topBrands:     Array<{ brand: string;    count: number }>;
  /** Colors the user has gone for, ranked by count. */
  topColors:     Array<{ color: string;    count: number }>;
};

export function getInsights(): Insights {
  const trips = getHistory();
  const cat = new Map<string, number>();
  const brand = new Map<string, number>();
  const color = new Map<string, number>();
  for (const t of trips) {
    for (const i of t.items) {
      cat.set(i.category,   (cat.get(i.category) ?? 0) + 1);
      brand.set(i.brand,    (brand.get(i.brand) ?? 0) + 1);
      const c = i.color.toLowerCase().split(/\s+/)[0]; // "Navy Heather" → "navy"
      if (c) color.set(c,   (color.get(c) ?? 0) + 1);
    }
  }
  const rank = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ count: v, key: k }));
  return {
    tripCount:     trips.length,
    lastTrip:      trips[0] ?? null,
    topCategories: rank(cat).map(({ key, count }) => ({ category: key, count })),
    topBrands:     rank(brand).map(({ key, count }) => ({ brand: key,    count })),
    topColors:     rank(color).map(({ key, count }) => ({ color: key,    count })),
  };
}

/** A short personalized remark for a product, based on history. Returns
 *  null when nothing personal can honestly be said (e.g. first visit). */
export function remarkFor(productCode: string): string | null {
  const p = getProduct(productCode);
  if (!p) return null;
  const i = getInsights();
  if (i.tripCount === 0) return null;

  const firstColorWord = p.color.toLowerCase().split(/\s+/)[0];
  const colorMatch = i.topColors.find((c) => c.color === firstColorWord);
  if (colorMatch && colorMatch.count >= 2) {
    return `You've gone for ${firstColorWord} before. Tends to be your thing.`;
  }

  const brandMatch = i.topBrands.find((b) => b.brand === p.brand);
  if (brandMatch && brandMatch.count >= 2) {
    return `${p.brand} again. You know what you like.`;
  }

  // Returning shopper but no specific match.
  if (i.tripCount >= 2) {
    return null;
  }
  return null;
}
