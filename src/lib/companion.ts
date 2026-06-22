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
import {
  isVoiceSupported, startListening, speak, parseIntent,
  isVoiceModeOn, setVoiceMode,
  type ListenHandle,
} from "./voice";
import { search } from "./catalog";

// Multiple lines per screen — randomly picked each render so the user
// doesn't see the same greeting twice. Each entry is a list of i18n
// keys; we resolve at call time. Pool size is small (3-4) so it stays
// fresh without feeling overwhelming.
const TOTO_KEYS: Partial<Record<Screen, string[]>> = {
  list:      ["toto.list", "toto.list.alt1", "toto.list.alt2"],
  map:       ["toto.map", "toto.map.alt1", "toto.map.alt2"],
  scan:      ["toto.scan", "toto.scan.alt1", "toto.scan.alt2"],
  done:      ["toto.done", "toto.done.alt1", "toto.done.alt2"],
  plan:      ["toto.plan", "toto.plan.alt1"],
  browse:    ["toto.browse", "toto.browse.alt1", "toto.browse.alt2"],
  compare:   ["toto.compare"],
  repair:    ["toto.repair"],
  connect:   ["toto.connect"],
  connected: ["toto.connected"],
  settings:  ["toto.settings"],
  fit:       ["toto.fit"],
};

function pickLine(screen: Screen): string {
  const pool = TOTO_KEYS[screen];
  if (!pool || pool.length === 0) return t("toto.fallback");
  const k = pool[Math.floor(Math.random() * pool.length)];
  return t(k);
}

// ─── Contextual suggestions ────────────────────────────────────────────────
//
// Screens can ask Toto to surface a feature contextually: "want to compare?",
// "want to check fit?", etc. Each suggestion has a stable id so once the
// user dismisses it (taps the bubble or "not now"), we don't pester them
// again this session.

type Suggestion = {
  id: string;
  text: string;
  cta?: { label: string; href: string };
};

const DISMISS_KEY = "toto.dismissedSuggestions";

function dismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function markDismissed(id: string) {
  const s = dismissedIds();
  s.add(id);
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

// Holds the most recent suggestion that's been pushed. The next mount
// of the companion picks it up if it hasn't been dismissed.
let pendingSuggestion: Suggestion | null = null;

/** Push a contextual feature suggestion to Toto. Call this from any
 *  screen when the moment is right. The companion will show it the next
 *  time it (re-)renders, unless this suggestion id was already dismissed
 *  in this session. */
export function pushSuggestion(s: Suggestion) {
  if (dismissedIds().has(s.id)) return;
  pendingSuggestion = s;
  // If a companion is currently mounted, re-render it to surface the suggestion.
  refreshCompanion();
}

function refreshCompanion() {
  const existing = document.getElementById("toto-companion");
  if (!existing) return;
  // Re-render by re-calling mount with last screen.
  if (lastScreen) mountCompanion(lastScreen);
}

// ─── Reaction triggers (pet-like personality) ──────────────────────────────
//
// Toto reacts to events around the user. Each reaction is a short CSS
// animation class applied to his "breath" wrapper. Calls are idempotent
// and safe even when Toto isn't mounted (home screen).

type Mood = "wag" | "perk" | "jump" | "tilt" | "sleep";

function findBreath(): HTMLElement | null {
  return document.querySelector("#toto-companion .toto-companion__breath") as HTMLElement | null;
}

/** React to an event. Tail wag (added item), perk ears (greet new screen),
 *  jump (found something on the list), tilt (puzzled), sleep (idle). */
export function totoReact(mood: Mood, ms = 700) {
  const el = findBreath();
  if (!el) return;
  const cls = `toto-companion__breath--${mood}`;
  el.classList.remove(cls);
  // Force reflow so the same animation can be re-triggered.
  void el.offsetWidth;
  el.classList.add(cls);
  if (mood === "sleep") return; // sleep is sticky until movement
  window.setTimeout(() => el.classList.remove(cls), ms);
}

/** Idle watchdog: if there's no user input for a while, Toto drops into
 *  a "resting" pose. Any tap/scroll wakes him. */
let idleTimer: number | null = null;
function bumpIdle() {
  if (idleTimer) window.clearTimeout(idleTimer);
  const el = findBreath();
  el?.classList.remove("toto-companion__breath--sleep");
  idleTimer = window.setTimeout(() => totoReact("sleep"), 60_000);
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", bumpIdle, { passive: true });
  window.addEventListener("scroll",      bumpIdle, { passive: true });
}

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

  const screenPhrase = pickLine(screen);

  // If there's a pending suggestion that hasn't been dismissed, surface it
  // instead of the static screen line, AND auto-open the bubble with a
  // gentle pulse to draw attention.
  const dismissed = dismissedIds();
  const suggestion = pendingSuggestion && !dismissed.has(pendingSuggestion.id) ? pendingSuggestion : null;
  const phrase = suggestion ? suggestion.text : screenPhrase;
  const isSuggestion = Boolean(suggestion);

  if (lastScreen !== screen && !isSuggestion) open = false;
  if (isSuggestion) open = true;          // proactively open for a suggestion
  lastScreen = screen;

  const ctaHTML = suggestion?.cta
    ? `<a class="toto-companion__cta" href="${escapeHTML(suggestion.cta.href)}" data-cta-id="${escapeHTML(suggestion.id)}">${escapeHTML(suggestion.cta.label)}</a>`
    : "";
  const dismissBtn = suggestion
    ? `<button type="button" class="toto-companion__not-now" data-dismiss-id="${escapeHTML(suggestion.id)}">${escapeHTML(t("toto.not_now"))}</button>`
    : "";

  const voiceAvailable = isVoiceSupported().stt;

  const root = document.createElement("div");
  root.id = "toto-companion";
  root.className = `toto-companion ${open ? "toto-companion--open" : ""} ${isSuggestion ? "toto-companion--suggesting" : ""}`;
  root.innerHTML = `
    <div class="toto-companion__row">
      <button type="button" class="toto-companion__avatar" id="toto-companion-avatar"
              aria-label="${escapeHTML(t("toto.tap_hint"))}" title="${escapeHTML(t("toto.tap_hint"))}">
        <span class="toto-companion__breath">${totoAvatar(56)}</span>
        <span class="toto-companion__dot" aria-hidden="true"></span>
      </button>
      ${voiceAvailable ? `
        <button type="button" class="toto-companion__mic" id="toto-companion-mic"
                aria-label="${escapeHTML(t("toto.mic_label"))}" title="${escapeHTML(t("toto.mic_label"))}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3"/>
            <path d="M5 11a7 7 0 0 0 14 0"/>
            <path d="M12 18v3"/>
          </svg>
        </button>
      ` : ""}
    </div>
    <div class="toto-companion__bubble" id="toto-bubble" role="status" aria-live="polite">
      <span class="toto-companion__text">${escapeHTML(phrase)}</span>
      ${ctaHTML}
      ${dismissBtn}
    </div>
  `;
  document.body.appendChild(root);

  // Wire CTA: dismiss after tap so we don't keep prompting.
  if (suggestion) {
    const cta = root.querySelector("[data-cta-id]") as HTMLAnchorElement | null;
    cta?.addEventListener("click", () => {
      markDismissed(suggestion.id);
      pendingSuggestion = null;
    });
    const not = root.querySelector("[data-dismiss-id]") as HTMLButtonElement | null;
    not?.addEventListener("click", (e) => {
      e.stopPropagation();
      markDismissed(suggestion.id);
      pendingSuggestion = null;
      // Restore the static screen line.
      const txt = root.querySelector(".toto-companion__text") as HTMLSpanElement;
      if (txt) txt.textContent = screenPhrase;
      const ctaEl = root.querySelector(".toto-companion__cta");
      const notEl = root.querySelector(".toto-companion__not-now");
      ctaEl?.remove();
      notEl?.remove();
    });
  }

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

  // Distinguish tap from long-press. Hold for >400ms starts voice mode;
  // a quick tap toggles the bubble.
  const LONG_PRESS_MS = 400;
  let pressTimer: number | null = null;
  let pressedAt = 0;
  let voiceActive = false;
  let listenHandle: ListenHandle | null = null;
  const voiceCapable = isVoiceSupported().stt;

  function bubbleText(text: string) {
    const el = root.querySelector(".toto-companion__text") as HTMLSpanElement | null;
    if (el) el.textContent = text;
  }

  function startVoice() {
    voiceActive = true;
    root.classList.add("toto-companion--listening");
    setOpen(true);
    bubbleText(t("toto.listening"));
    if ("vibrate" in navigator) navigator.vibrate(20);
    listenHandle = startListening(
      (text) => { handleVoiceResult(text); },
      (err)  => { bubbleText(t("toto.voice_error")); console.warn("voice:", err); endVoice(); },
    );
  }

  function endVoice() {
    voiceActive = false;
    root.classList.remove("toto-companion--listening");
    listenHandle?.stop();
    listenHandle = null;
  }

  function handleVoiceResult(text: string) {
    bubbleText(`"${text}"`);
    const intent = parseIntent(text);
    endVoice();
    if (intent.kind === "go") {
      const reply = t("toto.voice.ok");
      speak(reply);
      window.setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("screen", intent.screen);
        window.location.href = url.toString();
      }, 400);
      return;
    }
    if (intent.kind === "find") {
      // Quick catalog search for what they're looking for.
      const results = search(intent.query, 1);
      if (results.length > 0) {
        const p = results[0];
        const reply = t("toto.voice.find_yes").replace("{name}", `${p.brand} ${p.name}`);
        bubbleText(reply);
        speak(reply);
        window.setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set("screen", "map");
          window.location.href = url.toString();
        }, 1200);
      } else {
        const reply = t("toto.voice.find_no");
        bubbleText(reply);
        speak(reply);
      }
      return;
    }
    // Unknown — leave the transcript visible, say a sorry line.
    const sorry = t("toto.voice.sorry");
    speak(sorry);
    window.setTimeout(() => bubbleText(`${sorry} "${intent.transcript}"`), 100);
  }

  function pressStart() {
    pressedAt = performance.now();
    if (!voiceCapable) return;
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      startVoice();
    }, LONG_PRESS_MS);
  }
  function pressEnd() {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
    const held = performance.now() - pressedAt;
    if (voiceActive) {
      endVoice();
      // Slight delay so the result event has a chance to fire if it
      // arrives within ~150 ms of release.
      return;
    }
    if (held < LONG_PRESS_MS) {
      // Short tap: toggle bubble.
      setOpen(!open);
      if ("vibrate" in navigator) navigator.vibrate(8);
      breath.classList.add("toto-companion__breath--noticed");
      window.setTimeout(() => breath.classList.remove("toto-companion__breath--noticed"), 350);
    }
  }

  dog.addEventListener("pointerdown", pressStart);
  dog.addEventListener("pointerup",   pressEnd);
  dog.addEventListener("pointerleave", () => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  });

  // Allow tapping the bubble to dismiss.
  bubble.addEventListener("click", () => { if (!voiceActive) setOpen(false); });

  // Dedicated mic chip (shown only when voice is supported).
  const micBtn = root.querySelector("#toto-companion-mic") as HTMLButtonElement | null;
  if (micBtn) {
    // Reflect voice-mode visual state.
    if (isVoiceModeOn()) micBtn.classList.add("toto-companion__mic--vmode");
    let micPressTimer: number | null = null;
    micBtn.addEventListener("pointerdown", () => {
      micPressTimer = window.setTimeout(() => {
        micPressTimer = null;
        // Long-press toggles voice mode (mutes Toto).
        const nowOn = !isVoiceModeOn();
        setVoiceMode(nowOn);
        micBtn.classList.toggle("toto-companion__mic--vmode", nowOn);
        bubbleText(nowOn ? t("toto.voice.on") : t("toto.voice.off"));
        if (nowOn) speakBubble(t("toto.voice.on"));
        setOpen(true);
      }, 600);
    });
    micBtn.addEventListener("pointerup", () => {
      if (!micPressTimer) return;       // long-press already handled
      window.clearTimeout(micPressTimer);
      micPressTimer = null;
      // Short tap: enable voice mode (if not already) and start listening.
      if (!isVoiceModeOn()) {
        setVoiceMode(true);
        micBtn.classList.add("toto-companion__mic--vmode");
      }
      if (voiceActive) endVoice();
      else startVoice();
    });
    micBtn.addEventListener("pointerleave", () => {
      if (micPressTimer) { window.clearTimeout(micPressTimer); micPressTimer = null; }
    });
  }

  // Helper: speak the current bubble line with mouth/ears animation.
  // Toto's "breath" wrapper gets a CSS class while speechSynthesis is
  // playing, so the avatar visibly "talks."
  function speakBubble(text: string) {
    if (!isVoiceModeOn()) return;
    if (!text) return;
    speak(text, {
      onStart: () => breath.classList.add("toto-companion__breath--speaking"),
      onEnd:   () => breath.classList.remove("toto-companion__breath--speaking"),
    });
  }

  // First-visit auto-open + speak. We open once per session so the user
  // discovers Toto without being interrupted on every reload.
  const FIRST_VISIT_KEY = "toto.firstSeen";
  const firstSeen = sessionStorage.getItem(FIRST_VISIT_KEY);
  if (!firstSeen && !isSuggestion) {
    window.setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(FIRST_VISIT_KEY, "1");
      speakBubble(phrase);
      totoReact("perk");
    }, 600);
  } else if (open) {
    // Already-open render (e.g. suggestion arrived): speak it.
    speakBubble(phrase);
  }
}
