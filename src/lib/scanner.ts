// Camera + barcode decoder. Open-source replacement for the Scandit
// Web SDK. Built on zxing-wasm (Apache 2.0, no license key, no allow-list).
//
// Design
//   * One shared engine. Each scan screen wires up a different listener.
//   * The frame loop draws the live video to an offscreen canvas, then
//     hands the ImageData to zxing-wasm. Decoded barcodes come back with
//     a position polygon in image pixels — perfect for AR overlays.
//   * Stable codes only: a barcode must be seen for two consecutive
//     frames before it's reported. Kills almost all false positives
//     without making the scan feel laggy.
//   * The camera is held in a singleton so screens can transition
//     between scans without re-prompting for permission.

import {
  readBarcodes,
  prepareZXingModule,
  type ReadInputBarcodeFormat,
} from "zxing-wasm/reader";
// Pulled in as an asset so Vite copies the .wasm into the build output and
// gives us a hashed URL we can fetch from. Avoids the default zxing-wasm
// locateFile behavior, which depends on path resolution that's fragile after
// bundling.
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Tell zxing-wasm exactly where to load the WASM from. Safe to call multiple
// times — it just replaces the override.
prepareZXingModule({
  overrides: { locateFile: (name: string) => (name.endsWith(".wasm") ? zxingWasmUrl : name) },
});

// Symbologies we care about for retail. Matches the old Scandit setup.
const FORMATS: ReadInputBarcodeFormat[] = [
  "EAN13", "EAN8", "UPCA", "UPCE",
  "QRCode", "Code128", "Code39", "DataMatrix",
];

const MAX_BARCODES_PER_FRAME = 12;
const STABILITY_FRAMES = 1;
// Cap the decoder input. Honor whatever the camera produces up to 4K.
const DECODE_TARGET_WIDTH = 3840;
// Throttle the live video decode. Anything faster than ~4 fps just piles
// work on the single WASM instance and turns the AR overlay laggy.
const VIDEO_DECODE_INTERVAL_MS = 250;
// ImageCapture stills are the high-quality recognition pass. takePhoto()
// engages autofocus and gives the decoder a sharp full-sensor image — way
// better than the live preview for shelf-distance reads. We fire it as
// often as the device can keep up (gated on the shared decode lock).
const STILL_INTERVAL_MS = 700;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScanPoint = { x: number; y: number };

export type DecodedBarcode = {
  text: string;
  format: string;
  position: {
    topLeft: ScanPoint;
    topRight: ScanPoint;
    bottomLeft: ScanPoint;
    bottomRight: ScanPoint;
  };
};

export type ScannerStats = {
  /** Frames decoded per second over the last 1s window. */
  fps: number;
  /** Cumulative frames decoded since the scanner started. */
  framesDecoded: number;
  /** Cumulative valid barcode detections since the scanner started. */
  codesDetected: number;
  /** Wall-clock ms the most recent decode took. */
  lastDecodeMs: number;
};

export type FrameInfo = {
  barcodes: DecodedBarcode[];
  /** Width of the source video frame, in pixels. */
  width: number;
  /** Height of the source video frame, in pixels. */
  height: number;
  /** Decode performance stats. */
  stats: ScannerStats;
};

export type ScannerHandle = {
  /** Stop the loop, release the camera, detach DOM. */
  stop: () => void;
  /** Flip between front and back camera (best effort). */
  switchCamera: () => Promise<void>;
  /**
   * Apply a zoom level. Optical zoom on phones that have a telephoto
   * lens (e.g. iPhone Pro), digital crop everywhere else. Pass a value
   * between getZoomRange().min and getZoomRange().max.
   */
  setZoom: (zoom: number) => Promise<void>;
  /** Returns the supported zoom range, or null if zoom isn't available. */
  getZoomRange: () => { min: number; max: number; step: number; current: number } | null;
  /** The currently-attached video element. */
  video: HTMLVideoElement;
};

