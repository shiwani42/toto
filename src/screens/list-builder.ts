import type { Product } from "../lib/types";
import { search, getProduct } from "../lib/catalog";
import { getList, addToList, removeFromList } from "../lib/list";
import { loadSession } from "../lib/session";

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
    <li class="result-card" data-code="${p.product_code}">
      <div class="result-card__row">
        <h3 class="result-card__name">${escapeHTML(p.name)}</h3>
        <button class="result-card__add" ${alreadyOnList ? "disabled" : ""} aria-label="${alreadyOnList ? "On your list" : "Add to list"}">
          ${alreadyOnList ? "On list ✓" : "Add"}
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

function cartBar(items: Product[]): string {
  if (items.length === 0) return "";
  const thumbs = items.slice(0, 3).map((p) => `
    <span class="cart-bar__thumb" style="background:${colorSwatch(p.color)}" title="${escapeHTML(p.name)}"></span>
  `).join("");
  const extra = items.length > 3 ? `<span class="cart-bar__more">+${items.length - 3}</span>` : "";
  return `
    <a class="cart-bar" href="?screen=map" id="cart-bar">
      <span class="cart-bar__thumbs">
        ${thumbs}
        ${extra}
      </span>
      <span class="cart-bar__count">${items.length} on your list</span>
      <span class="cart-bar__cta">Find them ›</span>
    </a>
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

  function listProducts(): Product[] {
    return getList()
      .map((code) => getProduct(code))
      .filter((p): p is Product => Boolean(p));
  }

  function refreshCartBar() {
    cartMount.innerHTML = cartBar(listProducts());
  }

  function refreshResults() {
    const q = qEl.value;
    const matches = search(q, 20);
    const onList = new Set(getList());
    if (q.trim() === "") {
      resultsEl.innerHTML = "";
      return;
    }
    if (matches.length === 0) {
      resultsEl.innerHTML = `<li class="hint">Nothing matching <code>${escapeHTML(q)}</code>.</li>`;
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
    const btn = li.querySelector(".result-card__add") as HTMLButtonElement;
    if (btn.disabled) {
      // Tapping an already-added item removes it.
      removeFromList(code);
    } else {
      addToList(code);
    }
    refreshCartBar();
    refreshResults();
  });

  refreshCartBar();
  refreshResults();
  qEl.focus();
}
