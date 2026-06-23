import storeMapUrl from "../../data/store-map.png";
import { getList } from "../lib/list";
import { getProduct, zonesForCodes } from "../lib/catalog";
import type { Product } from "../lib/types";
import { t } from "../lib/i18n";

// Pin positions on the store-map.png, as percentages of width/height.
// Map layout (3 columns):
//   left:   C (top) - B (mid) - A (bot)
//   center: F (upper-mid) - G (lower-mid)
//   right:  D (top) - E (mid) - Checkout (bot)
const ZONE_POS: Record<string, { x: number; y: number }> = {
  C: { x: 21, y: 38 },
  B: { x: 21, y: 60 },
  A: { x: 21, y: 82 },
  F: { x: 52, y: 42 },
  G: { x: 52, y: 75 },
  D: { x: 82, y: 38 },
  E: { x: 82, y: 60 },
};
// Endpoints used by the routing — entry is bottom-center (the store door),
// checkout is bottom-right where the till sits.
const ENTRY    = { x: 50, y: 95 };
const CHECKOUT = { x: 82, y: 92 };

const CURRENT_LOC_KEY = "toto.currentLoc";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── Routing ────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Held-Karp dynamic-programming TSP: shortest path from `start` through
 *  every node in `nodes` ending at `end`. Exact, O(n² · 2ⁿ). For our typical
 *  5–10 zones this finishes in well under a millisecond. */
function shortestPath(start: Pt, nodes: { key: string; pt: Pt }[], end: Pt): string[] {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [nodes[0].key];

  const full = (1 << n) - 1;
  // dp[mask][last] = { cost, prev }
  // mask is a bitset of visited nodes, last is the index of the node we
  // arrived at last. cost is the total walk from `start` through mask to last.
  const dp: Array<Array<{ cost: number; prev: number } | null>> =
    Array.from({ length: 1 << n }, () => Array<null>(n).fill(null));

  for (let i = 0; i < n; i++) {
    dp[1 << i][i] = { cost: dist(start, nodes[i].pt), prev: -1 };
  }
  for (let mask = 1; mask <= full; mask++) {
    for (let last = 0; last < n; last++) {
      const cell = dp[mask][last];
      if (!cell) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const nm = mask | (1 << next);
        const nc = cell.cost + dist(nodes[last].pt, nodes[next].pt);
        const cur = dp[nm][next];
        if (!cur || nc < cur.cost) dp[nm][next] = { cost: nc, prev: last };
      }
    }
  }

  // Pick best end-node, considering distance to checkout.
  let bestLast = -1, bestCost = Infinity;
  for (let i = 0; i < n; i++) {
    const cell = dp[full][i];
    if (!cell) continue;
    const total = cell.cost + dist(nodes[i].pt, end);
    if (total < bestCost) { bestCost = total; bestLast = i; }
  }
  if (bestLast === -1) return nodes.map((n) => n.key);

  const order: number[] = [];
  let mask = full, last = bestLast;
  while (last !== -1) {
    order.push(last);
    const cell = dp[mask][last];
    if (!cell) break;
    const prev = cell.prev;
    mask &= ~(1 << last);
    last = prev;
  }
  return order.reverse().map((i) => nodes[i].key);
}

// ─── Render ─────────────────────────────────────────────────────────────────

