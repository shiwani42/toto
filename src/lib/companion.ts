// Toto companion: a small floating Toto with a speech bubble that says
// something contextual per screen. Tap to advance through the phrases,
// tap × to collapse. Replaces the old "tap-to-go-home" corner avatar.

import { totoAvatar } from "./toto";
import type { Screen } from "./types";

// One contextual line per screen. No cycling — what you see is what you get.
const PHRASE: Partial<Record<Screen, string>> = {
  list:      "Search anything and I'll keep it on the list.",
  map:       "Tap a zone to start scanning there.",
  scan:      "Anything on your list lights up green.",
  done:      "Nicely done.",
  plan:      "Just answer what you know. Skip the rest.",
  browse:    "Point at any barcode and I'll explain it.",
  compare:   "Scan slot A, then slot B.",
  repair:    "Scan something you've had a while.",
  connect:   "Start a session or join one.",
  connected: "You're in. Share the code.",
  settings:  "Tweak whatever you like.",
  fit:       "One quick photo. Nothing stored.",
};

let lastScreen: Screen | null = null;
let open = true;
let collapseTimer: number | undefined;

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mountCompanion(screen: Screen) {
  // Home has the big mascot. No companion bubble there.
  const existing = document.getElementById("toto-companion");
  if (existing) existing.remove();
  if (screen === "home") return;

  const phrase = PHRASE[screen] ?? "I'm here if you need me.";
  // Reset open state whenever the screen changes.
  if (lastScreen !== screen) open = true;
  lastScreen = screen;

  const root = document.createElement("div");
  root.id = "toto-companion";
  root.className = `toto-companion ${open ? "toto-companion--open" : ""}`;
  root.innerHTML = `
    <div class="toto-companion__bubble" id="toto-bubble" aria-live="polite">
      <span class="toto-companion__text">${escapeHTML(phrase)}</span>
      <button type="button" class="toto-companion__close" id="toto-close" aria-label="Hide" title="Hide">×</button>
    </div>
    <button type="button" class="toto-companion__avatar" id="toto-companion-avatar" aria-label="Show or hide Toto">
      ${totoAvatar(40)}
    </button>
  `;
  document.body.appendChild(root);

  const closeX = root.querySelector("#toto-close") as HTMLButtonElement;
  const dog = root.querySelector("#toto-companion-avatar") as HTMLButtonElement;

  function setOpen(state: boolean) {
    open = state;
    root.classList.toggle("toto-companion--open", state);
    if (state) scheduleCollapse();
    else window.clearTimeout(collapseTimer);
  }

  function scheduleCollapse() {
    window.clearTimeout(collapseTimer);
    collapseTimer = window.setTimeout(() => setOpen(false), 7000);
  }

  closeX.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  // Tap on Toto just toggles the bubble. No random phrase cycling.
  dog.addEventListener("click", () => {
    setOpen(!open);
    if ("vibrate" in navigator) navigator.vibrate(8);
  });

  scheduleCollapse();
}
