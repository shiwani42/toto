// Camera diagnostics. Walks through each step of the new
// open-source scanning pipeline so we can see exactly where it breaks
// on a given device or deploy.

// The shared scanner module configures zxing-wasm to load its WASM from the
// bundled asset URL. Importing it here (we don't use the symbol) makes sure
// that initialization runs before we call readBarcodes.
import "../lib/scanner";
import { readBarcodes } from "zxing-wasm/reader";

export function renderSmoke(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>Camera diagnostics</h1>
      <p class="tag">Walks through the camera + scanner setup.</p>
    </header>
    <main style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <div style="padding:10px 12px;background:#e6f4ea;border:1px solid #a8d5b5;border-radius:10px;font-size:13px;">
        ✅ Diagnostic page loaded at <code>${location.host}${location.pathname}${location.search}</code>
      </div>
      <div id="status" class="status">starting…</div>
      <ol id="steps" class="steps" style="list-style:none;padding:0;margin:0;"></ol>
      <button id="start" class="primary" style="display:none;">Re-run the test</button>
      <video id="diag-video" playsinline autoplay muted style="width:100%;max-height:60vh;background:#000;border-radius:12px;object-fit:cover;"></video>
      <div id="last-scan" class="last-scan" style="font-size:13px;color:var(--muted-fg);min-height:24px;"></div>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const lastScanEl = root.querySelector("#last-scan") as HTMLDivElement;
  const video = root.querySelector("#diag-video") as HTMLVideoElement;
  const startBtn = root.querySelector("#start") as HTMLButtonElement;
  const stepsEl = root.querySelector("#steps") as HTMLOListElement;

  let scanCount = 0;
  let stop = false;

  function logStep(label: string, status: "pending" | "ok" | "fail", info?: string) {
    const icon = status === "ok" ? "✅" : status === "fail" ? "❌" : "⏳";
    const li = document.createElement("li");
    li.innerHTML = `${icon} <strong>${label}</strong>${info ? `<br><span class="step-info">${info}</span>` : ""}`;
    li.style.cssText = "padding:6px 0;font-size:13px;line-height:1.4;";
    stepsEl.appendChild(li);
    console.log(`[diag] ${status === "ok" ? "OK" : status === "fail" ? "FAIL" : "..."}`, label, info ?? "");
    return li;
  }

  function setStatus(msg: string) { statusEl.textContent = msg; }

  function flashScan(line: string) {
    scanCount += 1;
    lastScanEl.textContent = `#${scanCount}  ${line}`;
    if ("vibrate" in navigator) navigator.vibrate(40);
  }

  async function boot() {
    stop = false;
    stepsEl.innerHTML = "";

    // 1. Secure context
    if (window.isSecureContext) {
      logStep("Secure context (HTTPS)", "ok", `${location.protocol}//${location.host}`);
    } else {
      logStep("Secure context (HTTPS)", "fail", "Camera needs HTTPS or localhost. Current: " + location.protocol);
      setStatus("HTTPS required");
      return;
    }

    // 2. mediaDevices API
    if (!navigator.mediaDevices?.getUserMedia) {
      logStep("navigator.mediaDevices API", "fail", "Browser doesn't expose getUserMedia.");
      setStatus("Browser too old");
      return;
    }
    logStep("navigator.mediaDevices API", "ok");

    // 3. camera permission
    setStatus("requesting camera permission…");
    const permRow = logStep("Camera permission", "pending");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const tracks = stream.getVideoTracks();
      const s = tracks[0]?.getSettings();
      permRow.innerHTML = `✅ <strong>Camera permission</strong><br><span class="step-info">${tracks.length} track(s). ${s?.width ?? "?"}x${s?.height ?? "?"}, device id ${(s?.deviceId ?? "?").slice(0, 12)}…</span>`;
    } catch (err) {
      const e = err as DOMException;
      permRow.innerHTML = `❌ <strong>Camera permission</strong><br><span class="step-info">${e.name}: ${e.message}</span>`;
      setStatus(`Camera blocked: ${e.name}`);
      console.error(err);
      return;
    }

    // 4. enumerate cameras
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === "videoinput");
      logStep("Cameras detected", "ok", `${cams.length} camera(s): ${cams.map((c) => c.label || "(unnamed)").join(" · ")}`);
    } catch (err) {
      logStep("Cameras detected", "fail", (err as Error).message);
    }

    // 5. attach to video and play
    video.srcObject = stream;
    await new Promise<void>((res) => {
      video.addEventListener("loadedmetadata", () => res(), { once: true });
    });
    await video.play().catch(() => { /* iOS sometimes throws benignly */ });
    logStep("Video element playing", "ok", `${video.videoWidth}x${video.videoHeight}`);

    // 6. zxing-wasm load + first decode
    const decodeRow = logStep("zxing-wasm load + decode", "pending");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      decodeRow.innerHTML = `❌ <strong>zxing-wasm load + decode</strong><br><span class="step-info">No 2D canvas context</span>`;
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    try {
      await readBarcodes(imageData, { formats: ["EAN13", "EAN8", "QRCode", "Code128"] });
      decodeRow.innerHTML = `✅ <strong>zxing-wasm load + decode</strong>`;
    } catch (err) {
      decodeRow.innerHTML = `❌ <strong>zxing-wasm load + decode</strong><br><span class="step-info">${(err as Error).message}</span>`;
      setStatus("zxing-wasm failed");
      console.error(err);
      return;
    }

    logStep("Scanner ready", "ok");
    setStatus("Ready. Point at a barcode.");

    // 7. live scan loop on the diagnostic video
    async function tick() {
      if (stop) return;
      requestAnimationFrame(() => { void tick(); });
      if (video.videoWidth === 0 || !ctx) return;
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const results = await readBarcodes(data, {
          formats: ["EAN13", "EAN8", "UPCA", "UPCE", "QRCode", "Code128", "Code39", "DataMatrix"],
          maxNumberOfSymbols: 6,
          tryHarder: true,
        });
        for (const r of results) {
          if (r.isValid && r.text) flashScan(`[${r.format}] ${r.text}`);
        }
      } catch { /* ignore per-frame errors */ }
    }
    void tick();
  }

  function run() {
    stop = true;                          // halt any prior loop before restarting
    startBtn.disabled = true;
    startBtn.style.display = "none";
    setStatus("starting…");
    boot().catch((err: unknown) => {
      console.error(err);
      setStatus(`UNCAUGHT: ${(err as Error).message ?? String(err)}`);
    }).finally(() => {
      startBtn.disabled = false;
      startBtn.style.display = "";
    });
  }
  startBtn.addEventListener("click", run);
  run();
  window.addEventListener("pagehide", () => { stop = true; }, { once: true });
}
