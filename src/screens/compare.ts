import { getProduct } from "../lib/catalog";
import { startScanner, type ScannerHandle } from "../lib/scanner";
import { cameraErrorMessage } from "../lib/camera-errors";
import type { Product } from "../lib/types";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type Slot = "A" | "B";

type Diff = {
  cheaper: Product;
  pricier: Product;
  gap: number;
  reasons: { label: string; delta: string; weight: number }[];
  brandPremium: number;
};

function explain(a: Product, b: Product): Diff {
  const [cheaper, pricier] = a.price_chf <= b.price_chf ? [a, b] : [b, a];
  const gap = pricier.price_chf - cheaper.price_chf;
  const reasons: { label: string; delta: string; weight: number }[] = [];

  if (pricier.material !== cheaper.material) {
    reasons.push({
      label: `Material: ${pricier.material} vs ${cheaper.material}`,
      delta: estimateMaterialCost(pricier.material, cheaper.material, gap),
      weight: 0.4,
    });
  }

  const wpDelta = pricier.waterproof_rating_mm - cheaper.waterproof_rating_mm;
  if (Math.abs(wpDelta) >= 5000) {
    reasons.push({
      label: `Waterproof: ${pricier.waterproof_rating_mm.toLocaleString()}mm vs ${cheaper.waterproof_rating_mm.toLocaleString()}mm`,
      delta: wpDelta > 0 ? `+~CHF ${Math.round(gap * 0.18)}` : `-~CHF ${Math.round(gap * 0.18)}`,
      weight: 0.18,
    });
  }

  if (pricier.temp_rating_c != null && cheaper.temp_rating_c != null) {
    const tDelta = cheaper.temp_rating_c - pricier.temp_rating_c;
    if (Math.abs(tDelta) >= 5) {
      reasons.push({
        label: `Temp rating: ${pricier.temp_rating_c}°C vs ${cheaper.temp_rating_c}°C`,
        delta: `+~CHF ${Math.round(gap * 0.15)}`,
        weight: 0.15,
      });
    }
  }

  const wDelta = pricier.weight_g - cheaper.weight_g;
  if (Math.abs(wDelta) >= 50) {
    reasons.push({
      label: `Weight: ${pricier.weight_g}g vs ${cheaper.weight_g}g${wDelta < 0 ? " (lighter)" : " (heavier)"}`,
      delta: wDelta < 0 ? `+~CHF ${Math.round(gap * 0.12)}` : `-~CHF ${Math.round(Math.abs(gap) * 0.12)}`,
      weight: 0.12,
    });
  }

  const cheaperTags = new Set(cheaper.tags);
  const extra = pricier.tags.filter((t) => !cheaperTags.has(t) && !["mens", "womens", "unisex", "kids", "demo-book"].includes(t));
  if (extra.length > 0) {
    reasons.push({
      label: `Extra features: ${extra.join(", ")}`,
      delta: `+~CHF ${Math.round(gap * 0.1)}`,
      weight: 0.1,
    });
  }

  const accountedRatio = reasons.reduce((s, r) => s + r.weight, 0);
  const brandPremium = Math.max(0, Math.round(gap * (1 - accountedRatio)));
  return { cheaper, pricier, gap, reasons, brandPremium };
}

function estimateMaterialCost(p: string, c: string, gap: number): string {
  const premium = /gore[- ]?tex|merino|down|leather|3l/i.test(p);
  const cheap = !/gore[- ]?tex|merino|down|leather|3l/i.test(c);
  const ratio = premium && cheap ? 0.4 : 0.3;
  return `+~CHF ${Math.round(gap * ratio)}`;
}

