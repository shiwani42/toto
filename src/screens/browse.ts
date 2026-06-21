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
import { addToList, getList } from "../lib/list";
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
        ${alreadyOnList ? "Already on your list" : "Add to my list"}
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
      <a class="link-btn browse-card__again" href="#">Scan another</a>
    </article>
  `;
}

export function renderBrowse(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>Just look around</h1>
    </header>
    <main class="screen-browse">
      <div id="status" class="status" hidden></div>
      <div id="capture-view" class="browse-cam"></div>
      <div id="result"></div>
      <a class="link-btn" href="?screen=home">‹ Back home</a>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const resultEl = root.querySelector("#result") as HTMLDivElement;

  function setStatus(msg: string) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  function showResult(html: string) {
    resultEl.innerHTML = html;
  }

  let barcodeCapture: BarcodeCapture | null = null;

  async function boot() {
    if (!LICENSE_KEY) {
      console.error("Scanner license not configured (VITE_SCANDIT_LICENSE_KEY missing).");
      setStatus("The camera isn't ready right now.");
      return;
    }

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
        if (!barcode || !barcodeCapture) return;
        const code = barcode.data ?? "";
        const product = getProduct(code);
        if (!product) {
          setStatus(`I don't recognise ‘${code}’. Try another barcode.`);
          return;
        }
        feedback.emit();
        if ("vibrate" in navigator) navigator.vibrate(60);
        await barcodeCapture.setEnabled(false);
        captureViewEl.classList.remove("browse-cam--active");
        const onList = getList().includes(product.product_code);
        showResult(productCard(product, onList));
        setStatus("");
      },
    });

    captureViewEl.classList.add("browse-cam--active");
    await barcodeCapture.setEnabled(true);
    setStatus("Point at any barcode in the store.");
  }

  resultEl.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const addBtn = target.closest(".browse-card__add") as HTMLButtonElement | null;
    if (addBtn && !addBtn.disabled) {
      const code = addBtn.dataset.code;
      if (code) {
        addToList(code);
        addBtn.disabled = true;
        addBtn.textContent = "Added";
      }
      return;
    }
    const again = target.closest(".browse-card__again") as HTMLAnchorElement | null;
    if (again) {
      e.preventDefault();
      resultEl.innerHTML = "";
      if (barcodeCapture) {
        captureViewEl.classList.add("browse-cam--active");
        await barcodeCapture.setEnabled(true);
        setStatus("");
      }
    }
  });

  boot().catch((err: unknown) => {
    console.error("Browse boot failed:", err, "hostname:", location.hostname);
    void import("../lib/camera-errors").then(({ cameraErrorMessage }) => {
      setStatus(cameraErrorMessage(err));
    });
  });
}
