import {
  Camera,
  CameraSwitchControl,
  Color,
  DataCaptureContext,
  DataCaptureView,
  FrameSourceState,
} from "@scandit/web-datacapture-core";
import {
  barcodeCaptureLoader,
  BarcodeCapture,
  BarcodeFind,
  BarcodeFindItem,
  BarcodeFindItemContent,
  BarcodeFindItemSearchOptions,
  BarcodeFindSettings,
  BarcodeFindView,
  BarcodeFindViewSettings,
  Symbology,
} from "@scandit/web-datacapture-barcode";
import { getList } from "../lib/list";
import { getProduct } from "../lib/catalog";
import { announce } from "../lib/prefs";

const LICENSE_KEY = import.meta.env.VITE_SCANDIT_LICENSE_KEY as
  | string
  | undefined;

const FOUND_KEY = "toto.found";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderScan(root: HTMLElement) {
  const list = getList();
  if (list.length === 0) {
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "list");
    window.location.replace(url.toString());
    return;
  }

  const zoneParam =
    new URLSearchParams(window.location.search).get("zone") ?? "";

  root.innerHTML = `
    <header>
      <h1>${zoneParam ? `You're at Zone ${escapeHTML(zoneParam)}.` : "Ready to scan."}</h1>
    </header>
    <main class="screen-scan">
      <div id="status" class="status" style="display:none"></div>
      <div class="scan-viewport">
        <div id="capture-view" class="scan-view"></div>
        <div id="scan-start-overlay" class="scan-start-overlay">
          <div class="scan-start-ripple"></div>
          <button id="start-scan-btn" class="scan-start-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Open the camera
          </button>
        </div>
      </div>
      <a class="link-btn back-link" href="?screen=map">‹ Back to the map</a>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const startBtn = root.querySelector("#start-scan-btn") as HTMLButtonElement;
  const overlay = root.querySelector("#scan-start-overlay") as HTMLDivElement;

  function setStatus(msg: string) {
    statusEl.style.display = "";
    statusEl.textContent = msg;
    console.log("[scandit]", msg);
  }

  async function boot() {
    if (!LICENSE_KEY) {
      console.error("Scanner license not configured (VITE_SCANDIT_LICENSE_KEY missing).");
      setStatus("The camera isn't ready right now.");
      startBtn.disabled = false;
      return;
    }

    setStatus("Warming up the camera…");

    const context = await DataCaptureContext.forLicenseKey(LICENSE_KEY, {
      libraryLocation:
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@8/sdc-lib/",
      moduleLoaders: [barcodeCaptureLoader()],
    });

    const dataCaptureView = new DataCaptureView();
    dataCaptureView.connectToElement(captureViewEl);
    await dataCaptureView.setContext(context);

    // Camera switch toggle (front <-> back) lives in the top-right corner.
    dataCaptureView.addControl(new CameraSwitchControl());

    // Same camera setup as smoke.ts — proven to work.
    const camera = Camera.pickBestGuess();
    await camera.applySettings(BarcodeCapture.recommendedCameraSettings);
    await context.setFrameSource(camera);
    await camera.switchToDesiredState(FrameSourceState.On);


    const settings = new BarcodeFindSettings();
    settings.enableSymbologies([
      Symbology.EAN13UPCA,
      Symbology.EAN8,
      Symbology.UPCE,
      Symbology.QR,
      Symbology.Code128,
      Symbology.Code39,
      Symbology.DataMatrix,
    ]);

    const barcodeFind = await BarcodeFind.forSettings(settings);

    // Build BarcodeFindItem[] from the shopper's list.
    const items: BarcodeFindItem[] = [];
    for (const code of list) {
      const p = getProduct(code);
      if (!p) continue;
      items.push(
        new BarcodeFindItem(
          new BarcodeFindItemSearchOptions(code),
          new BarcodeFindItemContent(
            p.name,
            `${p.brand} · ${p.color} · size ${p.size}`,
            undefined,
          ),
        ),
      );
    }

    const viewSettings = new BarcodeFindViewSettings(
      Color.fromHex("#2ecc71"), // in-list pin (green)
      Color.fromHex("#ff5a5a"), // not-in-list pin (red)
      true, // sound
      true, // haptics
    );

    // Workaround for Scandit 8.4.0 bug: createWithSettings() does NOT register
    // the <scandit-barcode-find-view> custom element (create() does). Without
    // registration, document.createElement(tag) returns a bare HTMLElement
    // missing methods like setTorchAvailable, causing "setTorchAvailable is not
    // a function" at runtime. Calling register() first fixes it.
    (BarcodeFindView as unknown as { register?: () => void }).register?.();

    const view = await BarcodeFindView.createWithSettings(
      dataCaptureView,
      context,
      barcodeFind,
      viewSettings,
    );

    // IMPORTANT: setItemList must be called AFTER createWithSettings.
    // createWithSettings internally calls addBarcodeFindToContext which wires
    // the BarcodeFind instance into the scanning pipeline. Any setItemList call
    // before this point is on an unconnected instance and is silently discarded.
    await barcodeFind.setItemList(items);

    view.setListener({
      didTapFinishButton: async (foundItems: BarcodeFindItem[]) => {
        const codes = foundItems.map((it) => it.searchOptions.barcodeData);
        sessionStorage.setItem(FOUND_KEY, JSON.stringify(codes));
        announce(`Found ${codes.length} of ${items.length}. All done.`);
        const url = new URL(window.location.href);
        url.searchParams.set("screen", "done");
        url.searchParams.delete("zone");
        window.location.href = url.toString();
      },
    });

    await view.startSearching();
    setStatus(`Looking for ${items.length} thing${items.length > 1 ? "s" : ""}.`);


  } // end boot()

  startBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    boot().catch((err: unknown) => {
      console.error("Scan boot failed:", err, "hostname:", location.hostname);
      // Show the actual reason so deployment / license issues are visible.
      // Imported lazily to keep the existing import block tight.
      void import("../lib/camera-errors").then(({ cameraErrorMessage }) => {
        setStatus(cameraErrorMessage(err));
      });
      overlay.style.display = "";
      startBtn.disabled = false;
    });
  });
}
