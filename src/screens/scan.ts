import { getList } from "../lib/list";
import { getProduct } from "../lib/catalog";
import { announce } from "../lib/prefs";
import { track } from "../lib/analytics";
import { startScanner, type DecodedBarcode, type ScannerHandle } from "../lib/scanner";
import { cameraErrorMessage } from "../lib/camera-errors";
import { t } from "../lib/i18n";
import { totoReact } from "../lib/companion";
import { playFound, playOff } from "../lib/sounds";
import { colorSwatch } from "../lib/colors";

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

  const debug = new URLSearchParams(window.location.search).get("debug") === "1";

  root.innerHTML = `
    <header>
      <h1>${zoneParam ? `${t("scan.zoneTitle")} ${escapeHTML(zoneParam)}.` : t("scan.title")}</h1>
    </header>
    <main class="screen-scan">
      <div id="status" class="status" style="display:none"></div>
      <div class="scan-viewport">
        <div id="capture-view" class="scan-view"></div>
        <canvas id="overlay" class="scan-overlay"></canvas>
        ${debug ? `<div id="scan-debug" class="scan-debug"></div>` : ""}
        <div id="zoom-control" class="scan-zoom" hidden>
          <button id="zoom-out" class="scan-zoom__btn" aria-label="Zoom out">−</button>
          <span id="zoom-label" class="scan-zoom__label">1×</span>
          <button id="zoom-in"  class="scan-zoom__btn" aria-label="Zoom in">+</button>
        </div>
        <div class="scan-aim" aria-hidden="true">
          <span class="scan-aim__corner scan-aim__corner--tl"></span>
          <span class="scan-aim__corner scan-aim__corner--tr"></span>
          <span class="scan-aim__corner scan-aim__corner--bl"></span>
          <span class="scan-aim__corner scan-aim__corner--br"></span>
        </div>
        <button id="cam-switch" class="scan-switch" title="Switch camera" aria-label="Switch camera">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
          </svg>
        </button>
        <button id="torch" class="scan-torch" hidden title="Torch" aria-label="Toggle torch">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 4H6L9 9v11l3-2 3 2V9z"/>
          </svg>
        </button>
        <div id="focus-pulse" class="scan-focus-pulse" hidden></div>
        <div id="scan-start-overlay" class="scan-start-overlay">
          <div class="scan-start-ripple"></div>
          <button id="start-scan-btn" class="scan-start-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            ${t("scan.openCamera")}
          </button>
        </div>
      </div>
      <div id="carousel" class="find-carousel" aria-label="Items to find"></div>
      <div class="find-controls">
        <button id="finish" class="btn-primary" disabled>${t("scan.done")}</button>
        <a class="link-btn" href="?screen=map">${t("scan.back_to_map")}</a>
      </div>
    </main>
  `;

  const statusEl     = root.querySelector("#status") as HTMLDivElement;
  const captureView  = root.querySelector("#capture-view") as HTMLDivElement;
  const overlay      = root.querySelector("#overlay") as HTMLCanvasElement;
  const startBtn     = root.querySelector("#start-scan-btn") as HTMLButtonElement;
  const startOverlay = root.querySelector("#scan-start-overlay") as HTMLDivElement;
  const camSwitchBtn = root.querySelector("#cam-switch") as HTMLButtonElement;
  const carouselEl   = root.querySelector("#carousel") as HTMLDivElement;
  const finishBtn    = root.querySelector("#finish") as HTMLButtonElement;
  const zoomCtrl     = root.querySelector("#zoom-control") as HTMLDivElement;
  const zoomInBtn    = root.querySelector("#zoom-in")  as HTMLButtonElement;
  const zoomOutBtn   = root.querySelector("#zoom-out") as HTMLButtonElement;
  const zoomLabel    = root.querySelector("#zoom-label") as HTMLSpanElement;
  const torchBtn     = root.querySelector("#torch") as HTMLButtonElement;
  const focusPulse   = root.querySelector("#focus-pulse") as HTMLDivElement;
  const viewport     = root.querySelector(".scan-viewport") as HTMLDivElement;

  // ─── List state ───────────────────────────────────────────────────────────

  const wantedSet = new Set(list);
  // Rehydrate the found set from sessionStorage so the user can leave
  // and come back (e.g., walked to the map between zones) without losing
  // progress. Only keep codes that are still wanted.
  const found = new Set<string>(
    (() => {
      try {
        const raw = sessionStorage.getItem(FOUND_KEY);
        if (!raw) return [];
        return (JSON.parse(raw) as string[]).filter((c) => wantedSet.has(c));
      } catch { return []; }
    })(),
  );
  // Items in the current zone (if a zone filter is in play). Drives the
  // "zone done" detection that triggers the auto-return to map.
  const zoneItems = zoneParam
    ? list.filter((c) => getProduct(c)?.zone === zoneParam)
    : list;

  function persistFound() {
    sessionStorage.setItem(FOUND_KEY, JSON.stringify(Array.from(found)));
  }
  function allZoneItemsFound(): boolean {
    return zoneItems.length > 0 && zoneItems.every((c) => found.has(c));
  }

  function renderCarousel() {
    const cards = list.map((code) => {
      const p = getProduct(code);
      const isFound = found.has(code);
      const name = p ? `${p.brand} · ${p.name}` : code;
      const colorWord = p?.color ?? "";
      const swatch = colorSwatch(colorWord);
      const meta = p ? `${colorWord} · size ${p.size}` : "";
      return `
        <div class="find-card ${isFound ? "find-card--done" : ""}" data-code="${escapeHTML(code)}">
          <div class="find-card__swatch" style="background:${swatch}" aria-hidden="true">
            ${isFound ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>` : ""}
          </div>
          <div class="find-card__body">
            <div class="find-card__name">${escapeHTML(name)}</div>
            <div class="find-card__sub">${escapeHTML(meta)}</div>
          </div>
        </div>
      `;
    }).join("");
    carouselEl.innerHTML = cards;
    const allFound = found.size === list.length;
    finishBtn.disabled = found.size === 0;
    finishBtn.textContent = allFound ? t("scan.done") : `${t("scan.done")} (${found.size} / ${list.length})`;
  }
  renderCarousel();

  /** Triumph animation when a list item is found for the first time.
   *  Scrolls its card into view, plays a green-halo bounce, and triggers
   *  a brief Toto-pop ping in the viewport's corner. */
  function celebrateFind(code: string) {
    const card = carouselEl.querySelector<HTMLElement>(`.find-card[data-code="${cssEscape(code)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      card.classList.remove("find-card--celebrate");
      void card.offsetWidth;                     // restart the animation
      card.classList.add("find-card--celebrate");
      window.setTimeout(() => card.classList.remove("find-card--celebrate"), 900);
    }
    // Quick green flash on the whole carousel container for proprioception.
    carouselEl.classList.remove("find-carousel--flash");
    void carouselEl.offsetWidth;
    carouselEl.classList.add("find-carousel--flash");
    window.setTimeout(() => carouselEl.classList.remove("find-carousel--flash"), 500);
  }

  function cssEscape(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  }


  // ─── Overlay rendering ────────────────────────────────────────────────────

  // The overlay canvas is sized to match the video element on screen. We
  // scale incoming barcode positions from image pixels into CSS pixels
  // (which match the canvas internal pixels at devicePixelRatio = 1).
  function sizeOverlayTo(video: HTMLVideoElement) {
    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(rect.width * dpr);
    overlay.height = Math.round(rect.height * dpr);
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.dataset.dpr = String(dpr);
  }

  // Persistent buffer of recently-seen pins. The decoder runs at a few
  // fps and individual frames sometimes miss codes that were visible a
  // moment ago. Keeping each pin on screen for a short trailing window
  // smooths over those gaps and makes multi-barcode views actually look
  // like multi-barcode views.
  type PinEntry = {
    text: string;
    position: DecodedBarcode["position"];
    lastSeen: number;
    inserted: number;
  };
  const PIN_TTL_MS = 1500;
  const PIN_FADE_AFTER_MS = 1000;
  const pinBuffer = new Map<string, PinEntry>();

  function drawOverlay(handle: ScannerHandle, barcodes: DecodedBarcode[], srcW: number, srcH: number) {
    const dpr = Number(overlay.dataset.dpr || "1");
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const now = performance.now();

    // Update buffer with this frame's detections; refresh positions and
    // timestamps for re-seen codes.
    for (const b of barcodes) {
      const existing = pinBuffer.get(b.text);
      pinBuffer.set(b.text, {
        text: b.text,
        position: b.position,
        lastSeen: now,
        inserted: existing?.inserted ?? now,
      });
    }
    // Evict pins that haven't been re-seen in a while.
    for (const [k, e] of pinBuffer) {
      if (now - e.lastSeen > PIN_TTL_MS) pinBuffer.delete(k);
    }

    if (srcW === 0 || srcH === 0) return;
    // Object-fit: cover scaling — video fills the box, may be cropped.
    const rect = handle.video.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    const scale = Math.max(cssW / srcW, cssH / srcH);
    const drawnW = srcW * scale;
    const drawnH = srcH * scale;
    const offsetX = (cssW - drawnW) / 2;
    const offsetY = (cssH - drawnH) / 2;
    const toCanvas = (pt: { x: number; y: number }) => ({
      x: (pt.x * scale + offsetX) * dpr,
      y: (pt.y * scale + offsetY) * dpr,
    });

    for (const pin of pinBuffer.values()) {
      const matched = wantedSet.has(pin.text);
      const already = found.has(pin.text);
      const product = getProduct(pin.text);
      const p = pin.position;
      const cx = (p.topLeft.x + p.topRight.x + p.bottomLeft.x + p.bottomRight.x) / 4;
      const cy = (p.topLeft.y + p.topRight.y + p.bottomLeft.y + p.bottomRight.y) / 4;
      const c = toCanvas({ x: cx, y: cy });

      // Fade out as the pin gets stale.
      const age = now - pin.lastSeen;
      const alpha = age <= PIN_FADE_AFTER_MS
        ? 1
        : Math.max(0, 1 - (age - PIN_FADE_AFTER_MS) / (PIN_TTL_MS - PIN_FADE_AFTER_MS));

      const fill = matched ? `rgba(46, 204, 113, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.85})`;
      const ring = matched && already;

      // Dot at the barcode centroid.
      ctx.beginPath();
      ctx.arc(c.x, c.y, 12 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.4})`;
      ctx.shadowBlur = 8 * dpr;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (ring) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 19 * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2.5 * dpr;
        ctx.stroke();
      }

      // Floating product label so the user knows WHAT they're looking
      // at without checking the carousel.
      if (product) {
        drawProductLabel(ctx, dpr, c, product, matched, already, alpha);
      }
    }
  }

  /** Draws a small label chip with brand + name + size next to a barcode pin.
   *  Matched items get a green chip, off-list items a quiet white chip,
   *  already-found items get a check icon prepended. */
  function drawProductLabel(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    c: { x: number; y: number },
    product: { brand: string; name: string; size: string },
    matched: boolean,
    already: boolean,
    alpha: number,
  ): void {
    const padX = 12 * dpr;
    const padY = 8 * dpr;
    const fontSize = 13 * dpr;
    const lineHeight = 15 * dpr;
    ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;

    const titleLine = `${product.brand} · ${product.name}`;
    const subLine = `size ${product.size}`;
    const maxTitleWidth = 220 * dpr;
    const titleText = truncateText(ctx, titleLine, maxTitleWidth);

    const titleWidth = ctx.measureText(titleText).width;
    ctx.font = `400 ${fontSize - dpr * 2}px "Inter", system-ui, sans-serif`;
    const subWidth = ctx.measureText(subLine).width;

    const contentWidth = Math.max(titleWidth, subWidth) + (already ? 18 * dpr : 0);
    const w = contentWidth + padX * 2;
    const h = lineHeight * 2 + padY * 2;

    // Place above the dot when there's room, otherwise below.
    const aboveY = c.y - 22 * dpr - h;
    const belowY = c.y + 22 * dpr;
    const y = aboveY < 4 * dpr ? belowY : aboveY;
    let x = c.x - w / 2;
    // Keep label fully within canvas bounds.
    if (x < 6 * dpr) x = 6 * dpr;
    if (x + w > overlay.width - 6 * dpr) x = overlay.width - 6 * dpr - w;

    // Background chip.
    const bg = matched
      ? `rgba(34, 96, 64, ${alpha * 0.92})`         // accent-strong with alpha
      : `rgba(28, 28, 28, ${alpha * 0.78})`;
    roundedRect(ctx, x, y, w, h, 12 * dpr);
    ctx.fillStyle = bg;
    ctx.fill();

    // Text.
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.textBaseline = "top";
    let textX = x + padX;
    if (already) {
      // Check icon, drawn manually.
      ctx.beginPath();
      const cxIcon = textX + 6 * dpr;
      const cyIcon = y + padY + lineHeight / 2;
      ctx.moveTo(cxIcon - 4 * dpr, cyIcon);
      ctx.lineTo(cxIcon - 1 * dpr, cyIcon + 3 * dpr);
      ctx.lineTo(cxIcon + 5 * dpr, cyIcon - 3 * dpr);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      textX += 14 * dpr;
    }
    ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.fillText(titleText, textX, y + padY);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.font = `400 ${fontSize - dpr * 2}px "Inter", system-ui, sans-serif`;
    ctx.fillText(subLine, textX, y + padY + lineHeight);
  }

  function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const candidate = text.slice(0, mid) + "…";
      if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1;
      else hi = mid;
    }
    return text.slice(0, Math.max(1, lo - 1)) + "…";
  }

  function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Status + boot ─────────────────────────────────────────────────────────

  function setStatus(msg: string) {
    statusEl.style.display = msg ? "" : "none";
    statusEl.textContent = msg;
  }

  let handle: ScannerHandle | null = null;

  async function boot(): Promise<void> {
    setStatus(t("scan.warming"));
    try {
      // If the camera is running but no barcodes have been seen after a
      // few seconds of frames, nudge the user. Most "doesn't work" cases
      // are the phone being too far from the barcode.
      let droughtTimer: number | null = null;
      let droughtArmed = false;
      function armDroughtNudge() {
        if (droughtArmed) return;
        droughtArmed = true;
        droughtTimer = window.setTimeout(() => {
          if (found.size === 0) setStatus(t("scan.hold_closer"));
        }, 4000);
      }
      function disarmDroughtNudge() {
        if (droughtTimer !== null) { window.clearTimeout(droughtTimer); droughtTimer = null; }
        droughtArmed = false;
      }

      handle = await startScanner({
        host: captureView,
        onFrame: ({ barcodes, width, height, stats }) => {
          if (!handle) return;
          if (overlay.width === 0) sizeOverlayTo(handle.video);
          drawOverlay(handle, barcodes, width, height);
          if (stats.framesDecoded > 10 && stats.codesDetected === 0) armDroughtNudge();
          else if (stats.codesDetected > 0) disarmDroughtNudge();
          if (debug) {
            const dbg = root.querySelector("#scan-debug") as HTMLDivElement | null;
            if (dbg) {
              const last = barcodes.length > 0 ? `[${barcodes[0].format}] ${barcodes[0].text}` : "—";
              dbg.textContent = `${stats.backend} · ${stats.fps}fps · ${stats.lastDecodeMs}ms · frame:${barcodes.length} buf:${pinBuffer.size} · ${last}`;
            }
          }
        },
        onScan: (code) => {
          const matched = wantedSet.has(code.text);
          if (matched && !found.has(code.text)) {
            found.add(code.text);
            persistFound();
            playFound();
            if ("vibrate" in navigator) navigator.vibrate([20, 40, 30]);
            const p = getProduct(code.text);
            const label = p ? `Found: ${p.brand} ${p.name}` : `Found: ${code.text}`;
            announce(label);
            track("scan_found", { code: code.text, in_list: true });
            renderCarousel();
            celebrateFind(code.text);
            totoReact("jump"); // he's excited you got it
            // Auto-flow: when every item in this zone is checked off,
            // celebrate briefly then send the user back to the map for
            // the next stop. If the whole list is done, jump to done.
            if (allZoneItemsFound()) {
              const allDone = list.every((c) => found.has(c));
              // Remember where the shopper is — the map redraws its
              // route from this point instead of always from the entry.
              if (zoneParam) sessionStorage.setItem("toto.currentLoc", zoneParam);
              handle?.stop();
              window.setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set("screen", allDone ? "done" : "map");
                url.searchParams.delete("zone");
                window.location.href = url.toString();
              }, 1100);
            }
          } else if (matched) {
            // Already-found re-detection: gentle beep, no log.
            playFound();
          } else {
            // Off-list barcode: muted tone, log for analytics.
            playOff();
            track("scan_found", { code: code.text, in_list: false });
          }
        },
      });
      track("scan_started", { list_size: list.length });

      // Size overlay once video metadata is loaded; resize on window resize.
      const fitOverlay = () => { if (handle) sizeOverlayTo(handle.video); };
      fitOverlay();
      window.addEventListener("resize", fitOverlay);

      setStatus(`${t("scan.looking")} ${list.length} · ${list.length === 1 ? "item" : "items"}`);

      // Set up zoom controls if the device supports them.
      const range = handle.getZoomRange();
      if (range && range.max > range.min) {
        zoomCtrl.hidden = false;
        let current = range.current || range.min;
        const step = Math.max(range.step, 0.5);
        function updateLabel() { zoomLabel.textContent = `${current.toFixed(1)}×`; }
        updateLabel();
        zoomInBtn.addEventListener("click", async () => {
          if (!handle) return;
          current = Math.min(range.max, current + step);
          await handle.setZoom(current);
          updateLabel();
        });
        zoomOutBtn.addEventListener("click", async () => {
          if (!handle) return;
          current = Math.max(range.min, current - step);
          await handle.setZoom(current);
          updateLabel();
        });
      }

      // Torch button if the camera exposes one.
      if (handle.hasTorch()) {
        torchBtn.hidden = false;
        let torchOn = false;
        torchBtn.addEventListener("click", async () => {
          if (!handle) return;
          torchOn = !torchOn;
          await handle.setTorch(torchOn);
          torchBtn.classList.toggle("scan-torch--on", torchOn);
        });
      }

      // Tap on the viewport → focus the camera there. Skip taps that
      // hit the existing controls (zoom buttons, torch, camera switch).
      viewport.addEventListener("click", (e) => {
        if (!handle) return;
        const target = e.target as HTMLElement;
        if (target.closest(".scan-switch, .scan-zoom, .scan-torch, .scan-start-overlay, #scan-debug")) return;
        const rect = handle.video.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        void handle.focusAt(x, y);
        // Visual feedback: a pulse where the user tapped.
        focusPulse.style.left = `${e.clientX - rect.left}px`;
        focusPulse.style.top  = `${e.clientY - rect.top}px`;
        focusPulse.hidden = false;
        focusPulse.classList.remove("scan-focus-pulse--animate");
        void focusPulse.offsetWidth;
        focusPulse.classList.add("scan-focus-pulse--animate");
        window.setTimeout(() => { focusPulse.hidden = true; }, 700);
      });
    } catch (err) {
      console.error("Scan boot failed:", err);
      setStatus(cameraErrorMessage(err));
      startOverlay.style.display = "";
      startBtn.disabled = false;
    }
  }

  startBtn.addEventListener("click", () => {
    startOverlay.style.display = "none";
    startBtn.disabled = true;
    void boot();
  });

  camSwitchBtn.addEventListener("click", async () => {
    if (!handle) return;
    setStatus(t("scan.switching"));
    try {
      await handle.switchCamera();
      setStatus("");
    } catch (err) {
      console.warn("camera switch failed:", err);
      setStatus("Couldn't switch camera.");
    }
  });

  finishBtn.addEventListener("click", () => {
    const codes = Array.from(found);
    sessionStorage.setItem(FOUND_KEY, JSON.stringify(codes));
    track("scan_completed", { list_size: list.length, found_count: codes.length });
    announce(`Found ${codes.length} of ${list.length}. All done.`);
    handle?.stop();
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "done");
    url.searchParams.delete("zone");
    window.location.href = url.toString();
  });

  // Stop the scanner when the user navigates away (popstate / link click).
  window.addEventListener("pagehide", () => { handle?.stop(); }, { once: true });
}
