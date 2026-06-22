import { getProduct } from "../lib/catalog";
import { addToList, getList } from "../lib/list";
import { startScanner, type ScannerHandle } from "../lib/scanner";
import { cameraErrorMessage } from "../lib/camera-errors";
import type { Product } from "../lib/types";
import { t } from "../lib/i18n";
import { pushSuggestion } from "../lib/companion";
import { remarkFor } from "../lib/history";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stockLine(p: Product): string {
  if (p.stock_total === 0) return "sold out";
  if (p.stock_front === 0) return "in the back, ask a staffer";
  return `${p.stock_front} on the shelf in Zone ${p.zone}`;
}

function productCard(p: Product, alreadyOnList: boolean): string {
  const price = p.discount_pct > 0
    ? `<s style="opacity:0.5">CHF ${p.price_chf.toFixed(0)}</s> <strong>CHF ${(p.price_chf * (1 - p.discount_pct / 100)).toFixed(0)}</strong>`
    : `<strong>CHF ${p.price_chf.toFixed(0)}</strong>`;
  return `
    <article class="browse-card">
      <header class="browse-card__head">
        <h3 class="browse-card__name">${escapeHTML(p.name)}</h3>
        <p class="browse-card__brand">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</p>
      </header>
      <div class="browse-card__price">${price}</div>
      <p class="browse-card__stock">${escapeHTML(stockLine(p))}</p>
      ${p.material ? `<p class="browse-card__detail"><span class="browse-card__label">Made of</span> ${escapeHTML(p.material)}</p>` : ""}
      ${p.weight_g ? `<p class="browse-card__detail"><span class="browse-card__label">Weight</span> ${p.weight_g} g</p>` : ""}
      ${p.waterproof_rating_mm ? `<p class="browse-card__detail"><span class="browse-card__label">Waterproof</span> ${p.waterproof_rating_mm.toLocaleString()} mm</p>` : ""}
      ${p.temp_rating_c != null ? `<p class="browse-card__detail"><span class="browse-card__label">Comfortable to</span> ${p.temp_rating_c}°C</p>` : ""}
      ${p.description ? `<p class="browse-card__desc">${escapeHTML(p.description)}</p>` : ""}
      <button class="primary browse-card__add" data-code="${escapeHTML(p.product_code)}" ${alreadyOnList ? "disabled" : ""}>
        ${alreadyOnList ? t("browse.already") : t("browse.add")}
      </button>
      <div class="browse-card__more">
        <a class="browse-card__more-chip" href="?screen=compare&a=${escapeHTML(p.product_code)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 3l4 4-4 4"/><path d="M3 7h18"/>
            <path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>
          </svg>
          Compare with another
        </a>
        <a class="browse-card__more-chip" href="?screen=repair&code=${escapeHTML(p.product_code)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Repair vs replace
        </a>
      </div>
      <a class="link-btn browse-card__again" href="#">${t("browse.scan_another")}</a>
    </article>
  `;
}

export function renderBrowse(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>${t("browse.title")}</h1>
    </header>
    <main class="screen-browse">
      <div id="status" class="status" hidden></div>
      <div id="capture-view" class="browse-cam">
        <div id="cam-fallback" class="cam-fallback" hidden>
          <span class="cam-fallback__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
          <p class="cam-fallback__title">${escapeHTML(t("browse.fallback.title"))}</p>
          <p class="cam-fallback__sub" id="cam-fallback-sub">${escapeHTML(t("browse.fallback.sub"))}</p>
          <button type="button" id="cam-retry" class="cam-fallback__btn">${escapeHTML(t("browse.fallback.retry"))}</button>
        </div>
      </div>
      <div id="result"></div>
      <a class="link-btn" href="?screen=home">${t("browse.back")}</a>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const resultEl = root.querySelector("#result") as HTMLDivElement;
  const fallbackEl = root.querySelector("#cam-fallback") as HTMLDivElement;
  const fallbackSubEl = root.querySelector("#cam-fallback-sub") as HTMLParagraphElement;
  const retryBtn = root.querySelector("#cam-retry") as HTMLButtonElement;

  function setStatus(msg: string) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  function showFallback(sub?: string) {
    fallbackEl.hidden = false;
    captureViewEl.classList.remove("browse-cam--active");
    if (sub) fallbackSubEl.textContent = sub;
  }
  function hideFallback() {
    fallbackEl.hidden = true;
  }

  let handle: ScannerHandle | null = null;
  let paused = false;

  function showResult(html: string) {
    resultEl.innerHTML = html;
  }

  async function boot() {
    setStatus("Warming up the camera…");
    hideFallback();
    // If the camera takes more than ~5s to come up, surface the
    // fallback. On real devices this is a long wait — most likely the
    // permission prompt is hanging or the browser is unhappy. The
    // user shouldn't be staring at a gray rectangle indefinitely.
    const slowTimer = window.setTimeout(() => {
      if (!captureViewEl.classList.contains("browse-cam--active")) {
        setStatus("");
        showFallback(t("browse.fallback.slow"));
      }
    }, 5000);
    try {
      handle = await startScanner({
        host: captureViewEl,
        // dedupe is on by default, so the same code won't fire repeatedly
        onFrame: () => { /* no overlay on browse */ },
        onScan: (code) => {
          if (paused) return;
          const product = getProduct(code.text);
          if (!product) {
            setStatus(t("browse.unknown"));
            return;
          }
          if ("vibrate" in navigator) navigator.vibrate(60);
          paused = true;
          captureViewEl.classList.remove("browse-cam--active");
          const onList = getList().includes(product.product_code);
          showResult(productCard(product, onList));
          setStatus("");
          // Personalized remark (only fires if there's actual history).
          // Otherwise fall back to the repair suggestion below.
          const remark = remarkFor(product.product_code);
          if (remark) {
            pushSuggestion({
              id: `remark-${product.product_code}`,
              text: remark,
            });
          } else {
            pushSuggestion({
              id: "repair-after-browse",
              text: t("toto.suggest.repair"),
              cta: { label: t("toto.suggest.repair.cta"), href: `?screen=repair&code=${product.product_code}` },
            });
          }
        },
      });
      window.clearTimeout(slowTimer);
      captureViewEl.classList.add("browse-cam--active");
      setStatus(t("browse.hint"));
    } catch (err) {
      window.clearTimeout(slowTimer);
      console.error("Browse boot failed:", err);
      // Camera failed to start — the empty gray box would feel broken,
      // so swap in a friendly fallback with a retry button.
      setStatus("");
      showFallback(cameraErrorMessage(err));
    }
  }

  retryBtn.addEventListener("click", () => {
    void boot();
  });

  resultEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const addBtn = target.closest(".browse-card__add") as HTMLButtonElement | null;
    if (addBtn && !addBtn.disabled) {
      const code = addBtn.dataset.code;
      if (code) {
        addToList(code, "browse");
        addBtn.disabled = true;
        addBtn.textContent = "Added";
      }
      return;
    }
    const again = target.closest(".browse-card__again") as HTMLAnchorElement | null;
    if (again) {
      e.preventDefault();
      resultEl.innerHTML = "";
      paused = false;
      captureViewEl.classList.add("browse-cam--active");
      setStatus(t("browse.hint"));
    }
  });

  void boot();
  window.addEventListener("pagehide", () => { handle?.stop(); }, { once: true });
}
