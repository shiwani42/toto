# Barcode SDK Alternatives to Scandit

Research into open-source and lower-cost alternatives to the Scandit Web SDK for mobile browser barcode scanning.

## Context

This project uses Scandit Web SDK 8.4.0 (paid licence). The features we rely on:

| Feature | Scandit API used |
|---|---|
| Multi-barcode AR overlay — all barcodes in frame, green dots for matches | `BarcodeFind` + `BarcodeFindView` (MatrixScan Find) |
| Single barcode capture with callback | `BarcodeCapture` + `BarcodeCaptureListener` |
| Symbologies | EAN-13, EAN-8, UPC-E, QR, Code128, Code39, DataMatrix |
| Platform | Mobile Safari + Chrome, no app install — pure web WASM |

---

## Hard Platform Constraints

**BarcodeDetector API does not exist on iOS.** Apple has not shipped `BarcodeDetector` in WebKit. Every browser on iOS (Safari, Chrome, Firefox) uses WebKit. Any viable library must work via WASM or pure JS with `getUserMedia` + canvas frame extraction.

**`navigator.vibrate()` is silently ignored on iOS Safari.** No library can work around this — it is a WebKit policy decision. Web Audio API beep is the only feedback option on iOS. Android Chrome supports vibrate normally.

---

## Full Comparison

| Library | EAN-13 | QR | Code128 | DataMatrix | iOS Safari | Multi/frame | AR built-in | License | Cost |
|---|---|---|---|---|---|---|---|---|---|
| `zxing-wasm` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | DIY | Apache 2.0 | Free |
| `zbar-wasm` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | DIY | LGPL-2.1 | Free |
| `@zxing/browser` | ✓ | ✓ | ✓ | ✓ | **BROKEN** | No | No | Apache 2.0 | Free |
| `html5-qrcode` | ✓ | ✓ | ✓ | ✓ | **BROKEN** | No | No | Apache 2.0 | Free |
| `quagga2` | ✓ | ✗ | ✓ | ✗ | Partial | No | No | MIT | Free |
| `BarcodeDetector` API | ✓ | ✓ | ✓ | ✓ | **NO iOS** | Yes | No | Browser API | Free |
| MediaPipe tasks-vision | ✓ | ✓ | ✓ | ✓ | Partial | Yes | DIY | Apache 2.0 | Free |
| STRICH | ✓ | ✓ | ✓ | ✓ | ✓ | Batch | No | Proprietary | $99–249/mo |
| Dynamsoft Barcode Reader | ✓ | ✓ | ✓ | ✓ | ✓ | Yes | No | Proprietary | ~$1,371+/yr |
| Scanbot Web SDK | ✓ | ✓ | ✓ | ✓ | ✓ | Yes | **Yes** | Proprietary | ~$5k–20k/yr |

---

## Library-by-Library Notes

### `zxing-wasm` — Top Free Recommendation

- **npm:** `zxing-wasm` | **GitHub:** github.com/Sec-ant/zxing-wasm
- **License:** Apache 2.0
- **Status:** Actively maintained — last push Jun 2026, only 3 open issues
- **iOS Safari:** Yes (Safari 13+, no known iOS-specific bugs)
- **Symbologies:** Full ZXing-C++ coverage — all 7 required formats plus PDF417, Aztec
- **Multi-barcode:** `readBarcodes(imageData, { maxNumberOfSymbols: 20, formats: [...] })` returns `ReadResult[]` for every barcode detected in a single frame
- **AR overlay:** DIY — each `ReadResult` includes a `position` field with the corner polygon of the barcode, usable directly for canvas drawing
- **Bundle size:** ~1.04 MiB (reader-only WASM build)
- **Key risk:** No published real-world benchmarks for dense EAN-13 shelf scanning under motion on physical iOS. Must test on device before committing.

### `zbar-wasm` — Blocked by DataMatrix

- **License:** LGPL-2.1 (legal review needed for commercial web apps)
- **iOS Safari:** Yes — WASM-based, ~150 ms scan loop on modern iPhones
- **Multi-barcode:** Yes — returns all symbols in a frame with position data
- **Blocker:** No DataMatrix support. Would otherwise be a strong free candidate.

### `@zxing/browser` / `html5-qrcode` — Avoid

- Both use the same underlying ZXing JS engine
- iOS Safari broken in production — confirmed camera re-init failures and scan stalls after first decode (168+ and 439+ open issues respectively)
- EAN-13 scan latency 300 ms–10 s on iPhones in real user reports
- `@zxing/browser` has no active maintainer since early 2024
- **Do not use**

### `quagga2` — Blocked by Missing Symbologies

- **License:** MIT — best-maintained pure-JS barcode library
- **iOS Safari:** Works
- **Blocker:** No QR Code, no DataMatrix. Cannot meet the symbology requirements for this project.

### `BarcodeDetector` API — Useless on iOS

- Native browser API, zero bundle size
- Not shipped in WebKit. Not on Apple's roadmap.
- Works in Chrome/Edge on Android and desktop only.
- **Do not use** for any project that must support iOS.

