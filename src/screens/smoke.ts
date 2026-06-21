import {
  DataCaptureContext,
  DataCaptureView,
  Camera,
  CameraPosition,
  CameraSwitchControl,
  FrameSourceState,
  Feedback,
} from "@scandit/web-datacapture-core";
import {
  barcodeCaptureLoader,
  BarcodeCapture,
  BarcodeCaptureSettings,
  Symbology,
  SymbologyDescription,
} from "@scandit/web-datacapture-barcode";

const LICENSE_KEY = import.meta.env.VITE_SCANDIT_LICENSE_KEY as
  | string
  | undefined;

export function renderSmoke(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>Camera diagnostics</h1>
      <p class="tag">Walks through the camera setup so we can see exactly where it breaks.</p>
    </header>
    <main style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <div style="padding:10px 12px;background:#e6f4ea;border:1px solid #a8d5b5;border-radius:10px;font-size:13px;">
        ✅ Diagnostic page loaded at <code>${location.host}${location.pathname}${location.search}</code>
      </div>
      <div id="status" class="status">starting…</div>
      <ol id="steps" class="steps" style="list-style:none;padding:0;margin:0;"></ol>
      <button id="start" class="primary" style="display:none;">Re-run the test</button>
      <div id="capture-view" style="min-height:60vh;background:#000;border-radius:12px;"></div>
      <div id="last-scan" class="last-scan"></div>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const lastScanEl = root.querySelector("#last-scan") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const startBtn = root.querySelector("#start") as HTMLButtonElement;
  const stepsEl = root.querySelector("#steps") as HTMLOListElement;

  let scanCount = 0;

  function logStep(label: string, status: "pending" | "ok" | "fail", info?: string) {
    const icon = status === "ok" ? "✅" : status === "fail" ? "❌" : "⏳";
    const li = document.createElement("li");
    li.innerHTML = `${icon} <strong>${label}</strong>${info ? `<br><span class="step-info">${info}</span>` : ""}`;
    li.style.cssText = "padding:6px 0;font-size:13px;line-height:1.4;";
    stepsEl.appendChild(li);
    console.log(`[diag] ${status === "ok" ? "OK" : status === "fail" ? "FAIL" : "..."}`, label, info ?? "");
    return li;
  }

  function setStatus(msg: string) {
    statusEl.textContent = msg;
  }

  function flashScan(line: string) {
    scanCount += 1;
    lastScanEl.textContent = `#${scanCount}  ${line}`;
    lastScanEl.classList.remove("flash");
    void lastScanEl.offsetWidth;
    lastScanEl.classList.add("flash");
    if ("vibrate" in navigator) navigator.vibrate(60);
  }

  async function boot() {
    stepsEl.innerHTML = "";

    // Step 1: secure context
    if (window.isSecureContext) {
      logStep("Secure context (HTTPS)", "ok", `${location.protocol}//${location.host}`);
    } else {
      logStep("Secure context (HTTPS)", "fail", "Camera needs HTTPS or localhost. Current: " + location.protocol);
      setStatus("HTTPS required");
      return;
    }

    // Step 2: mediaDevices API
    if (!navigator.mediaDevices?.getUserMedia) {
      logStep("navigator.mediaDevices API", "fail", "Browser doesn't expose getUserMedia. Try Chrome/Safari.");
      setStatus("Browser too old");
      return;
    }
    logStep("navigator.mediaDevices API", "ok");

    // Step 3: license key present
    if (!LICENSE_KEY) {
      logStep("Scandit license key", "fail", "VITE_SCANDIT_LICENSE_KEY missing from Render env");
      setStatus("No license key");
      return;
    }
    logStep("Scandit license key", "ok", `${LICENSE_KEY.length} chars`);

    // Step 4: ask for camera permission directly so we get a clear error
    setStatus("requesting camera permission…");
    const permRow = logStep("Camera permission", "pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const tracks = stream.getVideoTracks();
      const track = tracks[0];
      const settings = track?.getSettings();
      permRow.innerHTML = `✅ <strong>Camera permission</strong><br><span class="step-info">${tracks.length} track(s). Device: ${settings?.deviceId?.slice(0, 12) ?? "?"}... ${settings?.width}x${settings?.height}</span>`;
      // Release the test stream — Scandit will request its own.
      tracks.forEach((t) => t.stop());
    } catch (err) {
      const e = err as DOMException;
      permRow.innerHTML = `❌ <strong>Camera permission</strong><br><span class="step-info">${e.name}: ${e.message}</span>`;
      setStatus(`Camera blocked: ${e.name}`);
      console.error(err);
      return;
    }

    // Step 5: enumerate cameras
    const camRow = logStep("Cameras detected", "pending");
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      camRow.innerHTML = `✅ <strong>Cameras detected</strong><br><span class="step-info">${cams.length} camera(s): ${cams.map((c) => c.label || "(unnamed)").join(" · ")}</span>`;
    } catch (err) {
      camRow.innerHTML = `❌ <strong>Cameras detected</strong><br><span class="step-info">${(err as Error).message}</span>`;
    }

    // Step 6: Scandit context
    setStatus("loading Scandit SDK…");
    const ctxRow = logStep("Scandit SDK + license", "pending");
    let context: DataCaptureContext;
    try {
      context = await DataCaptureContext.forLicenseKey(LICENSE_KEY, {
        libraryLocation:
          "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@8/sdc-lib/",
        moduleLoaders: [barcodeCaptureLoader()],
      });
      ctxRow.innerHTML = `✅ <strong>Scandit SDK + license</strong>`;
    } catch (err) {
      ctxRow.innerHTML = `❌ <strong>Scandit SDK + license</strong><br><span class="step-info">${(err as Error).message}</span>`;
      setStatus("Scandit init failed");
      console.error(err);
      return;
    }

    // Step 7: DataCaptureView
    const viewRow = logStep("DataCaptureView mount", "pending");
    try {
      const view = new DataCaptureView();
      view.connectToElement(captureViewEl);
      await view.setContext(context);
      view.addControl(new CameraSwitchControl());
      viewRow.innerHTML = `✅ <strong>DataCaptureView mount</strong>`;

      // Step 8: BarcodeCapture mode
      const modeRow = logStep("BarcodeCapture mode", "pending");
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
      const barcodeCapture = await BarcodeCapture.forContext(context, settings);
      modeRow.innerHTML = `✅ <strong>BarcodeCapture mode</strong>`;

      // Step 9: camera object + apply settings
      const camStartRow = logStep("Camera object + recommended settings", "pending");
      const camera = Camera.pickBestGuessForPosition(CameraPosition.WorldFacing);
      await camera.applySettings(BarcodeCapture.recommendedCameraSettings);
      await context.setFrameSource(camera);
      camStartRow.innerHTML = `✅ <strong>Camera object + recommended settings</strong>`;

      // Step 10: switch camera ON — most likely fail point
      const onRow = logStep("camera.switchToDesiredState(On)", "pending");
      try {
        await camera.switchToDesiredState(FrameSourceState.On);
        onRow.innerHTML = `✅ <strong>camera.switchToDesiredState(On)</strong>`;
      } catch (err) {
        const e = err as Error;
        onRow.innerHTML = `❌ <strong>camera.switchToDesiredState(On)</strong><br><span class="step-info">${e.name}: ${e.message}</span>`;
        setStatus(`Camera ON failed: ${e.message}`);
        console.error(err);
        return;
      }

      // Step 11: video element should now exist inside capture view
      await new Promise((resolve) => setTimeout(resolve, 400));
      const videos = captureViewEl.querySelectorAll("video");
      const videoRow = logStep("video element present", videos.length > 0 ? "ok" : "fail",
        videos.length > 0
          ? `${videos.length} <video>; first ${(videos[0] as HTMLVideoElement).videoWidth}x${(videos[0] as HTMLVideoElement).videoHeight}, paused=${(videos[0] as HTMLVideoElement).paused}`
          : "No <video> rendered inside #capture-view — Scandit didn't mount it",
      );
      videoRow.scrollIntoView({ behavior: "smooth", block: "center" });

      const feedback = Feedback.defaultFeedback;
      barcodeCapture.addListener({
        didScan: async (_mode, session) => {
          const barcode = session.newlyRecognizedBarcode;
          if (!barcode) return;
          const sym = new SymbologyDescription(barcode.symbology);
          flashScan(`[${sym.readableName}] ${barcode.data ?? ""}`);
          feedback.emit();
        },
      });
      await barcodeCapture.setEnabled(true);
      logStep("Scanner enabled", "ok");
      setStatus("Ready. Point at a barcode.");
      startBtn.style.display = "none";
    } catch (err) {
      viewRow.innerHTML = `❌ <strong>DataCaptureView mount</strong><br><span class="step-info">${(err as Error).message}</span>`;
      setStatus(`Mount failed: ${(err as Error).message}`);
      console.error(err);
      return;
    }
  }

  function run() {
    startBtn.disabled = true;
    startBtn.style.display = "none";
    setStatus("starting…");
    boot().catch((err: unknown) => {
      console.error(err);
      setStatus(`UNCAUGHT: ${(err as Error).message ?? String(err)}`);
    }).finally(() => {
      // Show the rerun button after the run completes so the user can re-test.
      startBtn.disabled = false;
      startBtn.style.display = "";
    });
  }
  startBtn.addEventListener("click", run);
  run();
}
