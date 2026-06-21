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

// Native BarcodeDetector formats (lower-case with underscores).
const NATIVE_FORMATS = [
  "code_128", "ean_13", "ean_8", "upc_a", "upc_e",
  "qr_code", "code_39", "data_matrix",
] as const;

// Minimal type surface for the native BarcodeDetector API. Not in lib.dom yet
// for all browsers, so we declare what we need.
type NativeCornerPoints = ReadonlyArray<{ x: number; y: number }>;
type NativeDetectResult = {
  rawValue: string;
  format: string;
  cornerPoints: NativeCornerPoints;
};
type NativeDetector = {
  detect: (src: HTMLVideoElement | HTMLImageElement | ImageBitmap | ImageData | Blob) => Promise<NativeDetectResult[]>;
};
type NativeBarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

const MAX_BARCODES_PER_FRAME = 12;
const STABILITY_FRAMES = 1;
// Cap the decoder input. Honor whatever the camera produces up to 4K.
const DECODE_TARGET_WIDTH = 3840;
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
  /** Which detection backend is in use. "native" = OS-level ML
   *  (Chrome Android), "zxing" = WASM fallback (iOS Safari, Firefox). */
  backend: "native" | "zxing";
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
  /** Toggle the camera's torch (flashlight). No-op if unsupported. */
  setTorch: (on: boolean) => Promise<void>;
  /** Whether the current track exposes a torch capability. */
  hasTorch: () => boolean;
  /** Focus on a normalized point (0..1 each axis) inside the video frame.
   *  Triggers single-shot focus on devices that support pointsOfInterest. */
  focusAt: (xNormalized: number, yNormalized: number) => Promise<void>;
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
        frameRate: { ideal: 30 },
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
    // Push continuous focus / exposure / white balance after the stream is
    // live. Default mode on many phones is "single-shot" — once focus
    // locks it doesn't re-engage when the user pans. Continuous keeps it
    // tracking which is huge for shelf sweeping. Browser ignores any
    // unsupported keys.
    const t = stream.getVideoTracks()[0];
    if (t && typeof t.getCapabilities === "function") {
      const caps = t.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[]; exposureMode?: string[]; whiteBalanceMode?: string[];
      };
      const advanced: MediaTrackConstraintSet[] = [];
      if (caps.focusMode?.includes("continuous"))         advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
      if (caps.exposureMode?.includes("continuous"))      advanced.push({ exposureMode: "continuous" } as MediaTrackConstraintSet);
      if (caps.whiteBalanceMode?.includes("continuous"))  advanced.push({ whiteBalanceMode: "continuous" } as MediaTrackConstraintSet);
      if (advanced.length > 0) {
        try { await t.applyConstraints({ advanced }); } catch (err) { console.debug("camera constraints skipped:", err); }
      }
    }
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

  // Drop-if-busy. zxing-wasm is single-threaded; if a decode is running,
  // new calls are simply skipped rather than queued. Queueing turned out
  // to be the source of "everything stops working" -- decode of stale
  // frames piled up forever and the scanner never caught up.
  let decodeInFlight = false;

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

  // ─── Detection backend ─────────────────────────────────────────────────────
  //
  // Native BarcodeDetector (Shape Detection API) is available on Chrome
  // Android and Chrome desktop. On Android it dispatches to Google Code
  // Scanner — ML-based, OS-level, dramatically better at distance and
  // partial occlusion than any algorithmic decoder. Zero bundle cost.
  //
  // When unavailable (iOS Safari, Firefox, etc.) we fall back to
  // zxing-wasm. The dispatch is transparent to the rest of the scanner.

  type DecodeSource = HTMLVideoElement | ImageData | Blob | ImageBitmap;
  type Backend = {
    name: "native" | "zxing";
    detect: (source: DecodeSource) => Promise<DecodedBarcode[]>;
  };

  let backendName: "native" | "zxing" = "zxing";
  let nativeDetector: NativeDetector | null = null;

  async function initNativeDetector(): Promise<NativeDetector | null> {
    const W = window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor };
    if (!W.BarcodeDetector) return null;
    try {
      const supported = await W.BarcodeDetector.getSupportedFormats();
      const wanted = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (wanted.length === 0) return null;
      return new W.BarcodeDetector({ formats: wanted });
    } catch {
      return null;
    }
  }

  async function detectNative(source: DecodeSource): Promise<DecodedBarcode[]> {
    if (!nativeDetector) return [];
    let raw: NativeDetectResult[];
    try {
      raw = await nativeDetector.detect(source);
    } catch (err) {
      console.debug("native detect failed:", err);
      return [];
    }
    return raw
      .filter((r) => r.rawValue)
      .map((r) => {
        const cp = r.cornerPoints;
        // BarcodeDetector returns 4 corner points in TL/TR/BR/BL order.
        // Defensive in case of older implementations that return fewer.
        const tl = cp[0] ?? { x: 0, y: 0 };
        const tr = cp[1] ?? tl;
        const br = cp[2] ?? tr;
        const bl = cp[3] ?? br;
        return {
          text: r.rawValue,
          format: r.format,
          position: { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br },
        };
      });
  }

  async function detectZxing(source: DecodeSource): Promise<DecodedBarcode[]> {
    // zxing-wasm only accepts ImageData. Convert if needed.
    let data: ImageData;
    if (source instanceof ImageData) {
      data = source;
    } else if (source instanceof HTMLVideoElement) {
      const vw = source.videoWidth, vh = source.videoHeight;
      if (vw === 0 || vh === 0) return [];
      const scale = Math.min(1, DECODE_TARGET_WIDTH / vw);
      const dw = Math.round(vw * scale);
      const dh = Math.round(vh * scale);
      if (offscreen.width !== dw || offscreen.height !== dh) {
        offscreen.width = dw;
        offscreen.height = dh;
      }
      ctx.drawImage(source, 0, 0, dw, dh);
      data = ctx.getImageData(0, 0, dw, dh);
    } else {
      // Blob or ImageBitmap — convert to ImageData via canvas.
      const bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
      if (offscreen.width !== bitmap.width || offscreen.height !== bitmap.height) {
        offscreen.width = bitmap.width;
        offscreen.height = bitmap.height;
      }
      ctx.drawImage(bitmap, 0, 0);
      data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      if (source instanceof Blob) (bitmap as ImageBitmap).close();
    }
    const results = await readBarcodes(data, READ_OPTIONS);
    return results
      .filter((r) => r.isValid && r.text)
      .map((r) => ({ text: r.text, format: String(r.format), position: r.position }));
  }

  // Detect once at startup which backend is available, then never re-check.
  nativeDetector = await initNativeDetector();
  const backend: Backend = nativeDetector
    ? { name: "native", detect: detectNative }
    : { name: "zxing", detect: detectZxing };
  backendName = backend.name;
  console.info(`[scanner] backend: ${backendName}`);

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

  /** Try to run a decode. If one's already in flight, skip and return null. */
  async function tryDecode<T>(fn: () => Promise<T>): Promise<T | null> {
    if (decodeInFlight) return null;
    decodeInFlight = true;
    try {
      return await fn();
    } finally {
      decodeInFlight = false;
    }
  }

  /** Decode the current video frame. The native backend accepts the
   *  HTMLVideoElement directly (no canvas drawing); the zxing fallback
   *  draws to canvas internally. Either way, positions come back in the
   *  video's source coordinate space. */
  async function decodeVideoFrame(): Promise<void> {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;
    const t0 = performance.now();
    const found = await backend.detect(video);
    _framesDecoded++;
    _lastDecodeMs = Math.round(performance.now() - t0);
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
      stats: { fps: _fps, framesDecoded: _framesDecoded, codesDetected: _codesDetected, lastDecodeMs: _lastDecodeMs, backend: backendName },
    });
  }

  /** Higher-resolution still pass via ImageCapture. We prefer grabFrame()
   *  over takePhoto() because it doesn't trigger a shutter pause on the
   *  live preview, returns an ImageBitmap directly, and is significantly
   *  faster. takePhoto() stays as a fallback on devices that don't ship
   *  grabFrame. iOS Safari ships neither; the whole loop no-ops. */
  type IC = {
    grabFrame?: () => Promise<ImageBitmap>;
    takePhoto: () => Promise<Blob>;
  };
  type ICCtor = new (track: MediaStreamTrack) => IC;
  let stillIc: IC | null = null;
  let stillLoopTimer: number | null = null;

  function startStillLoop() {
    const W = window as unknown as { ImageCapture?: ICCtor };
    if (!W.ImageCapture) return;
    const track = activeStream?.getVideoTracks()[0];
    if (!track) return;
    try { stillIc = new W.ImageCapture(track); } catch { return; }

    async function pulse() {
      if (!running || !stillIc) return;
      if (decodeInFlight) return;
      try {
        // Prefer grabFrame: returns ImageBitmap at current frame size, no
        // shutter, no preview pause. Falls back to takePhoto when absent.
        let source: ImageBitmap | Blob;
        if (typeof stillIc.grabFrame === "function") {
          source = await stillIc.grabFrame();
        } else {
          source = await stillIc.takePhoto();
        }
        await tryDecode(async () => {
          const t0 = performance.now();
          const found = await backend.detect(source);
          _lastDecodeMs = Math.round(performance.now() - t0);
          if (source instanceof ImageBitmap) source.close();
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

  // Video decode loop. Runs every 100ms but drops when a decode is in
  // flight, so the effective rate matches whatever the device can do
  // -- around 3-6 fps on Chrome Android at 4K. No queue, no backlog.
  const videoLoopTimer = window.setInterval(() => {
    if (!running) return;
    void tryDecode(decodeVideoFrame).catch((err) => {
      console.debug("video decode skipped:", err);
    });
  }, 100);

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
    setTorch: async (on: boolean) => {
      const t = track();
      if (!t) return;
      const caps = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      if (!caps.torch) return;
      try {
        await t.applyConstraints({
          advanced: [{ torch: on } as MediaTrackConstraintSet & { torch: boolean }],
        });
      } catch (err) {
        console.warn("setTorch failed:", err);
      }
    },
    hasTorch: () => {
      const t = track();
      if (!t || typeof t.getCapabilities !== "function") return false;
      const caps = t.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      return Boolean(caps.torch);
    },
    focusAt: async (x, y) => {
      const t = track();
      if (!t || typeof t.getCapabilities !== "function") return;
      const caps = t.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
        pointsOfInterest?: unknown;
      };
      const advanced: MediaTrackConstraintSet[] = [];
      // pointsOfInterest is in normalized (0..1) space on Chrome.
      if (caps.pointsOfInterest != null) {
        advanced.push({ pointsOfInterest: [{ x, y }] } as unknown as MediaTrackConstraintSet);
      }
      // Switch to single-shot focus to re-engage on this point. Continuous
      // would override on its own; single locks here briefly.
      if (caps.focusMode?.includes("single-shot")) {
        advanced.push({ focusMode: "single-shot" } as MediaTrackConstraintSet);
      }
      if (advanced.length === 0) return;
      try { await t.applyConstraints({ advanced }); } catch (err) { console.debug("focusAt skipped:", err); }
      // After 1.5s, restore continuous focus if supported.
      window.setTimeout(() => {
        const caps2 = t.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] } | undefined;
        if (caps2?.focusMode?.includes("continuous")) {
          void t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => { /* ignore */ });
        }
      }, 1500);
    },
    video,
  };
}
