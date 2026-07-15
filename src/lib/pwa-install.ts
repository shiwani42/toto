/**
 * Subtle "Add to Home Screen" hint for phones that aren't already installed.
 * - Chromium: uses beforeinstallprompt when available.
 * - iOS Safari: shows Share → Add to Home Screen copy (no native prompt API).
 * Dismissed state is remembered in localStorage so we don't spam.
 */

const DISMISS_KEY = "toto.pwaInstallDismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function isStandalone(): boolean {
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && notOther;
}

/** Call once at boot so we can capture the install prompt event. */
export function initPwaInstallCapture(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const fn of promptListeners) fn();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    dismiss();
  });
}

function renderHint(host: HTMLElement): void {
  if (host.querySelector(".pwa-install-hint")) return;
  if (isStandalone() || isDismissed()) return;

  const canPrompt = Boolean(deferredPrompt);
  const ios = isIosSafari();
  if (!canPrompt && !ios) return;

  const el = document.createElement("aside");
  el.className = "pwa-install-hint";
  el.setAttribute("role", "status");
  el.innerHTML = canPrompt
    ? `
      <p class="pwa-install-hint__text">Install Toto on your home screen for a quicker open in-store.</p>
      <div class="pwa-install-hint__actions">
        <button type="button" class="pwa-install-hint__install">Install</button>
        <button type="button" class="pwa-install-hint__dismiss" aria-label="Dismiss">Not now</button>
      </div>
    `
    : `
      <p class="pwa-install-hint__text">Add Toto to your Home Screen: tap Share, then <strong>Add to Home Screen</strong>.</p>
      <div class="pwa-install-hint__actions">
        <button type="button" class="pwa-install-hint__dismiss" aria-label="Dismiss">Got it</button>
      </div>
    `;

  host.appendChild(el);

  el.querySelector(".pwa-install-hint__dismiss")?.addEventListener("click", () => {
    dismiss();
    el.remove();
  });

  el.querySelector(".pwa-install-hint__install")?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    await promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch {
      /* ignore */
    }
    dismiss();
    el.remove();
  });
}

/**
 * Mount a small dismissible install hint into `host` when it makes sense.
 * No-op when already installed, dismissed, or desktop without a prompt.
 */
export function mountInstallHint(host: HTMLElement): void {
  renderHint(host);

  // Chromium often fires beforeinstallprompt after the first paint / SW ready.
  const onPrompt = () => {
    renderHint(host);
    promptListeners.delete(onPrompt);
  };
  promptListeners.add(onPrompt);
}