export function renderCompare(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>${t("compare.title")}</h1>
    </header>
    <main class="screen-compare">
      <div id="status" class="status" hidden></div>
      <div id="capture-view" class="compare-cam"></div>

      <div class="slots">
        <div class="slot" id="slot-A">
          <div class="slot__header">A</div>
          <div class="slot__body">${t("compare.empty")}</div>
          <button class="slot__btn" data-target="A">${t("compare.scan_a")}</button>
        </div>
        <div class="slot" id="slot-B">
          <div class="slot__header">B</div>
          <div class="slot__body">${t("compare.empty")}</div>
          <button class="slot__btn" data-target="B">${t("compare.scan_b")}</button>
        </div>
      </div>

      <div id="diff"></div>

      <button id="reset" class="link-btn">${t("compare.reset")}</button>
      <a class="link-btn" href="?screen=list">${t("compare.back")}</a>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const diffEl = root.querySelector("#diff") as HTMLDivElement;
  const resetEl = root.querySelector("#reset") as HTMLButtonElement;

  const products: Record<Slot, Product | null> = { A: null, B: null };

  function setStatus(msg: string) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  function renderSlot(slot: Slot) {
    const slotEl = root.querySelector(`#slot-${slot}`) as HTMLDivElement;
    const body = slotEl.querySelector(".slot__body") as HTMLDivElement;
    const btn = slotEl.querySelector(".slot__btn") as HTMLButtonElement;
    const p = products[slot];
    if (p) {
      body.innerHTML = `
        <div class="slot__name">${escapeHTML(p.name)}</div>
        <div class="slot__sub">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</div>
        <div class="slot__price">CHF ${p.price_chf.toFixed(0)}</div>
      `;
      btn.textContent = slot === "A" ? t("compare.rescan_a") : t("compare.rescan_b");
      slotEl.classList.add("slot--filled");
    } else {
      body.textContent = t("compare.empty");
      btn.textContent = slot === "A" ? t("compare.scan_a") : t("compare.scan_b");
      slotEl.classList.remove("slot--filled");
    }
  }

  function renderDiff() {
    if (!products.A || !products.B) {
      diffEl.innerHTML = "";
      return;
    }
    if (products.A.product_code === products.B.product_code) {
      diffEl.innerHTML = `<div class="status">${t("compare.same")}</div>`;
      return;
    }
    const d = explain(products.A, products.B);
    if (d.gap === 0) {
      diffEl.innerHTML = `
        <div class="diff-card">
          <h3>${t("compare.same_price")}</h3>
          <p>${escapeHTML(d.pricier.name)} and ${escapeHTML(d.cheaper.name)} are both CHF ${d.pricier.price_chf.toFixed(0)}.</p>
          <ul>${d.reasons.map((r) => `<li>${escapeHTML(r.label)}</li>`).join("")}</ul>
        </div>
      `;
      return;
    }
    diffEl.innerHTML = `
      <div class="diff-card">
        <h3><strong>${escapeHTML(d.pricier.name)}</strong> costs <strong>CHF ${d.gap.toFixed(0)}</strong> more than ${escapeHTML(d.cheaper.name)}.</h3>
        <p class="diff-card__lead">${t("compare.lead")}</p>
        <ul class="diff-list">
          ${d.reasons
            .map(
              (r) => `<li>
                <span class="diff-list__label">${escapeHTML(r.label)}</span>
                <span class="diff-list__delta">${escapeHTML(r.delta)}</span>
              </li>`,
            )
            .join("")}
          ${
            d.brandPremium > 0
              ? `<li>
                  <span class="diff-list__label">${t("compare.brand_premium")} (${escapeHTML(d.pricier.brand)} vs ${escapeHTML(d.cheaper.brand)})</span>
                  <span class="diff-list__delta">+~CHF ${d.brandPremium}</span>
                </li>`
              : ""
          }
        </ul>
      </div>
    `;
  }

  function refreshAll() {
    renderSlot("A");
    renderSlot("B");
    renderDiff();
  }

  const prefilledA = new URLSearchParams(window.location.search).get("a");
  if (prefilledA) {
    const p = getProduct(prefilledA);
    if (p) {
      products.A = p;
      setStatus(`${t("compare.now_other")} (${p.name})`);
    }
  }
  refreshAll();

  // ─── Scanner ─────────────────────────────────────────────────────────────

  let handle: ScannerHandle | null = null;
  let activeSlot: Slot | null = null;

  async function ensureScanner(): Promise<void> {
    if (handle) return;
    handle = await startScanner({
      host: captureViewEl,
      onFrame: () => { /* no overlay */ },
      onScan: (code) => {
        if (activeSlot == null) return;
        const product = getProduct(code.text);
        if (!product) {
          setStatus(t("compare.unknown"));
          return;
        }
        products[activeSlot] = product;
        if ("vibrate" in navigator) navigator.vibrate(60);
        activeSlot = null;
        captureViewEl.classList.remove("compare-cam--active");
        refreshAll();
        setStatus(products.A && products.B ? t("compare.both_in") : t("compare.now_other"));
      },
    });
  }

  async function startScanning(slot: Slot) {
    setStatus(t("scan.warming"));
    try {
      await ensureScanner();
    } catch (err) {
      console.error("Compare scanner failed:", err);
      setStatus(cameraErrorMessage(err));
      return;
    }
    activeSlot = slot;
    captureViewEl.classList.add("compare-cam--active");
    setStatus(slot === "A" ? t("compare.aim_a") : t("compare.aim_b"));
  }

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".slot__btn") as HTMLButtonElement | null;
    if (!btn) return;
    const slot = btn.dataset.target as Slot | undefined;
    if (slot === "A" || slot === "B") {
      void startScanning(slot);
    }
  });

  resetEl.addEventListener("click", () => {
    products.A = null;
    products.B = null;
    refreshAll();
    setStatus(t("compare.cleared"));
  });

  window.addEventListener("pagehide", () => { handle?.stop(); }, { once: true });
}