export function renderMap(root: HTMLElement) {
  const list = getList();

  if (list.length === 0) {
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "list");
    window.location.replace(url.toString());
    return;
  }

  // Current location: a zone code the user last tapped, or null = entry.
  const currentLoc = sessionStorage.getItem(CURRENT_LOC_KEY);
  const startPt = currentLoc && ZONE_POS[currentLoc] ? ZONE_POS[currentLoc] : ENTRY;
  const startLabel = currentLoc && ZONE_POS[currentLoc] ? `Zone ${currentLoc}` : t("map.entry");

  const zoneAgg = zonesForCodes(list);
  const routeNodes = zoneAgg
    .filter((z) => ZONE_POS[z.zone] && z.zone !== currentLoc)
    .map((z) => ({ key: z.zone, pt: ZONE_POS[z.zone] }));

  const order = shortestPath(startPt, routeNodes, CHECKOUT);

  // Re-attach metadata to the ordered list of zones to drive the row UI.
  const zones = order.map((key) => zoneAgg.find((z) => z.zone === key)!).filter(Boolean);

  // Group resolved products by zone for the per-zone item lists.
  const byZone = new Map<string, Product[]>();
  for (const code of list) {
    const p = getProduct(code);
    if (!p) continue;
    const arr = byZone.get(p.zone);
    if (arr) arr.push(p);
    else byZone.set(p.zone, [p]);
  }

  // Build the full polyline including endpoints.
  const pathPts: Pt[] = [startPt, ...order.map((k) => ZONE_POS[k]), CHECKOUT];
  const pathStr = pathPts.map((p) => `${p.x},${p.y}`).join(" ");
  const pathDistance = (() => {
    let d = 0;
    for (let i = 1; i < pathPts.length; i++) d += dist(pathPts[i - 1], pathPts[i]);
    // Scale percentage-units to a rough metre estimate (eyeballed: ~30m diagonal).
    return Math.round(d * 0.4);
  })();

  const pins = zones
    .map(({ zone, count }, i) => {
      const pos = ZONE_POS[zone];
      if (!pos) return "";
      return `
        <button type="button" class="zone-pin" data-set-current="${zone}" style="left:${pos.x}%; top:${pos.y}%" aria-label="Set current location to zone ${zone}">
          <span class="zone-pin__order">${i + 1}</span>
          <span class="zone-pin__letter">${zone}</span>
          <span class="zone-pin__count" aria-label="${count} item${count > 1 ? "s" : ""}">${count}</span>
        </button>
      `;
    })
    .join("");

  // Start + checkout markers, on the route SVG layer below the pins.
  const startMarker = currentLoc && ZONE_POS[currentLoc]
    ? `<circle cx="${startPt.x}" cy="${startPt.y}" r="3.4" class="route-start"/>`
    : `<circle cx="${ENTRY.x}" cy="${ENTRY.y}" r="3.4" class="route-start"/>`;

  const rows = zones
    .map(({ zone, zone_name, count }, i) => {
      const items = byZone.get(zone) ?? [];
      return `
        <li>
          <a class="zone-row${i === 0 ? " zone-row--first" : ""}" href="?screen=scan&zone=${zone}">
            <div class="zone-row__head">
              <span class="zone-row__letter">${i + 1}</span>
              <div class="zone-row__meta">
                <div class="zone-row__name">Zone ${zone} · ${escapeHTML(zone_name)}</div>
                <div class="zone-row__sub">${count} item${count > 1 ? "s" : ""}</div>
              </div>
              <span class="zone-row__chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </span>
            </div>
            <ul class="zone-items">
              ${items
                .map(
                  (p) =>
                    `<li>
                       <span class="zone-items__name">${escapeHTML(p.name)}</span>
                       <span class="zone-items__sub">· ${escapeHTML(p.size)} · aisle ${escapeHTML(p.aisle)}</span>
                     </li>`,
                )
                .join("")}
            </ul>
          </a>
        </li>
      `;
    })
    .join("");

  root.innerHTML = `
    <header>
      <h1>${t("map.title")}</h1>
      <p class="tag">${list.length} ${list.length === 1 ? "item" : "items"} · ${pathDistance} m walk · ${t("map.from")} ${escapeHTML(startLabel)}</p>
    </header>
    <main class="screen-map">
      <div class="map-wrap">
        <img src="${storeMapUrl}" class="map-img" alt="Store map" />
        <svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${pathStr}" class="route-line"/>
          ${startMarker}
          <circle cx="${CHECKOUT.x}" cy="${CHECKOUT.y}" r="3.4" class="route-end"/>
        </svg>
        <div class="pin-layer">${pins}</div>
      </div>

      <p class="map-hint">${t("map.hint")}</p>

      <ul class="zone-list">${rows}</ul>

      <div class="map-actions">
        ${currentLoc ? `<button type="button" id="reset-loc" class="link-btn">${t("map.from_entry")}</button>` : ""}
        <a class="link-btn" href="?screen=list">${t("map.tweak")}</a>
      </div>
    </main>
  `;

  // Tap a pin to set current location, then re-render with the recomputed route.
  root.querySelectorAll<HTMLButtonElement>("[data-set-current]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const zone = btn.dataset.setCurrent!;
      sessionStorage.setItem(CURRENT_LOC_KEY, zone);
      renderMap(root);
    });
  });

  const resetBtn = root.querySelector("#reset-loc") as HTMLButtonElement | null;
  resetBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(CURRENT_LOC_KEY);
    renderMap(root);
  });
}
