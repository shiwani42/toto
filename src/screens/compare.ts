import {
  Camera,
  CameraPosition,
  CameraSwitchControl,
  DataCaptureContext,
  DataCaptureView,
  FrameSourceState,
  Feedback,
} from "@scandit/web-datacapture-core";
import {
  barcodeCaptureLoader,
  BarcodeCapture,
  BarcodeCaptureSettings,
  Symbology,
} from "@scandit/web-datacapture-barcode";
import { getProduct } from "../lib/catalog";
import type { Product } from "../lib/types";

const LICENSE_KEY = import.meta.env.VITE_SCANDIT_LICENSE_KEY as
  | string
  | undefined;

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
  // Always frame cheaper -> pricier so the gap is positive.
  const [cheaper, pricier] =
    a.price_chf <= b.price_chf ? [a, b] : [b, a];
  const gap = pricier.price_chf - cheaper.price_chf;

  const reasons: { label: string; delta: string; weight: number }[] = [];

  // Material — biggest single contributor when different
  if (pricier.material !== cheaper.material) {
    reasons.push({
      label: `Material: ${pricier.material} vs ${cheaper.material}`,
      delta: estimateMaterialCost(pricier.material, cheaper.material, gap),
      weight: 0.4,
    });
  }

  // Waterproof rating — big number = expensive membranes
  const wpDelta = pricier.waterproof_rating_mm - cheaper.waterproof_rating_mm;
  if (Math.abs(wpDelta) >= 5000) {
    reasons.push({
      label: `Waterproof: ${pricier.waterproof_rating_mm.toLocaleString()}mm vs ${cheaper.waterproof_rating_mm.toLocaleString()}mm`,
      delta: wpDelta > 0 ? `+~CHF ${Math.round(gap * 0.18)}` : `-~CHF ${Math.round(gap * 0.18)}`,
      weight: 0.18,
    });
  }

  // Temp rating (lower = warmer = more fill / better insulation)
  if (pricier.temp_rating_c != null && cheaper.temp_rating_c != null) {
    const tDelta = cheaper.temp_rating_c - pricier.temp_rating_c; // positive => pricier is warmer
    if (Math.abs(tDelta) >= 5) {
      reasons.push({
        label: `Temp rating: ${pricier.temp_rating_c}°C vs ${cheaper.temp_rating_c}°C`,
        delta: `+~CHF ${Math.round(gap * 0.15)}`,
        weight: 0.15,
      });
    }
  }

  // Weight (lighter = engineered = more expensive)
  const wDelta = pricier.weight_g - cheaper.weight_g;
  if (Math.abs(wDelta) >= 50) {
    reasons.push({
      label: `Weight: ${pricier.weight_g}g vs ${cheaper.weight_g}g${wDelta < 0 ? " (lighter)" : " (heavier)"}`,
      delta: wDelta < 0 ? `+~CHF ${Math.round(gap * 0.12)}` : `-~CHF ${Math.round(Math.abs(gap) * 0.12)}`,
      weight: 0.12,
    });
  }

  // Tags-as-features the pricier has that the cheaper doesn't
  const cheaperTags = new Set(cheaper.tags);
  const extra = pricier.tags.filter((t) => !cheaperTags.has(t) && !["mens", "womens", "unisex", "kids", "demo-book"].includes(t));
  if (extra.length > 0) {
    reasons.push({
      label: `Extra features: ${extra.join(", ")}`,
      delta: `+~CHF ${Math.round(gap * 0.1)}`,
      weight: 0.1,
    });
  }

  // Brand premium = whatever's left
  const accountedRatio = reasons.reduce((s, r) => s + r.weight, 0);
  const brandPremium = Math.max(0, Math.round(gap * (1 - accountedRatio)));
  return { cheaper, pricier, gap, reasons, brandPremium };
}

function estimateMaterialCost(p: string, c: string, gap: number): string {
  // Premium materials usually drive 30-50% of the gap.
  const premium = /gore[- ]?tex|merino|down|leather|3l/i.test(p);
  const cheap = !/gore[- ]?tex|merino|down|leather|3l/i.test(c);
  const ratio = premium && cheap ? 0.4 : 0.3;
  return `+~CHF ${Math.round(gap * ratio)}`;
}