### MediaPipe `@mediapipe/tasks-vision` — Viable Backup

- **License:** Apache 2.0
- All 7 required symbologies, multi-barcode per frame with bounding boxes
- **iOS Safari:** WebGPU backend unavailable on iOS — falls back to CPU-only WASM inference, materially slower than the GPU path on Android Chrome
- Larger bundle and ML model download vs `zxing-wasm`
- Use only if `zxing-wasm` underperforms on iOS

### STRICH — Best-Value Paid Engine

- **Cost:** $99–249/month
- Proprietary WebGL + WASM engine
- iOS Safari explicitly supported, ~50 ms EAN-13 in good conditions
- All 7 required symbologies
- Multi-barcode: batch scanning across successive frames — not true simultaneous single-frame multi-barcode detection
- AR overlay: not pre-built — DIY canvas layer required
- Good escalation path if `zxing-wasm` underperforms on real devices

### Scanbot Web SDK — Closest BarcodeFind Equivalent

- **Cost:** ~$5k–20k/yr (quote-only), 30-day free trial available
- `ArOverlayFindAndPickConfiguration` is the only pre-built direct equivalent to Scandit's MatrixScan Find / BarcodeFind on the web — AR overlays, find-list tracking, all shipped
- iOS Safari 14.5+, all symbologies
- If time-to-ship matters more than licensing cost, this is the fastest path to feature parity

### Dynamsoft Barcode Reader — Avoid at Scale

- ~$1,371/yr for 10,000 scans (~$0.137/scan)
- Per-scan pricing scales catastrophically for high-frequency shelf scanning
- Best-in-class accuracy on damaged/industrial barcodes, but the pricing model is a dealbreaker

---

## Replicating BarcodeFind with `zxing-wasm`

Scandit's MatrixScan Find ships five things that `zxing-wasm` does not:

1. Frame-by-frame scan loop for all barcodes simultaneously
2. AR dot overlays at each barcode's live position
3. Find-list state — green = on your list, grey = not
4. Sound + haptic feedback on match
5. Visual carousel of items still to find

All of these can be built on top of `zxing-wasm`. Rough implementation:

```ts
// Frame loop
async function scanLoop(video: HTMLVideoElement, canvas: HTMLCanvasElement, list: Set<string>) {
  const ctx = canvas.getContext('2d')!;
  const overlay = overlayCanvas.getContext('2d')!;

  async function tick() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const results = await readBarcodes(imageData, {
      maxNumberOfSymbols: 20,
      formats: ['EAN-13', 'EAN-8', 'UPCE', 'QRCode', 'Code128', 'Code39', 'DataMatrix'],
    });

    overlay.clearRect(0, 0, canvas.width, canvas.height);

    for (const result of results) {
      const matched = list.has(result.text);
      const center = polygonCentroid(result.position.topLeft, result.position.topRight,
                                     result.position.bottomRight, result.position.bottomLeft);

      // Draw dot
      overlay.beginPath();
      overlay.arc(center.x, center.y, 12, 0, Math.PI * 2);
      overlay.fillStyle = matched ? '#2ecc71' : 'rgba(255,255,255,0.4)';
      overlay.fill();

      if (matched) {
        // Web Audio beep (works on iOS)
        beep();
        // Android haptic
        navigator.vibrate?.(40);
        list.delete(result.text);
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
```

**Estimated build effort to reach Scandit BarcodeFind feature parity:**

| Task | Effort |
|---|---|
| Frame capture loop (`requestAnimationFrame` + canvas) | 1–2 days |
| Canvas AR overlay (dots, colour coding, position tracking) | 2–3 days |
| Find-list state + Web Audio beep + Android vibrate | 1–2 days |
| Camera selection UI + iOS autofocus workarounds | 1–2 days |
| Performance tuning for dense shelf labels at 15–30 fps on iOS | 2–5 days |
| **Total** | **~2–3 weeks** |

---

## Recommended Path

**For the current build:** Keep Scandit — the licence is in hand, it works, and BarcodeFind already ships the UI. Don't rebuild it under time pressure.

**For a production / open-source release:**

1. **Start with `zxing-wasm`** — zero cost, Apache 2.0, all required symbologies, multi-barcode per frame with polygon positions for DIY AR. Benchmark on real iOS hardware with a printed shelf of dense EAN-13 barcodes before committing.
2. **Escalate to STRICH** ($99–249/mo) if `zxing-wasm` scan latency is too high on iOS at shelf density. Better engine, still requires building the AR overlay.
3. **Escalate to Scanbot Web SDK** if you need the full BarcodeFind pre-built and have budget. The only web SDK with a shipped MatrixScan Find equivalent.

**Skip entirely:** `@zxing/browser`, `html5-qrcode` (iOS broken), `quagga2` (missing symbologies), `zbar-wasm` (no DataMatrix), `BarcodeDetector` API (no iOS), Dynamsoft (per-scan pricing).
