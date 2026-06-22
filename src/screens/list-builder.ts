import type { Product } from "../lib/types";
import { search, getProduct } from "../lib/catalog";
import { getList, addToList, removeFromList } from "../lib/list";
import { loadSession } from "../lib/session";
import { pushSuggestion } from "../lib/companion";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stockLine(p: Product): string {
  if (p.stock_total === 0) return `<span class="result-card__stock result-card__stock--out">sold out</span>`;
  if (p.stock_front === 0) return `<span class="result-card__stock result-card__stock--back">ask a staffer</span>`;
  return `<span class="result-card__stock result-card__stock--ok">${p.stock_front} on the shelf</span>`;
}

function colorSwatch(color: string): string {
  // Map a few common color words to hex; everything else falls back to a neutral.
  const map: Record<string, string> = {
    black: "#1f1f1f",
    white: "#f5f5f5",
    grey: "#888888",
    gray: "#888888",
    charcoal: "#3a3a3a",
    navy: "#1c2e4a",
    blue: "#3b6db5",
    teal: "#2a9d8f",
    green: "#4a8a3e",
    forest: "#2c6e34",
    red: "#c0392b",
    orange: "#d97928",
    yellow: "#e5b73b",
    purple: "#7a4e9b",
    brown: "#7a5230",
    tan: "#c8a878",
    beige: "#dccba0",
    pink: "#e58aa6",
  };
  const key = color.toLowerCase().split(/[\s/]/)[0] ?? "";
  return map[key] ?? "#a89274";
}

function resultCard(p: Product, alreadyOnList: boolean): string {
  const hasDiscount = p.discount_pct > 0;
  const finalPrice = hasDiscount
    ? (p.price_chf * (1 - p.discount_pct / 100)).toFixed(0)
    : p.price_chf.toFixed(0);
  return `
    <li class="result-card${alreadyOnList ? " result-card--on" : ""}" data-code="${p.product_code}">
      <div class="result-card__row">
        <h3 class="result-card__name">${escapeHTML(p.name)}</h3>
        <button class="result-card__add${alreadyOnList ? " result-card__add--remove" : ""}"
                aria-label="${alreadyOnList ? "Remove from list" : "Add to list"}">
          ${alreadyOnList ? "Remove" : "Add"}
        </button>
      </div>
      <p class="result-card__brand">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</p>
      <div class="result-card__meta">
        <span class="result-card__price">
          ${hasDiscount ? `<s>CHF ${p.price_chf.toFixed(0)}</s> ` : ""}
          <strong>CHF ${finalPrice}</strong>
        </span>
        ${stockLine(p)}
        <span class="result-card__zone">Zone ${escapeHTML(p.zone)} · aisle ${escapeHTML(p.aisle)}</span>
      </div>
    </li>
  `;
}

function cartBar(items: Product[], expanded: boolean): string {
  if (items.length === 0) return "";
  const thumbs = items.slice(0, 3).map((p) => `
    <span class="cart-bar__thumb" style="background:${colorSwatch(p.color)}" title="${escapeHTML(p.name)}"></span>
  `).join("");
  const extra = items.length > 3 ? `<span class="cart-bar__more">+${items.length - 3}</span>` : "";
  return `
    <div class="cart-wrap${expanded ? " cart-wrap--open" : ""}">
      ${expanded ? `
        <ul class="cart-list">
          ${items.map((p) => `
            <li class="cart-list__item">
              <span class="cart-list__swatch" style="background:${colorSwatch(p.color)}"></span>
              <div class="cart-list__body">
                <span class="cart-list__name">${escapeHTML(p.name)}</span>
                <span class="cart-list__sub">${escapeHTML(p.brand)} · ${escapeHTML(p.size)}</span>
              </div>
              <button class="cart-list__remove" data-remove="${p.product_code}" aria-label="Remove">×</button>
            </li>
          `).join("")}
        </ul>
      ` : ""}
      <div class="cart-bar" id="cart-bar">
        <button type="button" class="cart-bar__main" id="cart-bar-toggle" aria-expanded="${expanded}">
          <span class="cart-bar__thumbs">
            ${thumbs}
            ${extra}
          </span>
          <span class="cart-bar__count">${items.length} on your list</span>
        </button>
        <a class="cart-bar__cta" href="?screen=map">Find them ›</a>
      </div>
    </div>
  `;
}

