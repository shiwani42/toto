// Shop directory: browse every shop on the platform (anon read),
// filter by name / city / slug, then enter one. Complements slug
// entry on Home and list-based nearby search.

import { icon } from "../lib/icons";
import { t } from "../lib/i18n";
import {
  fetchAllShops,
  setActiveShop,
  getActiveShop,
  type Shop,
} from "../lib/shops";
import { primeCatalog } from "../lib/catalog";
import { supabaseConfigured } from "../lib/supabase";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shopLocation(s: Shop): string {
  const parts = [s.city, s.country].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (s.address) return s.address;
  return "";
}

function matchesQuery(s: Shop, q: string): boolean {
  if (!q) return true;
  const hay = [s.name, s.slug, s.city, s.country, s.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

async function enterShop(shop: Shop) {
  setActiveShop(shop);
  await primeCatalog(shop.id);
  const url = new URL(window.location.href);
  url.searchParams.set("shop", shop.slug);
  url.searchParams.set("screen", "home");
  window.location.href = url.toString();
}

function renderShopRow(s: Shop, activeId: string | null): string {
  const loc = shopLocation(s);
  const isActive = activeId === s.id;
  return `
    <li class="shops-dir__item${isActive ? " shops-dir__item--active" : ""}">
      <button type="button" class="shops-dir__btn" data-slug="${escapeHTML(s.slug)}">
        <span class="shops-dir__icon" aria-hidden="true">${icon("store", 20)}</span>
        <span class="shops-dir__body">
          <span class="shops-dir__name">${escapeHTML(s.name)}</span>
          <span class="shops-dir__meta">
            ${loc ? escapeHTML(loc) + " · " : ""}
            <span class="shops-dir__slug">${escapeHTML(s.slug)}</span>
          </span>
        </span>
        <span class="shops-dir__chev" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </button>
    </li>
  `;
}

export function renderShops(root: HTMLElement) {
  const active = getActiveShop();

  root.innerHTML = `
    <header class="shops-dir__header">
      <a class="link-btn shops-dir__back" href="?screen=home">${escapeHTML(t("shops.back"))}</a>
      <h1>${escapeHTML(t("shops.title"))}</h1>
      <p class="tag" id="shops-tag">${escapeHTML(t("shops.loading"))}</p>
    </header>
    <main class="screen-list shops-dir">
      <label class="shops-dir__search-wrap">
        <span class="sr-only">${escapeHTML(t("shops.search"))}</span>
        <input id="shops-search" type="search" autocomplete="off"
               placeholder="${escapeHTML(t("shops.search"))}"
               class="shops-dir__search" disabled />
      </label>
      <div id="shops-results">
        <div class="admin-skeleton">
          <div class="admin-skeleton__block"></div>
          <div class="admin-skeleton__block"></div>
        </div>
      </div>
    </main>
  `;

  const tagEl = root.querySelector("#shops-tag") as HTMLParagraphElement;
  const resultsEl = root.querySelector("#shops-results") as HTMLDivElement;
  const searchEl = root.querySelector("#shops-search") as HTMLInputElement;

  if (!supabaseConfigured) {
    tagEl.textContent = "";
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">${escapeHTML(t("shops.unavailable"))}</div>
        <div class="empty-state__sub">${escapeHTML(t("shops.unavailable.sub"))}</div>
      </div>
    `;
    return;
  }

  let allShops: Shop[] = [];

  function paint(query: string) {
    const q = query.trim().toLowerCase();
    const filtered = allShops.filter((s) => matchesQuery(s, q));
    if (filtered.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">${escapeHTML(t("shops.empty"))}</div>
          <div class="empty-state__sub">${escapeHTML(t("shops.empty.sub"))}</div>
        </div>
      `;
      tagEl.textContent = t("shops.count").replace("{n}", "0");
      return;
    }
    tagEl.textContent = t("shops.count").replace("{n}", String(filtered.length));
    resultsEl.innerHTML = `
      <ul class="shops-dir__list" role="list">
        ${filtered.map((s) => renderShopRow(s, active?.id ?? null)).join("")}
      </ul>
    `;
    resultsEl.querySelectorAll<HTMLButtonElement>("[data-slug]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slug = btn.dataset.slug;
        if (!slug) return;
        btn.disabled = true;
        tagEl.textContent = t("home.shop.loading");
        const shop = allShops.find((s) => s.slug === slug);
        if (!shop) {
          tagEl.textContent = t("home.shop.notfound");
          btn.disabled = false;
          return;
        }
        try {
          await enterShop(shop);
        } catch {
          tagEl.textContent = t("home.shop.notfound");
          btn.disabled = false;
        }
      });
    });
  }

  void (async () => {
    allShops = await fetchAllShops();
    if (allShops.length === 0) {
      tagEl.textContent = "";
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">${escapeHTML(t("shops.empty"))}</div>
          <div class="empty-state__sub">${escapeHTML(t("shops.empty.sub"))}</div>
        </div>
      `;
      return;
    }
    searchEl.disabled = false;
    paint("");
    searchEl.addEventListener("input", () => paint(searchEl.value));
    searchEl.focus();
  })();
}
