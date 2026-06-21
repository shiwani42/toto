// Ambient Toto: a small persistent companion in the top-left of every
// screen (except home, where he's the big mascot). The design principle
// is "iPad-intuitive": he's impossible to miss, subtle but alive,
// rewards tapping with a brief warm note in the user's language, and
// gets out of the way otherwise.
//
// What's alive about him:
//   * Gentle breathing scale (always on, slow, ~3 s cycle)
//   * Random blinks every 4-7 s
//   * Occasional ear twitches every 12-20 s
//   * On tap: bouncy scale-up, his line drops in a soft spring, haptic ping
//   * After 8 s of bubble inactivity, he settles back into idle
//
// He is not chatty. One short line per screen. No notifications, no
// nudges he wasn't asked to give. Restraint is the whole design.

import { totoAvatar } from "./toto";
import type { Screen } from "./types";
import { t } from "./i18n";

// Map screens to their i18n key. Single source of truth. Add a screen
// here when you want Toto present on it; omit to hide him.
const TOTO_KEYS: Partial<Record<Screen, string>> = {
  list:      "toto.list",
  map:       "toto.map",
  scan:      "toto.scan",
  done:      "toto.done",
  plan:      "toto.plan",
  browse:    "toto.browse",
  compare:   "toto.compare",
  repair:    "toto.repair",
  connect:   "toto.connect",
  connected: "toto.connected",
  settings:  "toto.settings",
  fit:       "toto.fit",
};

let lastScreen: Screen | null = null;
let open = false;
let collapseTimer: number | undefined;
let blinkTimer: number | undefined;
let twitchTimer: number | undefined;

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clearTimers() {
  if (collapseTimer)  window.clearTimeout(collapseTimer);
  if (blinkTimer)     window.clearTimeout(blinkTimer);
  if (twitchTimer)    window.clearTimeout(twitchTimer);
  collapseTimer = blinkTimer = twitchTimer = undefined;
}

export function mountCompanion(screen: Screen) {
  const existing = document.getElementById("toto-companion");
  if (existing) existing.remove();
  clearTimers();

  // Home has its own giant Toto. The floating one would feel redundant.
  // Skip admin too — that's staff-side, no companion needed.
  if (screen === "home" || screen === "admin") return;

  const key = TOTO_KEYS[screen];
  const phrase = key ? t(key) : t("toto.fallback");

  if (lastScreen !== screen) open = false;
  lastScreen = screen;

  const root = document.createElement("div");
  root.id = "toto-companion";
  root.className = `toto-companion ${open ? "toto-companion--open" : ""}`;
  root.innerHTML = `
    <button type="button" class="toto-companion__avatar" id="toto-companion-avatar"
            aria-label="${escapeHTML(t("toto.tap_hint"))}" title="${escapeHTML(t("toto.tap_hint"))}">
      <span class="toto-companion__breath">${totoAvatar(56)}</span>
      <span class="toto-companion__dot" aria-hidden="true"></span>
    </button>
    <div class="toto-companion__bubble" id="toto-bubble" role="status" aria-live="polite">
      <span class="toto-companion__text">${escapeHTML(phrase)}</span>
    </div>
  `;
  document.body.appendChild(root);

  const dog = root.querySelector("#toto-companion-avatar") as HTMLButtonElement;
  const bubble = root.querySelector("#toto-bubble") as HTMLDivElement;
  const breath = root.querySelector(".toto-companion__breath") as HTMLSpanElement;

  function setOpen(state: boolean) {
    open = state;
    root.classList.toggle("toto-companion--open", state);
    if (state) scheduleCollapse();
    else if (collapseTimer) window.clearTimeout(collapseTimer);
  }

  function scheduleCollapse() {
    if (collapseTimer) window.clearTimeout(collapseTimer);
    collapseTimer = window.setTimeout(() => setOpen(false), 8000);
  }

  // Random blinks every 4-7s. Adds the smallest amount of life without
  // ever being distracting. A blink is a 120ms eye-close via CSS class.
  function scheduleBlink() {
    const delay = 4000 + Math.random() * 3000;
    blinkTimer = window.setTimeout(() => {
      breath.classList.add("toto-companion__breath--blink");
      window.setTimeout(() => breath.classList.remove("toto-companion__breath--blink"), 140);
      scheduleBlink();
    }, delay);
  }

  // Rare ear twitch / head tilt every 12-20s. Lower frequency than blinks
  // so it feels intentional, not nervous.
  function scheduleTwitch() {
    const delay = 12000 + Math.random() * 8000;
    twitchTimer = window.setTimeout(() => {
      breath.classList.add("toto-companion__breath--twitch");
      window.setTimeout(() => breath.classList.remove("toto-companion__breath--twitch"), 700);
      scheduleTwitch();
    }, delay);
  }

  scheduleBlink();
  scheduleTwitch();

  dog.addEventListener("click", () => {
    setOpen(!open);
    if ("vibrate" in navigator) navigator.vibrate(8);
    // A small "noticed" reaction on tap, regardless of open/close.
    breath.classList.add("toto-companion__breath--noticed");
    window.setTimeout(() => breath.classList.remove("toto-companion__breath--noticed"), 350);
  });
  // Allow tapping the bubble to dismiss as well.
  bubble.addEventListener("click", () => { setOpen(false); });
}