export function renderCompare(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>Where does the price go?</h1>
    </header>
    <main class="screen-compare">
      <div id="status" class="status" hidden></div>
      <div id="capture-view" class="compare-cam"></div>

      <div class="slots">
        <div class="slot" id="slot-A">
          <div class="slot__header">A</div>
          <div class="slot__body">empty</div>
          <button class="slot__btn" data-target="A">Scan slot A</button>
        </div>
        <div class="slot" id="slot-B">
          <div class="slot__header">B</div>
          <div class="slot__body">empty</div>
          <button class="slot__btn" data-target="B">Scan slot B</button>
        </div>
      </div>

      <div id="diff"></div>

      <button id="reset" class="link-btn">Reset both</button>
      <a class="link-btn" href="?screen=list">‹ Back</a>
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
      btn.textContent = `Rescan slot ${slot}`;
      slotEl.classList.add("slot--filled");
    } else {
      body.textContent = "empty";
      btn.textContent = `Scan slot ${slot}`;
      slotEl.classList.remove("slot--filled");
    }
  }

  function renderDiff() {
    if (!products.A || !products.B) {
      diffEl.innerHTML = "";
      return;
    }
    if (products.A.product_code === products.B.product_code) {
      diffEl.innerHTML = `<div class="status">That's the same product in both slots. Scan two different ones to compare.</div>`;
      return;
    }
    const d = explain(products.A, products.B);
    if (d.gap === 0) {
      diffEl.innerHTML = `
        <div class="diff-card">
          <h3>Same price, different gear.</h3>
          <p>${escapeHTML(d.pricier.name)} and ${escapeHTML(d.cheaper.name)} are both CHF ${d.pricier.price_chf.toFixed(0)}.</p>
          <ul>${d.reasons.map((r) => `<li>${escapeHTML(r.label)}</li>`).join("")}</ul>
        </div>
      `;
      return;
    }
    diffEl.innerHTML = `
      <div class="diff-card">
        <h3><strong>${escapeHTML(d.pricier.name)}</strong> costs <strong>CHF ${d.gap.toFixed(0)}</strong> more than ${escapeHTML(d.cheaper.name)}.</h3>
        <p class="diff-card__lead">Here's where that goes:</p>
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
                  <span class="diff-list__label">Brand premium (${escapeHTML(d.pricier.brand)} vs ${escapeHTML(d.cheaper.brand)})</span>
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

  // If we arrived with ?a=CODE (from a contextual prompt elsewhere), pre-fill A.
  const prefilledA = new URLSearchParams(window.location.search).get("a");
  if (prefilledA) {
    const p = getProduct(prefilledA);
    if (p) {
      products.A = p;
      setStatus(`Slot A is ${p.name}. Now scan slot B to compare.`);
    }
  }
  refreshAll();

  // ----- Scanner setup -----

  let initialized = false;
  let barcodeCapture: BarcodeCapture | null = null;
  let activeSlot: Slot | null = null;

  async function initScanner() {
    if (initialized) return;
    if (!LICENSE_KEY) {
      console.error("Scanner license not configured (VITE_SCANDIT_LICENSE_KEY missing).");
      setStatus("The camera isn't ready right now.");
      return;
    }
    setStatus("Warming up the camera…");
    const context = await DataCaptureContext.forLicenseKey(LICENSE_KEY, {
      libraryLocation:
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@8/sdc-lib/",
      moduleLoaders: [barcodeCaptureLoader()],
    });

    const view = new DataCaptureView();
    view.connectToElement(captureViewEl);
    await view.setContext(context);
    view.addControl(new CameraSwitchControl());

    const camera = Camera.pickBestGuessForPosition(CameraPosition.WorldFacing);
    await camera.applySettings(BarcodeCapture.recommendedCameraSettings);
    await context.setFrameSource(camera);
    await camera.switchToDesiredState(FrameSourceState.On);

    const settings = new BarcodeCaptureSettings();
    settings.enableSymbologies([
      Symbology.EAN13UPCA,
      Symbology.EAN8,
      Symbology.UPCE,
      Symbology.QR,
      Symbology.Code128,
      Symbology.Code39,
      Symbology.DataMatrix,
    ]);
    barcodeCapture = await BarcodeCapture.forContext(context, settings);
    const feedback = Feedback.defaultFeedback;

    barcodeCapture.addListener({
      didScan: async (_mode, session) => {
        const barcode = session.newlyRecognizedBarcode;
        if (!barcode || activeSlot == null || !barcodeCapture) return;
        const code = barcode.data ?? "";
        const product = getProduct(code);
        if (!product) {
          setStatus(`I don't have ‘${code}’ in the catalog. Try another barcode.`);
          return;
        }
        products[activeSlot] = product;
        feedback.emit();
        if ("vibrate" in navigator) navigator.vibrate(60);
        await barcodeCapture.setEnabled(false);
        activeSlot = null;
        captureViewEl.classList.remove("compare-cam--active");
        refreshAll();
        setStatus(
          products.A && products.B
            ? "Both in. Here's the breakdown."
            : "Now scan the other one.",
        );
      },
    });

    initialized = true;
  }

  async function startScanning(slot: Slot) {
    await initScanner();
    if (!barcodeCapture) return;
    activeSlot = slot;
    captureViewEl.classList.add("compare-cam--active");
    await barcodeCapture.setEnabled(true);
    setStatus(`Point at a barcode for slot ${slot}.`);
  }

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".slot__btn",
    ) as HTMLButtonElement | null;
    if (!btn) return;
    const slot = btn.dataset.target as Slot | undefined;
    if (slot === "A" || slot === "B") {
      startScanning(slot).catch((err: unknown) => {
        console.error("Compare scanner failed:", err, "hostname:", location.hostname);
        void import("../lib/camera-errors").then(({ cameraErrorMessage }) => {
          setStatus(cameraErrorMessage(err));
        });
      });
    }
  });

  resetEl.addEventListener("click", () => {
    products.A = null;
    products.B = null;
    refreshAll();
    setStatus(`Cleared.`);
  });
}
