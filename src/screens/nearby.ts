// Cross-shop search: given the shopper's current list, find shops that
// carry those items, ordered by walking distance from the user. The
// shopper doesn't need to be in a shop context yet — this is the
// "I'm planning at home, where should I go?" view.
//
// Data flow
//   * Geolocation: navigator.geolocation.getCurrentPosition with a
//     gentle fallback when permission is denied (manual postal-code
//     entry, deferred).
//   * Product → shop join: v_product_availability gives us all shops
//     carrying each code with stock > 0.
//   * Shop distance: haversine in the client. RPC could push this to
//     SQL but the row count is small.

import { getList } from "../lib/list";
import { getProduct } from "../lib/catalog";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

type Availability = {
  product_code: string;
  product_name: string;
  brand: string;
  price_chf: number;
  stock_front: number;
  stock_total: number;
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  lat: number | null;
  lng: number | null;
};

type ShopGroup = {
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  items: Availability[];
  total_codes: number; // out of how many list codes this shop carries
};

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

export function renderNearby(root: HTMLElement) {
  const list = getList();
  if (list.length === 0) {
    root.innerHTML = `
      <header><h1>Where can I buy this?</h1></header>
      <main class="screen-list">
        <div class="empty-state">
          <div class="empty-state__title">Add to your list first.</div>
          <div class="empty-state__sub">I can show shops nearby that carry the items you've added.</div>
          <a class="link-btn" href="?screen=list" style="margin-top:12px">Open list</a>
        </div>
      </main>
    `;
    return;
  }

  root.innerHTML = `
    <header>
      <h1>Where can I buy this?</h1>
      <p class="tag" id="nb-tag">${list.length} ${list.length === 1 ? "item" : "items"} · looking nearby…</p>
    </header>
    <main class="screen-list">
      <div id="nb-results"><div class="admin-skeleton">
        <div class="admin-skeleton__block"></div>
        <div class="admin-skeleton__block"></div>
      </div></div>
    </main>
  `;
  const tagEl = root.querySelector("#nb-tag") as HTMLParagraphElement;
  const resultsEl = root.querySelector("#nb-results") as HTMLDivElement;

  void (async () => {
    if (!supabaseConfigured) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Not available yet.</div>
          <div class="empty-state__sub">Cross-shop search needs the platform to be configured.</div>
        </div>
      `;
      return;
    }

    // Geolocate. If the user denies, fall back to "all shops" without
    // distance sorting — better than nothing.
    let userLoc: { lat: number; lng: number } | null = null;
    try {
      userLoc = await getLocation();
    } catch {
      userLoc = null;
    }

    const { data, error } = await getSupabase()
      .from("v_product_availability")
      .select("*")
      .in("product_code", list)
      .returns<Availability[]>();
    if (error) {
      resultsEl.innerHTML = `<div class="status">Couldn't reach the catalog right now.</div>`;
      console.warn("nearby search failed:", error.message);
      return;
    }

    const groups = groupByShop(data ?? [], userLoc);
    if (groups.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">No nearby shop carries these yet.</div>
          <div class="empty-state__sub">Your items aren't stocked in any listed shop. As more shops sign up, this view fills out.</div>
        </div>
      `;
      tagEl.textContent = `${list.length} ${list.length === 1 ? "item" : "items"} · no matches`;
      return;
    }

    tagEl.textContent = userLoc
      ? `${list.length} ${list.length === 1 ? "item" : "items"} · ${groups.length} ${groups.length === 1 ? "shop" : "shops"} nearby`
      : `${list.length} ${list.length === 1 ? "item" : "items"} · location off, showing all shops`;

    resultsEl.innerHTML = `
      <ul class="nb-shops">
        ${groups.map((g) => renderShopGroup(g, list.length)).join("")}
      </ul>
    `;
  })();
}

function getLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("no geolocation")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

function groupByShop(rows: Availability[], userLoc: { lat: number; lng: number } | null): ShopGroup[] {
  const map = new Map<string, ShopGroup>();
  for (const r of rows) {
    let g = map.get(r.shop_id);
    if (!g) {
      g = {
        shop_id: r.shop_id,
        shop_slug: r.shop_slug,
        shop_name: r.shop_name,
        lat: r.lat,
        lng: r.lng,
        distance_km: userLoc && r.lat != null && r.lng != null
          ? haversineKm(userLoc.lat, userLoc.lng, r.lat, r.lng)
          : null,
        items: [],
        total_codes: 0,
      };
      map.set(r.shop_id, g);
    }
    g.items.push(r);
  }
  // total_codes = distinct product codes per group (a shop might carry
  // the same code in two sizes; we still count that as one match).
  for (const g of map.values()) {
    const codes = new Set(g.items.map((i) => i.product_code));
    g.total_codes = codes.size;
  }
  return Array.from(map.values()).sort((a, b) => {
    // Best coverage first (more list items), then closest.
    if (b.total_codes !== a.total_codes) return b.total_codes - a.total_codes;
    if (a.distance_km == null && b.distance_km == null) return 0;
    if (a.distance_km == null) return 1;
    if (b.distance_km == null) return -1;
    return a.distance_km - b.distance_km;
  });
}

function renderShopGroup(g: ShopGroup, totalList: number): string {
  const itemRows = g.items.map((i) => {
    const p = getProduct(i.product_code);
    const name = p ? `${p.brand} · ${p.name}` : `${i.brand} · ${i.product_name}`;
    return `
      <li class="nb-item">
        <span class="nb-item__name">${escapeHTML(name)}</span>
        <span class="nb-item__stock">${i.stock_front > 0 ? `${i.stock_front} on shelf` : "ask a staffer"}</span>
      </li>
    `;
  }).join("");
  const distLine = g.distance_km != null
    ? `${g.distance_km.toFixed(1)} km away`
    : "distance unknown";
  const coverage = `${g.total_codes} of ${totalList} items`;
  return `
    <li class="nb-shop">
      <a class="nb-shop__head" href="?shop=${escapeHTML(g.shop_slug)}&screen=list">
        <div class="nb-shop__body">
          <div class="nb-shop__name">${escapeHTML(g.shop_name)}</div>
          <div class="nb-shop__sub">${escapeHTML(distLine)} · ${escapeHTML(coverage)}</div>
        </div>
        <span class="nb-shop__chev" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </a>
      <ul class="nb-items">${itemRows}</ul>
    </li>
  `;
}
