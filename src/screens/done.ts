import type { Product } from "../lib/types";
import { getProduct } from "../lib/catalog";
import { clearList, getList } from "../lib/list";

const FOUND_KEY = "toto.found";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readFound(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FOUND_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function row(p: Product, found: boolean): string {
  return `
    <li class="result">
      <div class="result__meta">
        <div class="result__name">${escapeHTML(p.name)}</div>
        <div class="result__sub">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</div>
      </div>
      <span class="badge ${found ? "badge--ok" : "badge--out"}">${found ? "got it" : "still looking"}</span>
    </li>
  `;
}

export function renderDone(root: HTMLElement) {
  const list = getList();
  if (list.length === 0) {
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "list");
    window.location.replace(url.toString());
    return;
  }

  const found = readFound();
  const products = list
    .map((code) => getProduct(code))
    .filter((p): p is Product => Boolean(p));
  const foundProducts = products.filter((p) => found.has(p.product_code));
  const missingProducts = products.filter((p) => !found.has(p.product_code));

  const allFound = missingProducts.length === 0;

  if (allFound) {
    root.innerHTML = `
      <main class="screen-done screen-done--celebrate">
        <div class="done-mark" aria-hidden="true">
          <svg viewBox="0 0 80 80" width="72" height="72" fill="none"
               stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="40" cy="40" r="34"/>
            <path d="M26 41l10 10 18-22"/>
          </svg>
        </div>
        <h1 class="done-headline">That's everything.</h1>
        <p class="done-sub">Nicely done.</p>

        <section class="zone-row done-list">
          <ul class="results" style="max-height:none">
            ${foundProducts.map((p) => row(p, true)).join("")}
          </ul>
        </section>

        <a class="primary" href="?screen=home" style="min-width:240px">Done shopping</a>
        <button class="link-btn" id="new-trip">Start a fresh trip</button>
      </main>
    `;
  } else {
    root.innerHTML = `
      <header>
        <h1>Almost there.</h1>
        <p class="tag">${foundProducts.length} of ${products.length} in the basket. ${missingProducts.length} to go.</p>
      </header>
      <main class="screen-done">
        <section class="zone-row zone-row--first">
          <div class="zone-row__head">
            <span class="zone-row__letter" style="background: var(--bad)">!</span>
            <div class="zone-row__meta">
              <div class="zone-row__name">Still looking for</div>
              <div class="zone-row__sub">${missingProducts.length} thing${missingProducts.length > 1 ? "s" : ""}</div>
            </div>
          </div>
          <ul class="results" style="max-height:none">
            ${missingProducts.map((p) => row(p, false)).join("")}
          </ul>
        </section>

        ${
          foundProducts.length > 0
            ? `
          <section class="zone-row">
            <div class="zone-row__head">
              <span class="zone-row__letter" style="background: var(--ok)">✓</span>
              <div class="zone-row__meta">
                <div class="zone-row__name">In the basket</div>
                <div class="zone-row__sub">${foundProducts.length} thing${foundProducts.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            <ul class="results" style="max-height:none">
              ${foundProducts.map((p) => row(p, true)).join("")}
            </ul>
          </section>
        `
            : ""
        }

        <a class="primary" href="?screen=scan">Keep looking</a>
        <button class="link-btn" id="new-trip">Start a fresh trip</button>
      </main>
    `;
  }

  const newTripBtn = root.querySelector("#new-trip") as HTMLButtonElement;
  newTripBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm("Clear everything and start fresh?")) return;
    clearList();
    sessionStorage.removeItem(FOUND_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "home");
    window.location.href = url.toString();
  });
}
