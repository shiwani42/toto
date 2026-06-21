// User preferences (accessibility + fit). Stored in localStorage so they
// persist across sessions on the same device.

const KEY = "toto.prefs";

export type Gender = "man" | "woman" | "other";
export type Experience = "new" | "comfortable" | "enthusiast" | "pro";
export type AgeBucket = "u20" | "20-30" | "30-45" | "45-60" | "60+";
export type ShoppingFor = "self" | "someone" | "family";

export type Prefs = {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  ttsAnnouncements: boolean;
  topSize: "XS" | "S" | "M" | "L" | "XL" | null;
  bottomSize: "XS" | "S" | "M" | "L" | "XL" | null;
  shoeSizeEU: number | null;
  sizeSource: "manual" | "fit-check" | null;
  // Identity / context that biases picks. Asked when missing.
  gender: Gender | null;
  age: AgeBucket | null;
  experience: Experience | null;
  shoppingFor: ShoppingFor | null;
  familyCount: number | null;
};

const DEFAULTS: Prefs = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  ttsAnnouncements: false,
  topSize: null,
  bottomSize: null,
  shoeSizeEU: null,
  sizeSource: null,
  gender: null,
  age: null,
  experience: null,
  shoppingFor: null,
  familyCount: null,
};

export function getPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

// Listeners that want to react to local pref changes. The profile sync
// layer registers here without prefs.ts having to import it (would create
// a cycle: prefs ← profile ← auth ← supabase).
type PrefsListener = (prefs: Prefs) => void;
const listeners: PrefsListener[] = [];

export function subscribePrefs(fn: PrefsListener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  applyPrefs(next);
  for (const fn of listeners) {
    try { fn(next); } catch (err) { console.warn("prefs listener failed:", err); }
  }
  return next;
}

export function applyPrefs(prefs: Prefs = getPrefs()) {
  const root = document.documentElement;
  root.dataset.highContrast = String(prefs.highContrast);
  root.dataset.largeText = String(prefs.largeText);
  root.dataset.reduceMotion = String(prefs.reduceMotion);
}

// Text-to-speech for scan / event announcements. Used by aria-live regions
// and by the scan flow when prefs.ttsAnnouncements is true.
let lastSpoken = "";
export function announce(text: string, force = false) {
  if (!("speechSynthesis" in window)) return;
  const prefs = getPrefs();
  if (!prefs.ttsAnnouncements && !force) return;
  if (text === lastSpoken) return;
  lastSpoken = text;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