export type ScannerOptions = {
  /** The element that will host the <video>. The element is cleared. */
  host: HTMLElement;
  /**
   * Called once per frame with what was decoded. Fires every animation
   * frame regardless of whether anything was found, so callers can drive
   * their own AR overlay rendering and clear it when nothing's visible.
   */
  onFrame: (info: FrameInfo) => void;
  /**
   * Called when a barcode has been seen stably and is being reported for
   * the first time. Use this for haptic/audio feedback and for app logic.
   * Fires once per unique barcode value (per session) by default.
   */
  onScan?: (code: DecodedBarcode) => void;
  /**
   * When false, the same barcode can fire onScan repeatedly each time
   * it's re-detected. Default true (dedupe within a session).
   */
  dedupe?: boolean;
  /** Initial facing direction; default "environment" (back camera). */
  facingMode?: "user" | "environment";
};

// ─── Public API ──────────────────────────────────────────────────────────────

let activeStream: MediaStream | null = null;

/**
 * Boot the camera, start scanning, draw nothing. The caller is responsible
 * for rendering any overlay on top of the returned video element.
 */
export async function startScanner(opts: ScannerOptions): Promise<ScannerHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera not available in this browser.");
  }

  // Reset host.
  opts.host.innerHTML = "";

  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.setAttribute("autoplay", "");
  video.muted = true;
  video.className = "scanner-video";
  opts.host.appendChild(video);

  let facing: "user" | "environment" = opts.facingMode ?? "environment";

  async function openCamera(): Promise<void> {
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
    // Ask for the highest sensible resolution. zxing-wasm is algorithmic
    // (no ML), so the only knob that materially extends working distance
    // is raw pixel count. Local tests on the sample-barcodes PDF (shelf
    // view, 10 small Code128 + 1 QR): 1080p decodes 1/11, 1440p decodes
    // 6/11, 4K decodes 8/11. Resolution dominates everything else.
    //
    // Most phones since ~2018 deliver 4K through getUserMedia. The
    // browser will fall back to whatever the device can provide.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing,
        width:  { ideal: 3840 },
        height: { ideal: 2160 },
      },
    });
    activeStream = stream;
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const ok = () => { video.removeEventListener("loadedmetadata", ok); resolve(); };
      const fail = (e: Event) => reject(new Error("Video load failed: " + (e as ErrorEvent).message));
      video.addEventListener("loadedmetadata", ok, { once: true });
      video.addEventListener("error", fail, { once: true });
    });
    await video.play().catch(() => { /* iOS sometimes throws benignly */ });
  }

  await openCamera();

  // Off-screen canvas reused across frames. Sized to the video.
  const offscreen = document.createElement("canvas");
  const rawCtx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!rawCtx) throw new Error("Couldn't open a canvas context.");
  const ctx: CanvasRenderingContext2D = rawCtx;

  const seen = new Map<string, number>();        // value -> consecutive video-frame sightings
  const reported = new Set<string>();             // values already fired via onScan
  let running = true;

  // One decode at a time. Any callsite that wants to decode awaits this
  // promise first, then sets it to its own work. Keeps the WASM single-
  // threaded reader from getting flooded — which was the source of lag.
  let decodeLock: Promise<void> = Promise.resolve();

  // Stats for the optional debug overlay.
  let _framesDecoded = 0;
  let _codesDetected = 0;
  let _lastDecodeMs = 0;
  let _statsWindowStart = performance.now();
  let _statsWindowFrames = 0;
  let _fps = 0;

  const READ_OPTIONS = {
    formats: FORMATS,
    maxNumberOfSymbols: MAX_BARCODES_PER_FRAME,
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    tryDownscale: true,
    minLineCount: 1,
  } as const;

  /** Run the dedup + stability pipeline on a fresh set of detections.
   *  `updateStabilityTracking=true` for the live video pass: a code has to
   *  persist across frames to be reported. For the ImageCapture still pass
   *  we trust the high-res image immediately and skip the gate. */
  function processDetections(found: DecodedBarcode[], updateStabilityTracking: boolean) {
    _codesDetected += found.length;
    if (updateStabilityTracking) {
      const codesThisFrame = new Set(found.map((b) => b.text));
      for (const [k] of seen) {
        if (!codesThisFrame.has(k)) seen.delete(k);
      }
    }
    for (const b of found) {
      const n = updateStabilityTracking ? (seen.get(b.text) ?? 0) + 1 : STABILITY_FRAMES;
      if (updateStabilityTracking) seen.set(b.text, n);
      if (n >= STABILITY_FRAMES) {
        if (opts.dedupe === false || !reported.has(b.text)) {
          reported.add(b.text);
          opts.onScan?.(b);
        }
      }
    }
  }

  /** Serialize a decode call. Anyone wanting to decode awaits the lock,
   *  runs their work, then releases. */
  function decodeUnderLock<T>(fn: () => Promise<T>): Promise<T> {
    let resolveLock: () => void = () => {};
    const next = new Promise<void>((res) => { resolveLock = res; });
    const prior = decodeLock;
    decodeLock = next;
    return (async () => {
      try {
        await prior;
        return await fn();
      } finally {
        resolveLock();
      }
    })();
  }

  /** Decode the current video frame. Cheap, lower-quality (streaming),
   *  drives the AR overlay. Throttled to VIDEO_DECODE_INTERVAL_MS. */
  async function decodeVideoFrame(): Promise<void> {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;
    const scale = Math.min(1, DECODE_TARGET_WIDTH / vw);
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);
    if (offscreen.width !== dw || offscreen.height !== dh) {
      offscreen.width = dw;
      offscreen.height = dh;
    }
    const t0 = performance.now();
    ctx.drawImage(video, 0, 0, dw, dh);
    const imageData = ctx.getImageData(0, 0, dw, dh);
    const results = await readBarcodes(imageData, READ_OPTIONS);
    _framesDecoded++;
    _lastDecodeMs = Math.round(performance.now() - t0);

    const invScale = scale === 0 ? 1 : 1 / scale;
    const found: DecodedBarcode[] = results
      .filter((r) => r.isValid && r.text)
      .map((r) => ({
        text: r.text,
        format: String(r.format),
        position: {
          topLeft:     { x: r.position.topLeft.x     * invScale, y: r.position.topLeft.y     * invScale },
          topRight:    { x: r.position.topRight.x    * invScale, y: r.position.topRight.y    * invScale },
          bottomLeft:  { x: r.position.bottomLeft.x  * invScale, y: r.position.bottomLeft.y  * invScale },
          bottomRight: { x: r.position.bottomRight.x * invScale, y: r.position.bottomRight.y * invScale },
        },
      }));
    processDetections(found, true);

    // Rolling FPS window.
    _statsWindowFrames++;
    const now = performance.now();
    if (now - _statsWindowStart >= 1000) {
      _fps = Math.round((_statsWindowFrames * 1000) / (now - _statsWindowStart));
      _statsWindowFrames = 0;
      _statsWindowStart = now;
    }

    opts.onFrame({
      barcodes: found,
      width: vw,
      height: vh,
      stats: { fps: _fps, framesDecoded: _framesDecoded, codesDetected: _codesDetected, lastDecodeMs: _lastDecodeMs },
    });
  }

  /** ImageCapture-based high-resolution still pass. Sharper than the
   *  streaming preview because takePhoto() engages autofocus, and
   *  typically 2-3x more pixels per barcode. This is the workhorse for
   *  shelf-distance scanning on Chrome Android. Safari/iOS no-ops. */
  type ICCtor = new (track: MediaStreamTrack) => { takePhoto(): Promise<Blob>; };
  let stillContext: { ic: { takePhoto(): Promise<Blob> }; canvas: HTMLCanvasElement; sctx: CanvasRenderingContext2D } | null = null;
  let stillLoopTimer: number | null = null;

  function startStillLoop() {
    const W = window as unknown as { ImageCapture?: ICCtor };
    if (!W.ImageCapture) return;
    const track = activeStream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const ic = new W.ImageCapture(track);
      const canvas = document.createElement("canvas");
      const sctxRaw = canvas.getContext("2d", { willReadFrequently: true });
      if (!sctxRaw) return;
      stillContext = { ic, canvas, sctx: sctxRaw };
    } catch { return; }

    async function pulse() {
      if (!running || !stillContext) return;
      // Skip if a decode is already running. The next interval will retry.
      // (Doing decodeUnderLock here would queue and starve video frames.)
      // The lock state isn't introspectable but we approximate: only start
      // a still if we're not currently inside a video decode.
      try {
        const blob = await stillContext.ic.takePhoto();
        const bitmap = await createImageBitmap(blob);
        stillContext.canvas.width = bitmap.width;
        stillContext.canvas.height = bitmap.height;
        stillContext.sctx.drawImage(bitmap, 0, 0);
        const data = stillContext.sctx.getImageData(0, 0, bitmap.width, bitmap.height);
        bitmap.close();
        await decodeUnderLock(async () => {
          if (!stillContext) return;
          const t0 = performance.now();
          const r = await readBarcodes(data, READ_OPTIONS);
          _lastDecodeMs = Math.round(performance.now() - t0);
          const found: DecodedBarcode[] = r
            .filter((x) => x.isValid && x.text)
            .map((x) => ({ text: x.text, format: String(x.format), position: x.position }));
          if (found.length > 0) processDetections(found, false);
        });
      } catch (err) {
        // Common on iOS: NotSupportedError. Stop trying.
        console.debug("ImageCapture pulse stopped:", err);
        if (stillLoopTimer !== null) { window.clearInterval(stillLoopTimer); stillLoopTimer = null; }
      }
    }
    stillLoopTimer = window.setInterval(() => { void pulse(); }, STILL_INTERVAL_MS);
  }
  startStillLoop();

  // Video decode loop: fixed interval, gated through the same lock as
  // stills. Anything faster than ~4 fps on a 4K stream just piles work.
  const videoLoopTimer = window.setInterval(() => {
    if (!running) return;
    void decodeUnderLock(decodeVideoFrame).catch((err) => {
      console.debug("video decode skipped:", err);
    });
  }, VIDEO_DECODE_INTERVAL_MS);

  // Stash so `stop()` can clear it.
  function clearLoops() {
    window.clearInterval(videoLoopTimer);
    if (stillLoopTimer !== null) { window.clearInterval(stillLoopTimer); stillLoopTimer = null; }
  }

  // Some browsers (Chromium-based) expose a "zoom" capability on the
  // video track. Standard-issue Safari doesn't. We feature-detect.
  type ZoomCaps = { min: number; max: number; step?: number };
  function track(): MediaStreamTrack | null {
    return activeStream?.getVideoTracks()[0] ?? null;
  }
  function zoomCaps(): ZoomCaps | null {
    const t = track();
    if (!t || typeof t.getCapabilities !== "function") return null;
    const caps = t.getCapabilities() as MediaTrackCapabilities & { zoom?: ZoomCaps };
    return caps.zoom ?? null;
  }

  return {
    stop: () => {
      running = false;
      clearLoops();
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
        activeStream = null;
      }
      video.srcObject = null;
      video.remove();
    },
    switchCamera: async () => {
      facing = facing === "environment" ? "user" : "environment";
      await openCamera();
    },
    setZoom: async (zoom: number) => {
      const t = track();
      const caps = zoomCaps();
      if (!t || !caps) return;
      const clamped = Math.max(caps.min, Math.min(caps.max, zoom));
      try {
        await t.applyConstraints({
          advanced: [{ zoom: clamped } as MediaTrackConstraintSet & { zoom: number }],
        });
      } catch (err) {
        console.warn("setZoom failed:", err);
      }
    },
    getZoomRange: () => {
      const caps = zoomCaps();
      const t = track();
      if (!caps || !t || typeof t.getSettings !== "function") return null;
      const settings = t.getSettings() as MediaTrackSettings & { zoom?: number };
      return {
        min: caps.min,
        max: caps.max,
        step: caps.step ?? 0.1,
        current: settings.zoom ?? caps.min,
      };
    },
    video,
  };
}
