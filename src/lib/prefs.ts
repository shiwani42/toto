// User preferences (accessibility + fit). Stored in localStorage so they
// persist across sessions on the same device.

const KEY = "toto.prefs";

export type Gender = "man" | "woman" | "other";
export type Experience = "new" | "comfortable" | "enthusiast" | "pro";

export type Prefs = {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean; // forces motion reduction even if OS says otherwise
  ttsAnnouncements: boolean;
  topSize: "XS" | "S" | "M" | "L" | "XL" | null;
  bottomSize: "XS" | "S" | "M" | "L" | "XL" | null;
  shoeSizeEU: number | null;
  sizeSource: "manual" | "fit-check" | null;
  // Identity bits that bias picks. Asked once via the planner wizard.
  gender: Gender | null;
  experience: Experience | null;
  // Set to true after the first planner wizard, whether or not the user
  // answered the profile questions. Prevents re-asking on every visit.
  profileOffered: boolean;
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
  experience: null,
  profileOffered: false,
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

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  applyPrefs(next);
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
