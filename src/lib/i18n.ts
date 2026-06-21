// Lightweight i18n. The catalog of strings is hard-coded into one
// dictionary keyed by translation key. The active language is read from
// prefs (so it round-trips through Supabase profile sync) and falls back
// to English. No runtime dep, no detection magic — just a `t(key)` call.
//
// To translate a new string:
//   1. Add an entry to TRANSLATIONS with the same key in each language.
//   2. Replace the literal string in the screen with `t("the.key")`.
//
// Languages are intentionally limited to the four Switzerland needs:
// English (default for the app), German, French, Italian. Romansh is
// possible but very niche; if a Swiss outdoor chain asks, add it as
// "rm" the same way.

import { getPrefs, subscribePrefs } from "./prefs";

export type Language = "en" | "de" | "fr" | "it";

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "de", label: "German",  native: "Deutsch" },
  { code: "fr", label: "French",  native: "Français" },
  { code: "it", label: "Italian", native: "Italiano" },
];

type Catalog = Record<Language, Record<string, string>>;

// Keep the keys flat and human-readable. Order them by screen so finding
// strings to translate is easy when expanding coverage.
const TRANSLATIONS: Catalog = {
  en: {
    // home
    "home.hi":                 "Hi, I'm Toto",
    "home.sub":                "What brings you in today?",
    "home.choice.list":        "I have a list",
    "home.choice.list.sub":    "Search by name, size, or brand.",
    "home.choice.resume":      "Pick up where you left off",
    "home.choice.plan":        "Help me plan it",
    "home.choice.plan.sub":    "Tell me where, I'll suggest gear.",
    "home.choice.browse":      "I'm just looking",
    "home.choice.browse.sub":  "Point the camera, I'll explain.",
    "home.more":               "More tools",
    "home.more.compare":       "Compare two",
    "home.more.repair":        "Repair check",
    "home.more.fit":           "Fit check",
    "home.more.connect":       "Shop together",
    "home.more.settings":      "Settings",
    "home.banner.with":        "Shopping with",
    "home.banner.open":        "Open",
    "home.badge.in_progress":  "in progress",
    // tab bar
    "tab.home":                "Home",
    "tab.list":                "List",
    "tab.scan":                "Scan",
    "tab.together":            "Together",
    "tab.you":                 "You",
    // settings
    "settings.title":          "Your preferences",
    "settings.you":            "You",
    "settings.you.help":       "Helps me pick the right cut, size, and difficulty.",
    "settings.iam":            "I am",
    "settings.age":            "Age",
    "settings.experience":     "How outdoorsy",
    "settings.shoppingFor":    "Shopping for",
    "settings.familyCount":    "How many people",
    "settings.notset":         "Not set",
    "settings.prefernot":      "Prefer not to say",
    "settings.access":         "Accessibility",
    "settings.access.contrast":     "High contrast",
    "settings.access.contrast.sub": "Sharper borders, stronger text",
    "settings.access.large":        "Larger text",
    "settings.access.large.sub":    "About 25% bigger everywhere",
    "settings.access.motion":       "Reduce motion",
    "settings.access.motion.sub":   "Quiet down pulses and flashes",
    "settings.access.tts":          "Speak scan results",
    "settings.access.tts.sub":      "I'll read each find out loud",
    "settings.access.hearme":       "Hear me",
    "settings.sizes":          "Your sizes",
    "settings.sizes.snap":     "Or just snap a photo.",
    "settings.sizes.top":      "Top size",
    "settings.sizes.bottom":   "Bottom size",
    "settings.sizes.shoe":     "Shoe size (EU)",
    "settings.lang":           "Language",
    "settings.lang.help":      "Changes the buttons and labels you see.",
    "settings.back":           "‹ Back",
  },
  de: {
    "home.hi":                 "Hallo, ich bin Toto",
    "home.sub":                "Was führt dich heute hierher?",
    "home.choice.list":        "Ich habe eine Liste",
    "home.choice.list.sub":    "Suche nach Name, Grösse oder Marke.",
    "home.choice.resume":      "Mache da weiter, wo du warst",
    "home.choice.plan":        "Hilf mir beim Planen",
    "home.choice.plan.sub":    "Sag mir wohin, ich schlage Ausrüstung vor.",
    "home.choice.browse":      "Ich schaue mich nur um",
    "home.choice.browse.sub":  "Kamera draufhalten, ich erkläre.",
    "home.more":               "Weitere Werkzeuge",
    "home.more.compare":       "Zwei vergleichen",
    "home.more.repair":        "Reparatur-Check",
    "home.more.fit":           "Passform-Check",
    "home.more.connect":       "Gemeinsam einkaufen",
    "home.more.settings":      "Einstellungen",
    "home.banner.with":        "Einkaufen mit",
    "home.banner.open":        "Öffnen",
    "home.badge.in_progress":  "in Arbeit",
    "tab.home":                "Start",
    "tab.list":                "Liste",
    "tab.scan":                "Scannen",
    "tab.together":            "Zusammen",
    "tab.you":                 "Du",
    "settings.title":          "Deine Einstellungen",
    "settings.you":            "Du",
    "settings.you.help":       "Hilft mir, den richtigen Schnitt, die Grösse und den Schwierigkeitsgrad zu wählen.",
    "settings.iam":            "Ich bin",
    "settings.age":            "Alter",
    "settings.experience":     "Wie naturverbunden",
    "settings.shoppingFor":    "Einkauf für",
    "settings.familyCount":    "Wie viele Personen",
    "settings.notset":         "Nicht gesetzt",
    "settings.prefernot":      "Keine Angabe",
    "settings.access":         "Barrierefreiheit",
    "settings.access.contrast":     "Hoher Kontrast",
    "settings.access.contrast.sub": "Schärfere Ränder, stärkerer Text",
    "settings.access.large":        "Grösserer Text",
    "settings.access.large.sub":    "Etwa 25% grösser überall",
    "settings.access.motion":       "Animationen reduzieren",
    "settings.access.motion.sub":   "Weniger Pulse und Blitze",
    "settings.access.tts":          "Scan-Ergebnisse vorlesen",
    "settings.access.tts.sub":      "Ich lese jeden Fund laut vor",
    "settings.access.hearme":       "Hör mich an",
    "settings.sizes":          "Deine Grössen",
    "settings.sizes.snap":     "Oder einfach ein Foto machen.",
    "settings.sizes.top":      "Oberteil-Grösse",
    "settings.sizes.bottom":   "Hosen-Grösse",
    "settings.sizes.shoe":     "Schuhgrösse (EU)",
    "settings.lang":           "Sprache",
    "settings.lang.help":      "Ändert die Knöpfe und Texte, die du siehst.",
    "settings.back":           "‹ Zurück",
  },
  fr: {
    "home.hi":                 "Salut, je suis Toto",
    "home.sub":                "Qu'est-ce qui t'amène aujourd'hui ?",
    "home.choice.list":        "J'ai une liste",
    "home.choice.list.sub":    "Cherche par nom, taille ou marque.",
    "home.choice.resume":      "Reprends où tu en étais",
    "home.choice.plan":        "Aide-moi à planifier",
    "home.choice.plan.sub":    "Dis-moi où, je suggère le matériel.",
    "home.choice.browse":      "Je regarde juste",
    "home.choice.browse.sub":  "Pointe la caméra, j'explique.",
    "home.more":               "Plus d'outils",
    "home.more.compare":       "Comparer deux",
    "home.more.repair":        "Vérif. réparation",
    "home.more.fit":           "Vérif. taille",
    "home.more.connect":       "Acheter à plusieurs",
    "home.more.settings":      "Paramètres",
    "home.banner.with":        "En achat avec",
    "home.banner.open":        "Ouvrir",
    "home.badge.in_progress":  "en cours",
    "tab.home":                "Accueil",
    "tab.list":                "Liste",
    "tab.scan":                "Scan",
    "tab.together":            "Ensemble",
    "tab.you":                 "Toi",
    "settings.title":          "Tes préférences",
    "settings.you":            "Toi",
    "settings.you.help":       "M'aide à choisir la bonne coupe, taille et difficulté.",
    "settings.iam":            "Je suis",
    "settings.age":            "Âge",
    "settings.experience":     "Niveau outdoor",
    "settings.shoppingFor":    "Achats pour",
    "settings.familyCount":    "Combien de personnes",
    "settings.notset":         "Non défini",
    "settings.prefernot":      "Préfère ne pas dire",
    "settings.access":         "Accessibilité",
    "settings.access.contrast":     "Contraste élevé",
    "settings.access.contrast.sub": "Bordures plus nettes, texte plus marqué",
    "settings.access.large":        "Texte plus grand",
    "settings.access.large.sub":    "Environ 25% plus grand partout",
    "settings.access.motion":       "Réduire les animations",
    "settings.access.motion.sub":   "Moins de pulsations et flashs",
    "settings.access.tts":          "Lire les résultats du scan",
    "settings.access.tts.sub":      "Je lis chaque trouvaille à voix haute",
    "settings.access.hearme":       "Écoute-moi",
    "settings.sizes":          "Tes tailles",
    "settings.sizes.snap":     "Ou prends juste une photo.",
    "settings.sizes.top":      "Taille haut",
    "settings.sizes.bottom":   "Taille bas",
    "settings.sizes.shoe":     "Pointure (EU)",
    "settings.lang":           "Langue",
    "settings.lang.help":      "Change les boutons et les libellés que tu vois.",
    "settings.back":           "‹ Retour",
  },
  it: {
    "home.hi":                 "Ciao, sono Toto",
    "home.sub":                "Cosa ti porta qui oggi?",
    "home.choice.list":        "Ho una lista",
    "home.choice.list.sub":    "Cerca per nome, taglia o marca.",
    "home.choice.resume":      "Riprendi da dove eri rimasto",
    "home.choice.plan":        "Aiutami a pianificare",
    "home.choice.plan.sub":    "Dimmi dove, suggerisco l'attrezzatura.",
    "home.choice.browse":      "Sto solo guardando",
    "home.choice.browse.sub":  "Punta la fotocamera, ti spiego.",
    "home.more":               "Altri strumenti",
    "home.more.compare":       "Confronta due",
    "home.more.repair":        "Controllo riparazione",
    "home.more.fit":           "Controllo taglia",
    "home.more.connect":       "Acquista insieme",
    "home.more.settings":      "Impostazioni",
    "home.banner.with":        "In acquisto con",
    "home.banner.open":        "Apri",
    "home.badge.in_progress":  "in corso",
    "tab.home":                "Home",
    "tab.list":                "Lista",
    "tab.scan":                "Scansiona",
    "tab.together":            "Insieme",
    "tab.you":                 "Tu",
    "settings.title":          "Le tue preferenze",
    "settings.you":            "Tu",
    "settings.you.help":       "Mi aiuta a scegliere il taglio, la taglia e la difficoltà giusti.",
    "settings.iam":            "Sono",
    "settings.age":            "Età",
    "settings.experience":     "Quanto outdoor",
    "settings.shoppingFor":    "Acquisti per",
    "settings.familyCount":    "Quante persone",
    "settings.notset":         "Non impostato",
    "settings.prefernot":      "Preferisco non dirlo",
    "settings.access":         "Accessibilità",
    "settings.access.contrast":     "Contrasto elevato",
    "settings.access.contrast.sub": "Bordi più netti, testo più marcato",
    "settings.access.large":        "Testo più grande",
    "settings.access.large.sub":    "Circa 25% più grande ovunque",
    "settings.access.motion":       "Riduci animazioni",
    "settings.access.motion.sub":   "Meno pulsazioni e lampi",
    "settings.access.tts":          "Leggi i risultati della scansione",
    "settings.access.tts.sub":      "Leggo ogni trovata ad alta voce",
    "settings.access.hearme":       "Ascoltami",
    "settings.sizes":          "Le tue taglie",
    "settings.sizes.snap":     "O scatta una foto.",
    "settings.sizes.top":      "Taglia top",
    "settings.sizes.bottom":   "Taglia pantaloni",
    "settings.sizes.shoe":     "Numero scarpe (EU)",
    "settings.lang":           "Lingua",
    "settings.lang.help":      "Cambia i pulsanti e le etichette che vedi.",
    "settings.back":           "‹ Indietro",
  },
};

function detectFromBrowser(): Language {
  const langs = (navigator.languages ?? [navigator.language ?? "en"]).map((s) => s.toLowerCase());
  for (const l of langs) {
    if (l.startsWith("de")) return "de";
    if (l.startsWith("fr")) return "fr";
    if (l.startsWith("it")) return "it";
  }
  return "en";
}

let cached: Language | null = null;

export function getLang(): Language {
  if (cached) return cached;
  const fromPrefs = getPrefs().language;
  cached = fromPrefs ?? detectFromBrowser();
  return cached;
}

export function setLang(lang: Language) {
  cached = lang;
}

/** Translate a key. Falls back to English, then to the key itself. */
export function t(key: string): string {
  const lang = getLang();
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

// Keep cache in sync with prefs changes (e.g. profile sync from another device).
subscribePrefs((p) => { cached = p.language ?? cached; });
