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
  type ReadResult,
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

const MAX_BARCODES_PER_FRAME = 8;
const STABILITY_FRAMES = 1;        // report on first valid sighting; faster feedback
// Don't downsample below 1280. Empirically (see _decode_test.mjs results),
// zxing-wasm needs ~250+ pixels of barcode bar width to decode reliably.
// A typical phone frame is 1280x720; if a small barcode fills 30% of the
// frame, that's 384 pixels at full res — readable. Halving the frame turns
// that into 192 pixels — below the threshold. 1280 wide decodes in ~20ms
// per frame anyway, so there's nothing to gain by going lower.
const DECODE_TARGET_WIDTH = 1280;

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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing,
        // Hint at HD; the device picks whatever it can deliver.
        width:  { ideal: 1280 },
        height: { ideal: 720  },
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

  const seen = new Map<string, number>();        // value -> consecutive frames
  const reported = new Set<string>();             // values already fired via onScan
  let running = true;
  let inFlight = false;                            // gate concurrent decode calls

  // Stats for the optional debug overlay. Caller can read these.
  let _framesDecoded = 0;
  let _codesDetected = 0;
  let _lastDecodeMs = 0;
  let _statsWindowStart = performance.now();
  let _statsWindowFrames = 0;
  let _fps = 0;

  async function tick(): Promise<void> {
    if (!running) return;
    requestAnimationFrame(() => { void tick(); });

    if (inFlight) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // Downsample to DECODE_TARGET_WIDTH for the decoder. Most barcode formats
    // need ~80 pixels of bar width to read reliably; 720px-wide source covers
    // that with room to spare and is 3-4x faster than 1280p on mobile WASM.
    const scale = Math.min(1, DECODE_TARGET_WIDTH / vw);
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);
    if (offscreen.width !== dw || offscreen.height !== dh) {
      offscreen.width = dw;
      offscreen.height = dh;
    }
    inFlight = true;
    const t0 = performance.now();
    try {
      ctx.drawImage(video, 0, 0, dw, dh);
      const imageData = ctx.getImageData(0, 0, dw, dh);
      // tryHarder is for one-shot image-file scans; way too slow per-frame.
      // tryRotate is cheap and helps when the phone is held at an angle.
      const results: ReadResult[] = await readBarcodes(imageData, {
        formats: FORMATS,
        maxNumberOfSymbols: MAX_BARCODES_PER_FRAME,
        tryRotate: true,
        tryInvert: false,
      });
      _framesDecoded++;
      _lastDecodeMs = Math.round(performance.now() - t0);

      // Re-scale positions back to source-video coordinates so the overlay
      // math in the caller (which works in video-px space) stays correct.
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
      _codesDetected += found.length;

      // Track stability — same code seen N frames in a row gets reported.
      const codesThisFrame = new Set(found.map((b) => b.text));
      for (const [k] of seen) {
        if (!codesThisFrame.has(k)) seen.delete(k);
      }
      for (const b of found) {
        const n = (seen.get(b.text) ?? 0) + 1;
        seen.set(b.text, n);
        if (n === STABILITY_FRAMES) {
          if (opts.dedupe === false || !reported.has(b.text)) {
            reported.add(b.text);
            opts.onScan?.(b);
          }
        }
      }

      // Rolling FPS over the last 1s window.
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
        stats: {
          fps: _fps,
          framesDecoded: _framesDecoded,
          codesDetected: _codesDetected,
          lastDecodeMs: _lastDecodeMs,
        },
      });
    } catch (err) {
      // Don't crash the loop on decoder errors; just keep going.
      console.debug("decode error:", err);
    } finally {
      inFlight = false;
    }
  }

  void tick();

  return {
    stop: () => {
      running = false;
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
    video,
  };
}
