// Voice mode for Toto. Uses the browser's built-in Web Speech API for
// both directions — recognition (STT) and synthesis (TTS). Both are
// shipped natively in Chrome (Android + desktop), Edge, and Safari with
// the webkit prefix. No bundle cost, no model download.
//
// On Chrome the STT side dispatches to Google's speech service (cloud);
// on Safari it goes through Apple's. Privacy: the audio stream leaves
// the device, same as any voice assistant. Users opt in by long-pressing
// Toto to speak — never always-listening.
//
// FOSS provenance: Web Speech API itself is a W3C standard implementable
// by anyone. The implementations on the major browsers are platform
// services; nothing proprietary is added by us. For a fully-local STT
// pipeline (Whisper.cpp / Vosk) the bundle cost is ~50-100 MB which is
// way too heavy for a web app. We accept the cloud-recognition tradeoff.

import { getLang, type Language } from "./i18n";

// ─── Feature detection ─────────────────────────────────────────────────────

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror:  ((e: { error: string }) => void) | null;
  onend:    (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): { stt: boolean; tts: boolean } {
  return {
    stt: getSpeechRecognitionCtor() !== null,
    tts: typeof window.speechSynthesis !== "undefined",
  };
}

// ─── Language code mapping ──────────────────────────────────────────────────
// Web Speech wants BCP 47 codes like "en-US", "de-CH" (we use generic
// European variants by default so the recognizer is happy on most devices).

const STT_LANG: Record<Language, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
};

// ─── Recognition (STT) ─────────────────────────────────────────────────────

export type ListenHandle = {
  /** Stop listening immediately. Discards any in-flight result. */
  stop: () => void;
};

/** Start a push-to-talk recognition session. Resolves to the final
 *  transcript when the user stops talking, or via onResult sooner. */
export function startListening(
  onResult: (text: string) => void,
  onError?: (msg: string) => void,
): ListenHandle | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError?.("Voice not supported on this browser.");
    return null;
  }
  const rec = new Ctor();
  rec.lang = STT_LANG[getLang()];
  rec.interimResults = false;
  rec.continuous = false;

  let fired = false;
  rec.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript ?? "";
    if (text && !fired) {
      fired = true;
      onResult(text);
    }
  };
  rec.onerror = (e) => {
    if (fired) return;
    onError?.(e.error ?? "voice error");
  };
  rec.onend = () => { /* silent stop is fine */ };
  try {
    rec.start();
  } catch (err) {
    onError?.((err as Error)?.message ?? "voice start failed");
    return null;
  }
  return { stop: () => { try { rec.abort(); } catch { /* ignore */ } } };
}

// ─── Synthesis (TTS) ────────────────────────────────────────────────────────

/** Speak a short line in the user's selected language. Picks an available
 *  voice for the language; falls back to the default voice when none match. */
export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = STT_LANG[getLang()];
  u.rate = 1.0;
  u.pitch = 1.05;
  u.volume = 1;
  try {
    window.speechSynthesis.cancel(); // drop any prior utterance
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// ─── Tiny intent router ────────────────────────────────────────────────────
//
// Given a transcript, returns a `screen` to navigate to (and optionally
// a search query). Keyword-based, language-aware. Anything we don't
// understand returns null and the caller can fall back to "I didn't catch
// that" + show the transcript.

export type Intent =
  | { kind: "go"; screen: "home" | "list" | "plan" | "browse" | "map" | "scan" | "compare" | "repair" | "fit" | "settings" }
  | { kind: "find"; query: string }
  | { kind: "unknown"; transcript: string };

// Keyword sets per language. Lowercased compared, accent-insensitive.
type Keywords = Record<string, string[]>;
const KEYWORDS: Record<string, Keywords> = {
  en: {
    home:     ["home", "main", "start"],
    list:     ["list", "shopping list", "my list", "cart"],
    plan:     ["plan", "planning", "trip"],
    browse:   ["browse", "looking", "look around"],
    map:      ["map", "store map", "where"],
    scan:     ["scan", "find these"],
    compare:  ["compare"],
    repair:   ["repair", "fix"],
    fit:      ["fit", "size", "sizes"],
    settings: ["settings", "preferences"],
    find:     ["find", "where is", "show me", "looking for"],
  },
  de: {
    home:     ["start", "startseite", "anfang"],
    list:     ["liste", "einkaufsliste", "warenkorb"],
    plan:     ["plan", "planen", "tour", "trip"],
    browse:   ["umsehen", "schauen", "stöbern"],
    map:      ["karte", "lageplan", "wo"],
    scan:     ["scannen", "scanne", "finden"],
    compare:  ["vergleich", "vergleichen"],
    repair:   ["reparatur", "reparieren"],
    fit:      ["passform", "grösse", "groesse"],
    settings: ["einstellungen", "einstellung"],
    find:     ["finde", "wo ist", "zeig mir", "suche"],
  },
  fr: {
    home:     ["accueil", "début", "debut"],
    list:     ["liste", "panier"],
    plan:     ["plan", "planifier", "sortie"],
    browse:   ["regarder", "voir"],
    map:      ["carte", "plan du magasin", "où", "ou"],
    scan:     ["scanner", "scan", "trouver ces"],
    compare:  ["comparer", "comparaison"],
    repair:   ["réparer", "reparer", "réparation"],
    fit:      ["taille", "ajustement"],
    settings: ["paramètres", "parametres", "réglages"],
    find:     ["trouve", "où est", "ou est", "cherche"],
  },
  it: {
    home:     ["home", "inizio", "casa"],
    list:     ["lista", "carrello"],
    plan:     ["piano", "pianificare", "uscita"],
    browse:   ["guarda", "guardare"],
    map:      ["mappa", "dove"],
    scan:     ["scansiona", "scansionare", "trova"],
    compare:  ["confronta", "confronto"],
    repair:   ["riparare", "riparazione"],
    fit:      ["taglia", "misura"],
    settings: ["impostazioni"],
    find:     ["trova", "dov'è", "dove e", "cerca"],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function parseIntent(transcript: string): Intent {
  const lang = getLang();
  const kws = KEYWORDS[lang] ?? KEYWORDS.en;
  const text = normalize(transcript);

  // "find" intents come first because they're stronger signals.
  const findHits = kws.find?.find((kw: string) => text.includes(normalize(kw)));
  if (findHits) {
    const query = text.replace(normalize(findHits), "").trim();
    if (query.length >= 2) {
      return { kind: "find", query };
    }
  }

  // Navigation intents: pick the first screen whose keywords appear.
  const screenOrder: Extract<Intent, { kind: "go" }>["screen"][] = [
    "home", "list", "plan", "browse", "map", "scan", "compare", "repair", "fit", "settings",
  ];
  for (const screen of screenOrder) {
    const list = (kws as Record<string, string[] | undefined>)[screen];
    if (!list) continue;
    if (list.some((kw) => text.includes(normalize(kw)))) {
      return { kind: "go", screen };
    }
  }

  return { kind: "unknown", transcript };
}
