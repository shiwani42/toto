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

const MAX_BARCODES_PER_FRAME = 12;
const STABILITY_FRAMES = 2;       // barcode must persist this many frames before reporting

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

export type FrameInfo = {
  barcodes: DecodedBarcode[];
  /** Width of the source video frame, in pixels. */
  width: number;
  /** Height of the source video frame, in pixels. */
  height: number;
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

  async function tick(): Promise<void> {
    if (!running) return;
    requestAnimationFrame(() => { void tick(); });

    if (inFlight) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;
    if (offscreen.width !== vw || offscreen.height !== vh) {
      offscreen.width = vw;
      offscreen.height = vh;
    }
    inFlight = true;
    try {
      ctx.drawImage(video, 0, 0, vw, vh);
      const imageData = ctx.getImageData(0, 0, vw, vh);
      const results: ReadResult[] = await readBarcodes(imageData, {
        formats: FORMATS,
        maxNumberOfSymbols: MAX_BARCODES_PER_FRAME,
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
      });

      const found: DecodedBarcode[] = results
        .filter((r) => r.isValid && r.text)
        .map((r) => ({
          text: r.text,
          format: String(r.format),
          position: r.position,
        }));

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

      opts.onFrame({ barcodes: found, width: vw, height: vh });
    } catch (err) {
      // Don't crash the loop on decoder errors; just keep going.
      // (zxing-wasm rarely throws once initialized.)
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