export function renderListBuilder(root: HTMLElement) {
  const activeSession = loadSession();

  root.innerHTML = `
    ${activeSession ? `
    <div class="session-banner" id="session-banner">
      <span>${escapeHTML(activeSession.me.emoji)} Shopping with ${escapeHTML(activeSession.me.name)}, code ${escapeHTML(activeSession.code)}</span>
      <a class="session-banner__btn" href="?screen=connected">Open ›</a>
    </div>` : ""}
    <header>
      <h1>What are you after?</h1>
    </header>
    <main class="screen-list">
      <input id="q" class="search" type="search" inputmode="search" placeholder="Search anything…" autocomplete="off" />
      <ul id="results" class="results-cards"></ul>
    </main>
    <div id="cart-bar-mount"></div>
  `;

  const qEl = root.querySelector("#q") as HTMLInputElement;
  const resultsEl = root.querySelector("#results") as HTMLUListElement;
  const cartMount = root.querySelector("#cart-bar-mount") as HTMLDivElement;
  let cartExpanded = false;

  // Once the list grows to 2+ items, offer the compare tool through Toto.
  // pushSuggestion handles dismissal-tracking; safe to call on every list change.
  function maybeSuggestCompare() {
    if (getList().length >= 2) {
      pushSuggestion({
        id: "compare-2-items",
        text: t("toto.suggest.compare"),
        cta: { label: t("toto.suggest.compare.cta"), href: "?screen=compare" },
      });
    }
  }
  maybeSuggestCompare();

  function listProducts(): Product[] {
    return getList()
      .map((code) => getProduct(code))
      .filter((p): p is Product => Boolean(p));
  }

  function refreshCartBar() {
    const items = listProducts();
    if (items.length === 0) cartExpanded = false;
    cartMount.innerHTML = cartBar(items, cartExpanded);
    // Tell the layout that a floating cart bar is occupying the bottom
    // so Toto's companion bumps up to avoid the collision.
    document.body.classList.toggle("has-cart", items.length > 0);
  }

  cartMount.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest<HTMLButtonElement>("[data-remove]");
    if (removeBtn) {
      e.stopPropagation();
      removeFromList(removeBtn.dataset.remove!);
      refreshCartBar();
      refreshResults();
      return;
    }
    const toggle = target.closest("#cart-bar-toggle");
    if (toggle) {
      cartExpanded = !cartExpanded;
      refreshCartBar();
      return;
    }
  });

  function refreshResults() {
    const q = qEl.value;
    const matches = search(q, 20);
    const onList = new Set(getList());
    if (q.trim() === "") {
      // With no query: if the user has items, render them as cards so
      // the screen isn't a blank canvas. If the list is empty, show a
      // friendly Toto-voiced empty state.
      const listItems = listProducts();
      if (listItems.length === 0) {
        resultsEl.innerHTML = `<li class="empty-state">
          <div class="empty-state__title">Nothing here yet.</div>
          <div class="empty-state__sub">Type a name, size, or brand and I'll look.</div>
        </li>`;
        return;
      }
      // Show current list as cards (already-on-list state).
      resultsEl.innerHTML = listItems.map((p) => resultCard(p, true)).join("");
      return;
    }
    if (matches.length === 0) {
      resultsEl.innerHTML = `<li class="empty-state">
        <div class="empty-state__title">Hmm, nothing matching "${escapeHTML(q)}".</div>
        <div class="empty-state__sub">Try a brand, color, or category.</div>
      </li>`;
      return;
    }
    resultsEl.innerHTML = matches.map((p) => resultCard(p, onList.has(p.product_code))).join("");
  }

  let debounce: number | undefined;
  qEl.addEventListener("input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(refreshResults, 120);
  });

  resultsEl.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest(".result-card") as HTMLLIElement | null;
    if (!li) return;
    const code = li.dataset.code;
    if (!code) return;
    if (li.classList.contains("result-card--on")) {
      removeFromList(code);
    } else {
      addToList(code);
    }
    refreshCartBar();
    refreshResults();
    maybeSuggestCompare();
  });

  refreshCartBar();
  refreshResults();
  qEl.focus();
}
