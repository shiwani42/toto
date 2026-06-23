import type { Product } from "../lib/types";
import { getProduct } from "../lib/catalog";
import { clearList, getList } from "../lib/list";
import { totoMascot } from "../lib/toto";
import { getPrefs, setPrefs } from "../lib/prefs";
import { t } from "../lib/i18n";
import { recordTrip } from "../lib/history";
import { playComplete } from "../lib/sounds";

const FOUND_KEY = "toto.found";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Render ~14 paw-print confetti pieces, each with a randomized start
 *  position, drift, rotation, and fall delay. Cheap, no canvas needed. */
function pawConfettiHTML(): string {
  const pieces: string[] = [];
  // Deterministic-ish (uses Math.random) — runs once per render which is
  // exactly when we want a fresh shuffle.
  for (let i = 0; i < 14; i++) {
    const left = Math.round(5 + Math.random() * 90);
    const delay = Math.round(Math.random() * 600);
    const dur = 1400 + Math.round(Math.random() * 900);
    const rot = Math.round((Math.random() - 0.5) * 360);
    const sway = Math.round((Math.random() - 0.5) * 60);
    pieces.push(`
      <span class="paw-confetti__piece"
            style="left:${left}%; animation-delay:${delay}ms;
                   animation-duration:${dur}ms;
                   --paw-sway:${sway}px; --paw-rot:${rot}deg;">
        🐾
      </span>
    `);
  }
  return pieces.join("");
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

/** A short warm line per product that makes the trip feel personal rather
 *  than a packing-list checkmark. Drawn from product attributes. */
function joyLine(p: Product): string {
  if (p.waterproof_rating_mm && p.waterproof_rating_mm >= 15000)
    return "ready for proper weather";
  if (p.temp_rating_c != null && p.temp_rating_c <= -5)
    return "warm for cold nights";
  if (p.weight_g && p.weight_g <= 200 && /jacket|shell|fleece/i.test(p.category))
    return "light enough to forget you're wearing it";
  if (/sock|glove|hat|beanie/i.test(p.category))
    return "small, gets used every trip";
  if (/boot|shoe/i.test(p.category))
    return "your feet will thank you";
  if (/pack|bag/i.test(p.category))
    return "your carry-everything";
  return "good pick";
}

function row(p: Product, found: boolean): string {
  return `
    <li class="result">
      <div class="result__meta">
        <div class="result__name">${escapeHTML(p.name)}</div>
        <div class="result__sub">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</div>
        ${found ? `<div class="result__joy">${escapeHTML(joyLine(p))}</div>` : ""}
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

  // Record the trip on the way out. Only the things they actually took
  // (found in store) get remembered. This is what powers "you went for
  // navy last time" on future visits.
  if (foundProducts.length > 0) {
    recordTrip(foundProducts.map((p) => p.product_code));
  }

  // Pull together what sizes the user has tried inside this list, so the
  // "remember my sizes" CTA only appears when there's actually a size to
  // capture that isn't already in their profile.
  const prefs = getPrefs();
  const inferableSizes: Partial<{ topSize: string; bottomSize: string; shoeSizeEU: number }> = {};
  for (const p of foundProducts) {
    if (/jacket|shirt|fleece|hoodie|insulator|shell|tee|baselayer/i.test(p.category) && !prefs.topSize && /^(XS|S|M|L|XL)$/.test(p.size)) {
      inferableSizes.topSize = p.size;
    } else if (/pant|short|legging|trouser/i.test(p.category) && !prefs.bottomSize && /^(XS|S|M|L|XL)$/.test(p.size)) {
      inferableSizes.bottomSize = p.size;
    } else if (/boot|shoe|sock|runner/i.test(p.category) && !prefs.shoeSizeEU) {
      const n = parseInt(p.size, 10);
      if (Number.isFinite(n) && n >= 35 && n <= 50) inferableSizes.shoeSizeEU = n;
    }
  }
  const offerSaveSizes = Object.keys(inferableSizes).length > 0;

  const headline = allFound ? t("done.headline.all") : t("done.headline.some").replace("{n}", String(foundProducts.length)).replace("{total}", String(products.length));
  const sub = allFound ? t("done.sub.all") : t("done.sub.some");

  root.innerHTML = `
    <main class="screen-done ${allFound ? "screen-done--celebrate" : ""}">
      ${allFound ? `<div class="paw-confetti" aria-hidden="true">${pawConfettiHTML()}</div>` : ""}
      <section class="done-card">
        <div class="done-toto ${allFound ? "done-toto--celebrate" : ""}" aria-hidden="true">${totoMascot(120)}</div>
        <h1 class="done-headline">${escapeHTML(headline)}</h1>
        <p class="done-sub">${escapeHTML(sub)}</p>
      </section>

      ${foundProducts.length > 0 ? `
        <section class="done-section done-section--found">
          <h2 class="done-section__title">${t("done.in_basket")}</h2>
          <ul class="results">
            ${foundProducts.map((p) => row(p, true)).join("")}
          </ul>
        </section>
      ` : ""}

      ${missingProducts.length > 0 ? `
        <section class="done-section done-section--missing">
          <h2 class="done-section__title">${t("done.still_looking")}</h2>
          <ul class="results">
            ${missingProducts.map((p) => row(p, false)).join("")}
          </ul>
          <a class="link-btn" href="?screen=scan">${t("done.keep_looking")}</a>
        </section>
      ` : ""}

      ${offerSaveSizes ? `
        <section class="done-card done-remember">
          <div>
            <div class="done-remember__title">${t("done.remember.title")}</div>
            <div class="done-remember__sub">${
              [
                inferableSizes.topSize ? `${t("settings.sizes.top")}: ${inferableSizes.topSize}` : "",
                inferableSizes.bottomSize ? `${t("settings.sizes.bottom")}: ${inferableSizes.bottomSize}` : "",
                inferableSizes.shoeSizeEU ? `${t("settings.sizes.shoe")}: ${inferableSizes.shoeSizeEU}` : "",
              ].filter(Boolean).join(" · ")
            }</div>
          </div>
          <button type="button" id="remember-sizes" class="primary done-remember__btn">${t("done.remember.yes")}</button>
        </section>
      ` : ""}

      <div class="done-actions">
        <a class="primary" href="?screen=home">${t("done.head_home")}</a>
        <button class="link-btn" id="new-trip">${t("done.fresh")}</button>
      </div>
    </main>
  `;

  // Fire the celebration sound + dance on all-found.
  if (allFound) {
    window.setTimeout(() => playComplete(), 280);
  }

  if (offerSaveSizes) {
    const btn = root.querySelector("#remember-sizes") as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const patch: Record<string, string | number> = {};
      if (inferableSizes.topSize)    patch.topSize     = inferableSizes.topSize;
      if (inferableSizes.bottomSize) patch.bottomSize  = inferableSizes.bottomSize;
      if (inferableSizes.shoeSizeEU) patch.shoeSizeEU  = inferableSizes.shoeSizeEU;
      patch.sizeSource = "manual";
      setPrefs(patch);
      btn.textContent = t("done.remember.done");
      btn.disabled = true;
    });
  }

  const newTripBtn = root.querySelector("#new-trip") as HTMLButtonElement;
  newTripBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm(t("done.fresh.confirm"))) return;
    clearList();
    sessionStorage.removeItem(FOUND_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "home");
    window.location.href = url.toString();
  });
}
