import { getProduct } from "../lib/catalog";
import { addToList, removeFromList, getList } from "../lib/list";
import { planTrip, type PlanResult, type PlanPick } from "../integrations/ai-planner";
import {
  searchLocations,
  forecast,
  type ForecastSummary,
  type Geocode,
} from "../integrations/weather";
import { getPrefs, setPrefs } from "../lib/prefs";
import { illustrationForCategory } from "../lib/product-art";
import { track } from "../lib/analytics";
import { pushSuggestion } from "../lib/companion";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── Static option lists ─────────────────────────────────────────────────────

type Purpose = "trip" | "general" | "browse";

type ActivityKey = "day-hike" | "multi-day" | "camping" | "climbing" | "trail-run" | "skiing" | "other";
type Activity = { key: ActivityKey; label: string };

type Answers = {
  purpose: Purpose;
  activity: Activity | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Multi-select of common trip considerations. See SPECIFICS_OPTIONS. */
  specifics: string[];
};

// ─── Visual option sets ──────────────────────────────────────────────────────
//
// Each step uses cards with a single emoji as illustration. Emoji works
// across all locales without bundling custom SVG art per option.

type Gender = "man" | "woman" | "other";
type ShoppingFor = "self" | "someone" | "family";
type Experience = "new" | "comfortable" | "enthusiast" | "pro";

type ActivityVisual = { key: ActivityKey; emoji: string; label: string };
// Each activity gets a distinct scene-defining glyph: Multi-day used to
// also be a tent (clashing with Camping's tent), and Something-else's
// sparkles read as generic. Mountains and a backpack make the row read
// as outdoor-coherent without two cards looking identical.
const ACTIVITY_VISUALS: ActivityVisual[] = [
  { key: "day-hike",  emoji: "🥾",  label: "Day hike" },
  { key: "multi-day", emoji: "🏔️", label: "Multi-day trek" },
  { key: "camping",   emoji: "⛺",  label: "Camping" },
  { key: "climbing",  emoji: "🧗",  label: "Climbing" },
  { key: "trail-run", emoji: "🏃",  label: "Trail run" },
  { key: "skiing",    emoji: "⛷️", label: "Ski / snow" },
  { key: "other",     emoji: "🎒",  label: "Something else" },
];

const SHOPPING_VISUALS: { key: ShoppingFor; emoji: string; label: string; sub: string }[] = [
  // Single-codepoint emojis only — the ZWJ family sequence rendered as
  // separate glyphs on some Android/older WebKit versions, breaking the
  // grid rhythm.
  { key: "self",    emoji: "🙂",  label: "Myself",   sub: "Just my gear" },
  { key: "someone", emoji: "🎁",  label: "Someone else", sub: "Gift or partner" },
  { key: "family",  emoji: "🏡",  label: "My family", sub: "Two or more" },
];

const GENDER_VISUALS: { key: Gender; emoji: string; label: string; sub: string }[] = [
  { key: "man",   emoji: "👔",  label: "Men's cut",   sub: "" },
  { key: "woman", emoji: "👚",  label: "Women's cut", sub: "" },
  { key: "other", emoji: "🌿",  label: "Unisex",      sub: "Either" },
];

const EXPERIENCE_VISUALS: { key: Experience; emoji: string; label: string; sub: string }[] = [
  { key: "new",         emoji: "🌱", label: "New",          sub: "First time" },
  { key: "comfortable", emoji: "🌳", label: "Comfortable",  sub: "Done a few" },
  { key: "enthusiast",  emoji: "🏔️", label: "Enthusiast",  sub: "Out most weekends" },
  { key: "pro",         emoji: "🎯", label: "Pro",          sub: "All the time" },
];

const SPECIFICS_OPTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "first-time",   emoji: "🆕", label: "First time" },
  { key: "with-kids",    emoji: "👶", label: "With kids" },
  { key: "tight-budget", emoji: "💸", label: "Tight budget" },
  { key: "run-hot",      emoji: "🔥", label: "I run hot" },
  { key: "going-cold",   emoji: "❄️", label: "Cold weather" },
  { key: "long-days",    emoji: "☀️", label: "Long days out" },
  { key: "weight-matter",emoji: "🪶", label: "Light is key" },
  { key: "rain-likely",  emoji: "🌧", label: "Wet weather" },
];

const SIZE_CHIPS = ["XS", "S", "M", "L", "XL"] as const;
const SHOE_CHIPS = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45];

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function friendlyDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function weatherComment(s: ForecastSummary["summary"]): string {
  if (s.has_snow) return "Snow's likely. Pack warm and waterproof.";
  if (s.has_rain) return "Rain on the way. Bring a shell.";
  if (s.max_c >= 28) return "Going to be hot. Light and breathable.";
  if (s.max_c <= 5) return "Properly cold. Layers all the way.";
  if (s.min_c <= 0) return "Below freezing overnight. Pack insulation.";
  if (s.max_c >= 22) return "Warm and pleasant. Easy layering.";
  return "Mild. Standard layers should do.";
}

function weatherCard(w: ForecastSummary): string {
  const s = w.summary;
  const conditions = s.has_snow ? "❄️ snow" : s.has_rain ? "🌧 rain" : "☀️ dry";
  return `
    <div class="weather-card">
      <div class="weather-card__top">
        <div>
          <div class="weather-card__loc">${escapeHTML(w.location.name)}${w.location.country ? `, ${escapeHTML(w.location.country)}` : ""}</div>
          <div class="weather-card__when">${escapeHTML(w.daily[0].date)} → ${escapeHTML(w.daily[w.daily.length - 1].date)}${w.location.elevation_m ? ` · ${Math.round(w.location.elevation_m)} m` : ""}</div>
        </div>
        <div class="weather-card__temp">${s.min_c}° / ${s.max_c}°C</div>
      </div>
      <div class="weather-card__stats">
        <span>${conditions}</span>
        <span>💧 ${s.total_precip_mm} mm</span>
        ${s.total_snow_cm > 0 ? `<span>🌨 ${s.total_snow_cm} cm</span>` : ""}
        <span>💨 ${s.max_wind_kmh} km/h</span>
      </div>
    </div>
  `;
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T12:00:00").getTime();
  const b = new Date(end + "T12:00:00").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function durationLabelFor(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "a few days";
  if (!endDate || endDate === startDate) return "day trip";
  const d = daysBetween(startDate, endDate);
  if (d === 2) return "overnight";
  if (d <= 4) return `${d} days`;
  return `${d} days`;
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

export function renderPlan(root: HTMLElement) {
  // Single-screen plan form. Everything below is optional; the user
  // submits whatever they filled in. Personal details (gender, age,
  // experience, sizes) live in Settings and get used by the planner
  // when they're set. We don't gate the plan on them.
  const answers: Answers = {
    purpose: "trip",
    activity: null,
    location: null,
    startDate: null,
    endDate: null,
    specifics: [],
  };

  // The full question set, smart-skipped per prefs.
  type Step = "activity" | "shoppingFor" | "whoFor" | "experience" | "location" | "when" | "sizes" | "specifics";

  function computeSteps(): Step[] {
    const prefs = getPrefs();
    const steps: Step[] = ["activity"];
    if (!prefs.shoppingFor)                                 steps.push("shoppingFor");
    if (!prefs.gender && prefs.shoppingFor !== "family")    steps.push("whoFor");
    if (!prefs.experience)                                  steps.push("experience");
    steps.push("location", "when");
    if (!prefs.topSize || !prefs.bottomSize || !prefs.shoeSizeEU) steps.push("sizes");
    steps.push("specifics");
    return steps;
  }

  let STEPS: Step[] = computeSteps();
  let stepIdx = 0;

  track("wizard_start", { initial_steps: STEPS.length });

  function advance() {
    // Re-derive in case a setPrefs from this step affected later visibility.
    const newSteps = computeSteps();
    // Keep our position relative to where we just answered.
    const currentKey = STEPS[stepIdx];
    STEPS = newSteps;
    const newIdx = STEPS.indexOf(currentKey);
    stepIdx = (newIdx === -1 ? stepIdx : newIdx) + 1;
    if (stepIdx >= STEPS.length) {
      const prefs = getPrefs();
      track("wizard_complete", {
        purpose: answers.purpose,
        activity: answers.activity?.key ?? null,
        gender: prefs.gender,
        age: prefs.age,
        experience: prefs.experience,
        shopping_for: prefs.shoppingFor,
        family_count: prefs.familyCount,
        has_dates: Boolean(answers.startDate),
        has_extra: answers.specifics.length > 0,
      });
      runPlanner();
      return;
    }
    render();
  }
  function back() {
    if (stepIdx === 0) { window.location.href = "?screen=home"; return; }
    stepIdx--;
    render();
  }

  function bigCards(items: { key: string; emoji: string; label: string; sub?: string; on?: boolean }[], attrKey: string): string {
    return `
      <div class="wizard-grid" id="${attrKey}-grid">
        ${items.map((o) => `
          <button class="wizard-card ${o.on ? "wizard-card--on" : ""}" type="button"
                  data-${attrKey}="${escapeHTML(o.key)}">
            <span class="wizard-card__emoji" aria-hidden="true">${o.emoji}</span>
            <span class="wizard-card__title">${escapeHTML(o.label)}</span>
            ${o.sub ? `<span class="wizard-card__sub">${escapeHTML(o.sub)}</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  }

  function sizeChips(label: string, prefix: string, options: ReadonlyArray<string | number>, selected: string | number | null | undefined): string {
    return `
      <div class="wizard-sizes__block">
        <p class="wizard-sizes__label">${label}</p>
        <div class="wizard-sizes__row">
          ${options.map((s) => `
            <button class="wizard-sizes__chip ${selected === s ? "wizard-sizes__chip--on" : ""}"
                    type="button" data-size="${prefix}:${s}">${s}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function render() {
    const today = todayIso();
    const step = STEPS[stepIdx];
    const prefs = getPrefs();
    let stepBody = "";
    // What kind of trip
    if (step === "activity") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.activity")}</h1>
        ${bigCards(
          ACTIVITY_VISUALS.map((o) => ({ ...o, on: answers.activity?.key === o.key })),
          "activity",
        )}
      `;
    }
    if (step === "shoppingFor") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.shoppingFor")}</h1>
        ${bigCards(SHOPPING_VISUALS.map((o) => ({ ...o, on: prefs.shoppingFor === o.key })), "shopping")}
      `;
    }
    if (step === "whoFor") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.whoFor")}</h1>
        ${bigCards(GENDER_VISUALS.map((o) => ({ ...o, on: prefs.gender === o.key })), "gender")}
      `;
    }
    if (step === "experience") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.experience")}</h1>
        ${bigCards(EXPERIENCE_VISUALS.map((o) => ({ ...o, on: prefs.experience === o.key })), "experience")}
      `;
    }
    if (step === "location") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.location")}</h1>
        <div class="loc-search">
          <input id="loc-input" type="search" autocomplete="off" placeholder="Any place, anywhere…" />
          <ul id="loc-results" class="loc-results"></ul>
        </div>
        <p class="plan-one__chosen" id="loc-chosen">${answers.location ? `✓ ${escapeHTML(answers.location)}` : ""}</p>
      `;
    }
    if (step === "when") {
      // Default the start date to today so the field never looks empty.
      const startValue = answers.startDate ?? today;
      if (!answers.startDate) answers.startDate = today;
      // Show the End date only when the chosen activity implies multiple
      // days (multi-day trek, camping). Day hikes, trail runs, ski day
      // outs, etc. don't need it — and a lone End (optional) field added
      // noise to the most common case. When shown, End is required, no
      // "(optional)" tag.
      const multiDay = answers.activity?.key === "multi-day" || answers.activity?.key === "camping";
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.when")}</h1>
        <div class="wizard__date-grid${multiDay ? "" : " wizard__date-grid--single"}">
          <label class="wizard__date-label">
            <span>${escapeHTML(multiDay ? t("plan.when.start") : t("plan.when.day"))}</span>
            <input id="start-date" type="date" min="${today}" value="${startValue}" />
          </label>
          ${multiDay ? `
            <label class="wizard__date-label">
              <span>${escapeHTML(t("plan.when.end"))}</span>
              <input id="end-date" type="date" min="${today}" value="${answers.endDate ?? ""}" />
            </label>
          ` : ""}
        </div>
        <p class="wizard__peek" id="peek"></p>
      `;
    }
    if (step === "sizes") {
      stepBody = `
        <h1 class="wizard__q">${t("plan.q.sizes")}</h1>
        <div class="wizard-sizes">
          ${!prefs.topSize     ? sizeChips("Top",    "top",  SIZE_CHIPS, prefs.topSize) : ""}
          ${!prefs.bottomSize  ? sizeChips("Bottom", "bot",  SIZE_CHIPS, prefs.bottomSize) : ""}
          ${!prefs.shoeSizeEU  ? sizeChips("Shoe (EU)", "shoe", SHOE_CHIPS, prefs.shoeSizeEU) : ""}
        </div>
      `;
    }
    if (step === "specifics") {
      stepBody = `
        <h1 class="wizard__q">Anything special?</h1>
        <div class="wizard-multi" id="specifics-grid">
          ${SPECIFICS_OPTIONS.map((o) => `
            <button class="wizard-multi__chip ${answers.specifics.includes(o.key) ? "wizard-multi__chip--on" : ""}"
                    type="button" data-spec="${o.key}">
              <span class="wizard-multi__emoji" aria-hidden="true">${o.emoji}</span>
              ${escapeHTML(o.label)}
            </button>
          `).join("")}
        </div>
      `;
    }

    const isLast = stepIdx === STEPS.length - 1;
    // Cards (activity/shopping/whoFor/experience) auto-advance on tap.
    // Location commits on Enter or via the result list. Sizes
    // auto-advances when all blocks are picked. When + Specifics keep
    // an explicit Continue: When has native date inputs with no
    // tappable commit on mobile, Specifics is a multi-select that
    // needs an "I'm done picking" gesture.
    const showNext = step === "specifics" || step === "when";
    const nextLabel = isLast ? t("plan.continue") : "Continue";

    root.innerHTML = `
      <main class="screen-plan plan-one">
        <header class="plan-one__head" aria-label="Step ${stepIdx + 1} of ${STEPS.length}">
          <button class="wizard__back" id="back" aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div class="plan-one__progress">
            ${STEPS.map((_, i) => `<span class="plan-one__dot ${i <= stepIdx ? "plan-one__dot--on" : ""}"></span>`).join("")}
          </div>
        </header>
        <section class="plan-one__step">
          ${stepBody}
        </section>
        <div class="plan-one__actions">
          <button class="wizard__skip" id="skip" type="button">${t("plan.skip")}</button>
          ${showNext ? `<button class="primary plan-one__go" id="next" type="button">${nextLabel}</button>` : ""}
        </div>
        ${stepIdx === 0 ? `<a class="link-btn plan-one__alt" href="?screen=browse">Or just browse the store</a>` : ""}
      </main>
    `;

    // Step-specific wiring.
    if (step === "activity")     wireActivityCards();
    if (step === "shoppingFor")  wireShoppingCards();
    if (step === "whoFor")       wireGenderCards();
    if (step === "experience")   wireExperienceCards();
    if (step === "location")     mountLocation();
    if (step === "when")         wireDates();
    if (step === "sizes")        wireSizes();
    if (step === "specifics")    wireSpecifics();

    (root.querySelector("#back") as HTMLButtonElement).addEventListener("click", back);
    // The Skip button doubles as the "commit and move on" affordance —
    // if the user filled in an input on this step and taps Skip, use
    // what they typed rather than throwing it away.
    (root.querySelector("#skip") as HTMLButtonElement).addEventListener("click", () => {
      if (step === "location") {
        const typed = (root.querySelector("#loc-input") as HTMLInputElement | null)?.value.trim();
        if (typed) answers.location = typed;
      }
      if (step === "when") {
        const s = (root.querySelector("#start-date") as HTMLInputElement | null)?.value || null;
        const e = (root.querySelector("#end-date")   as HTMLInputElement | null)?.value || null;
        answers.startDate = s;
        answers.endDate = e && (!s || e >= s) ? e : null;
      }
      advance();
    });
    const nextBtn = root.querySelector("#next") as HTMLButtonElement | null;
    nextBtn?.addEventListener("click", () => {
      if (step === "when") {
        const s = (root.querySelector("#start-date") as HTMLInputElement | null)?.value || null;
        const e = (root.querySelector("#end-date")   as HTMLInputElement | null)?.value || null;
        const multiDay = answers.activity?.key === "multi-day" || answers.activity?.key === "camping";
        answers.startDate = s;
        answers.endDate = e && (!s || e >= s) ? e : null;
        // When the activity implies multiple days, End is required.
        // Don't advance until the user picks it; nudge focus to the
        // end field and shake it briefly so the ask is unmistakable.
        if (multiDay && !answers.endDate) {
          const endEl = root.querySelector("#end-date") as HTMLInputElement | null;
          if (endEl) {
            endEl.focus();
            endEl.classList.add("wizard__date-input--shake");
            window.setTimeout(() => endEl.classList.remove("wizard__date-input--shake"), 600);
          }
          return;
        }
      }
      advance();
    });
  }

  function wireActivityCards() {
    const host = root.querySelector("#activity-grid") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-activity]");
      if (!btn) return;
      const key = btn.dataset.activity!;
      const found = ACTIVITY_VISUALS.find((o) => o.key === key);
      if (!found) return;
      answers.activity = { key: found.key, label: found.label };
      advance();
    });
  }
  function wireShoppingCards() {
    const host = root.querySelector("#shopping-grid") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-shopping]");
      if (!btn) return;
      setPrefs({ shoppingFor: btn.dataset.shopping as ShoppingFor });
      advance();
    });
  }
  function wireGenderCards() {
    const host = root.querySelector("#gender-grid") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-gender]");
      if (!btn) return;
      setPrefs({ gender: btn.dataset.gender as Gender });
      advance();
    });
  }
  function wireExperienceCards() {
    const host = root.querySelector("#experience-grid") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-experience]");
      if (!btn) return;
      setPrefs({ experience: btn.dataset.experience as Experience });
      advance();
    });
  }
  function wireSizes() {
    const host = root.querySelector(".wizard-sizes") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-size]");
      if (!btn) return;
      const [prefix, raw] = btn.dataset.size!.split(":");
      if (prefix === "top")  setPrefs({ topSize: raw as "XS" | "S" | "M" | "L" | "XL", sizeSource: "manual" });
      if (prefix === "bot")  setPrefs({ bottomSize: raw as "XS" | "S" | "M" | "L" | "XL", sizeSource: "manual" });
      if (prefix === "shoe") setPrefs({ shoeSizeEU: Number(raw), sizeSource: "manual" });
      // Auto-advance when every shown block has a selection. The
      // wizard skips blocks the user already set in Settings, so this
      // checks only what's actually on screen.
      const blocks = host.querySelectorAll<HTMLDivElement>(".wizard-sizes__block").length;
      const filled = host.querySelectorAll<HTMLDivElement>(".wizard-sizes__block:has(.wizard-sizes__chip--on)").length;
      if (blocks > 0 && filled === blocks) {
        window.setTimeout(advance, 220);
      } else {
        render();
      }
    });
  }
  function wireSpecifics() {
    const host = root.querySelector("#specifics-grid") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-spec]");
      if (!btn) return;
      const key = btn.dataset.spec!;
      const i = answers.specifics.indexOf(key);
      if (i === -1) answers.specifics.push(key);
      else answers.specifics.splice(i, 1);
      btn.classList.toggle("wizard-multi__chip--on");
    });
  }

  function wireDates() {
    const startEl = root.querySelector("#start-date") as HTMLInputElement;
    // End date only exists for multi-day activities — we can't assume
    // it's there. Guarding nullable saves the click handlers from
    // crashing on day trips.
    const endEl = root.querySelector("#end-date") as HTMLInputElement | null;
    function readDates() {
      const s = startEl.value;
      const e = endEl?.value ?? "";
      answers.startDate = s || null;
      answers.endDate = e && (!s || e >= s) ? e : null;
      if (answers.startDate) runPeek(answers.startDate);
    }
    startEl.addEventListener("change", readDates);
    endEl?.addEventListener("change", readDates);
    if (startEl.value) runPeek(startEl.value);

    // Enter on either field commits the dates and advances. Native
    // date inputs don't fire Enter on iOS, but on Android/desktop
    // this gives the user a keyboard-only path through the step.
    function maybeAdvance(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      readDates();
      advance();
    }
    startEl.addEventListener("keydown", maybeAdvance);
    endEl?.addEventListener("keydown", maybeAdvance);
  }

  // ─── Location autocomplete ─────────────────────────────────────────────────

  function mountLocation() {
    const input = root.querySelector("#loc-input") as HTMLInputElement;
    const list = root.querySelector("#loc-results") as HTMLUListElement;
    let lastQuery = "";
    let token = 0;

    async function doSearch(q: string) {
      const localToken = ++token;
      const results = await searchLocations(q, 8);
      if (localToken !== token) return; // a newer request finished first
      if (results.length === 0) {
        list.innerHTML = `<li class="loc-results__empty">Nothing matching “${escapeHTML(q)}”.</li>`;
        return;
      }
      list.innerHTML = results.map((r) => `
        <li>
          <button class="loc-results__item" data-loc='${escapeHTML(JSON.stringify(r))}'>
            <span class="loc-results__name">${escapeHTML(r.name)}</span>
            <span class="loc-results__sub">${escapeHTML([r.admin1, r.country].filter(Boolean).join(", "))}</span>
          </button>
        </li>
      `).join("");
    }

    let debounce: number | undefined;
    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q === lastQuery) return;
      lastQuery = q;
      window.clearTimeout(debounce);
      if (q.length < 2) { list.innerHTML = ""; return; }
      list.innerHTML = `<li class="loc-results__loading">Looking…</li>`;
      debounce = window.setTimeout(() => doSearch(q), 280);
    });

    list.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".loc-results__item");
      if (!btn) return;
      try {
        const r = JSON.parse(btn.dataset.loc!) as Geocode;
        answers.location = r.name;
        advance();
      } catch {
        return;
      }
    });

    // Enter on the search input commits whatever's typed and advances.
    // If a result list is open, picks the first hit instead.
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const firstResult = list.querySelector<HTMLButtonElement>(".loc-results__item");
      if (firstResult) {
        firstResult.click();
        return;
      }
      const typed = input.value.trim();
      if (typed) {
        answers.location = typed;
        advance();
      }
    });
  }

  // ─── Weather peek ──────────────────────────────────────────────────────────

  let peekToken = 0;
  async function runPeek(date: string) {
    const peekEl = root.querySelector("#peek") as HTMLParagraphElement | null;
    if (!peekEl) return;
    if (!answers.location) {
      peekEl.classList.remove("wizard__peek--ready");
      peekEl.textContent = "Add a location and I'll pull the forecast.";
      return;
    }
    if (!date) return;
    const localToken = ++peekToken;
    peekEl.classList.remove("wizard__peek--ready");
    peekEl.textContent = "Sniffing out the forecast…";
    try {
      // For multi-day trips, pull the forecast across the whole
      // duration so the picks reflect the worst day, not just the
      // start. Single-day trips ask for 1 day.
      const days = answers.endDate ? daysBetween(date, answers.endDate) : 1;
      const w = await forecast(answers.location, date, days);
      if (localToken !== peekToken) return;
      if (!w) {
        peekEl.classList.remove("wizard__peek--ready");
        peekEl.textContent = "No forecast for that spot.";
        return;
      }
      const s = w.summary;
      peekEl.classList.add("wizard__peek--ready");
      peekEl.innerHTML = `
        <strong>${escapeHTML(weatherComment(s))}</strong>
        <span class="wizard__peek-detail">${s.min_c}°/${s.max_c}°C${s.has_rain ? ", " + s.total_precip_mm + " mm rain" : ""}${s.has_snow ? ", " + s.total_snow_cm + " cm snow" : ""}</span>
      `;
    } catch (err) {
      console.warn("weather peek failed:", err);
      peekEl.classList.remove("wizard__peek--ready");
      peekEl.textContent = "";
    }
  }

  // Re-fire the peek when either date changes (debounced). End-date
  // changes matter for multi-day trips so the forecast widens to the
  // new range.
  let peekDebounce: number | undefined;
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.id !== "start-date" && t.id !== "end-date") return;
    const start = (root.querySelector("#start-date") as HTMLInputElement | null)?.value;
    if (!start) return;
    // Sync end-date into answers immediately so runPeek sees it.
    if (t.id === "end-date") {
      const v = (t as HTMLInputElement).value;
      answers.endDate = v && v >= start ? v : null;
    }
    window.clearTimeout(peekDebounce);
    peekDebounce = window.setTimeout(() => runPeek(start), 200);
  });

  // ─── Submit + result ───────────────────────────────────────────────────────

  function buildTripText(): string {
    const a = answers.activity?.label ?? "An outdoor trip";
    const loc = answers.location ?? "Swiss Alps";
    const dateText = answers.startDate ? `starting ${answers.startDate}` : "soon";
    const dur = answers.endDate
      ? `for ${daysBetween(answers.startDate ?? answers.endDate, answers.endDate)} days`
      : answers.startDate ? `for a day trip` : "duration unspecified";
    const base = `${a} near ${loc} ${dateText}, ${dur}.`;
    if (answers.specifics.length === 0) return base;
    const specLabels = answers.specifics
      .map((k) => SPECIFICS_OPTIONS.find((o) => o.key === k)?.label)
      .filter(Boolean)
      .join(", ");
    return `${base} Considerations: ${specLabels}.`;
  }

  async function runPlanner() {
    // Build a personalized headline from the user's answers, so they feel heard.
    const activity = answers.activity?.label.toLowerCase() ?? "your trip";
    const isGeneral = answers.purpose === "general";
    const loc = answers.location ?? "your spot";
    const when = answers.startDate ? friendlyDate(answers.startDate) : "soon";
    const dur = durationLabelFor(answers.startDate, answers.endDate);

    const headline = isGeneral
      ? `Picking everyday gear for <strong>${escapeHTML(activity)}</strong>.`
      : `Curating gear for your ${escapeHTML(activity)} in <strong>${escapeHTML(loc)}</strong>.`;
    const subline = isGeneral ? "" : `${escapeHTML(when)} · ${escapeHTML(dur)}`;

    root.innerHTML = `
      <main class="screen-plan wizard">
        <div class="wizard__loading">
          <h1 class="wizard__q">${headline}</h1>
          ${subline ? `<p class="wizard__loading-sub">${subline}</p>` : ""}
          <p class="wizard__progress-msg" id="progress">
            <span class="wizard__progress-dot" aria-hidden="true"></span>
            <span class="wizard__progress-text">${isGeneral ? "Thinking it over…" : "Sniffing out your picks…"}</span>
          </p>
          <div id="weather"></div>
          <!-- Anticipation skeleton: faint outline of the category cards
               that are about to appear. Sets the shape of what's coming
               so the wait reads as deliberate, not idle. -->
          <ul class="plan-skeleton" aria-hidden="true">
            <li class="plan-skeleton__row"></li>
            <li class="plan-skeleton__row"></li>
            <li class="plan-skeleton__row"></li>
            <li class="plan-skeleton__row"></li>
          </ul>
        </div>
        <div id="result"></div>
      </main>
    `;

    const progressEl = root.querySelector("#progress") as HTMLParagraphElement;
    const weatherEl = root.querySelector("#weather") as HTMLDivElement;
    const resultEl = root.querySelector("#result") as HTMLDivElement;

    try {
      const cur = getPrefs();
      const result = await planTrip(buildTripText(), {
        gender: cur.gender,
        age: cur.age,
        experience: cur.experience,
        shoppingFor: cur.shoppingFor,
        topSize: cur.topSize,
        bottomSize: cur.bottomSize,
        shoeSizeEU: cur.shoeSizeEU,
      }, (msg, w) => {
        const textEl = progressEl.querySelector(".wizard__progress-text");
        if (textEl) textEl.textContent = msg;
        else progressEl.textContent = msg;
        if (w) weatherEl.innerHTML = weatherCard(w);
      });
      if (result.weather && weatherEl.innerHTML === "") {
        weatherEl.innerHTML = weatherCard(result.weather);
      }
      progressEl.remove();
      const empty = result.categories.filter((c) => c.products.length === 0).map((c) => c.key);
      track("plan_returned", {
        categories: result.categories.map((c) => c.key),
        empty_categories: empty,
        total_products: result.categories.reduce((n, c) => n + c.products.length, 0),
      });
      mountCategoryFlow(resultEl, result);
      // If a clothing category was returned and sizes aren't set, gently
      // surface the fit-check tool through Toto.
      const cur2 = getPrefs();
      const sizesMissing = !cur2.topSize || !cur2.bottomSize || !cur2.shoeSizeEU;
      const hasClothing = result.categories.some((c) =>
        /jacket|pant|shirt|sock|boot|shoe|glove|base|fleece|insulat/i.test(c.label),
      );
      if (sizesMissing && hasClothing) {
        pushSuggestion({
          id: "fit-after-plan",
          text: t("toto.suggest.fit"),
          cta: { label: t("toto.suggest.fit.cta"), href: "?screen=fit" },
        });
      }
    } catch (err) {
      console.warn("planTrip failed:", err);
      track("plan_failed", { message: (err as Error)?.message?.slice(0, 60) ?? "unknown" });
      progressEl.textContent = "";
      resultEl.innerHTML = `<div class="status">Something didn't go through. Try again in a moment.</div>`;
    }
  }

  render();
}


// ─── Result UI: category checklist → tappable list → swipe deck per cat ────

type FlowScreen = "categories" | "products" | "swipe";

function mountCategoryFlow(host: HTMLElement, result: PlanResult): void {
  if (result.categories.length === 0) {
    host.innerHTML = `<div class="status">I couldn't put a list together. Try a different place or season.</div>`;
    return;
  }

  // All categories start checked. User unchecks what they don't need.
  const selected = new Set<string>(result.categories.map((c) => c.key));
  // Track which categories the user has already opened (visited) so we can
  // mark them done on the products screen.
  const visited = new Set<string>();
  let screen: FlowScreen = "categories";
  let activeCatKey: string | null = null;

  function activeCategory() {
    return result.categories.find((c) => c.key === activeCatKey) ?? null;
  }

  function render() {
    if (screen === "categories") host.innerHTML = renderCategories();
    else if (screen === "products") host.innerHTML = renderCategoryList();
    else host.innerHTML = renderSwipe();
    if (screen === "swipe") bindSwipe();
  }

  // Screen 1: checklist
  function renderCategories(): string {
    const items = result.categories.map((c) => `
      <li>
        <label class="cat-row ${selected.has(c.key) ? "cat-row--on" : ""}">
          <input type="checkbox" data-key="${escapeHTML(c.key)}" ${selected.has(c.key) ? "checked" : ""} />
          <span class="cat-row__body">
            <span class="cat-row__name">${escapeHTML(c.label)}</span>
            ${c.why ? `<span class="cat-row__why">${escapeHTML(c.why)}</span>` : ""}
          </span>
        </label>
      </li>
    `).join("");

    return `
      <div class="cat-flow">
        <h2 class="cat-flow__title">Here's what I'd pack</h2>
        <ul class="cat-list">${items}</ul>
        <button class="primary cat-flow__cta" id="cat-go">
          Next · ${selected.size} ${selected.size === 1 ? "category" : "categories"}
        </button>
      </div>
    `;
  }

  // Screen 2: tappable categories. Tap a category to open the swipe deck.
  function renderCategoryList(): string {
    const chosen = result.categories.filter((c) => selected.has(c.key));
    const rows = chosen.map((c) => {
      const totalCount = c.products.length;
      const addedCount = c.products.filter((p) => getList().includes(p.code)).length;
      const isVisited = visited.has(c.key);
      const isDone = addedCount > 0 || isVisited;
      const status = addedCount > 0
        ? `${addedCount} added`
        : isVisited ? "Skipped" : `${totalCount} option${totalCount > 1 ? "s" : ""}`;
      return `
        <button type="button" class="cat-pick ${isDone ? "cat-pick--done" : ""}" data-open="${escapeHTML(c.key)}">
          <span class="cat-pick__icon">${illustrationForCategory(productCategoryForKey(c.key) ?? c.key)}</span>
          <span class="cat-pick__body">
            <span class="cat-pick__name">${escapeHTML(c.label)}</span>
            ${c.why ? `<span class="cat-pick__why">${escapeHTML(c.why)}</span>` : ""}
            <span class="cat-pick__status">${escapeHTML(status)}</span>
          </span>
          <span class="cat-pick__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </span>
        </button>
      `;
    }).join("");

    const totalAdded = getList().length;

    return `
      <div class="cat-flow">
        <button class="cat-flow__back" id="cat-back">Back</button>
        <div class="cat-picks">${rows}</div>
        <a class="primary cat-flow__cta" href="?screen=map">${totalAdded > 0 ? `Find ${totalAdded} in the store` : "Find them in the store"}</a>
      </div>
    `;
  }

  // Swipe deck: stripped of top text so the cards fill the screen and
  // there's nothing to scroll past. A small floating back button and
  // the undo control are the only chrome.
  function renderSwipe(): string {
    const cat = activeCategory();
    if (!cat) return "";
    return `
      <div class="cat-flow cat-flow--swipe">
        <button class="cat-flow__back cat-flow__back--float" id="swipe-back" aria-label="Back to categories">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="deck-frame">
          <div class="deck-progress" id="deck-progress"></div>
          <div class="deck-stage" id="deck-stage"></div>
          <button class="deck-undo-link" id="deck-undo" disabled
                  title="Undo last" aria-label="Undo last">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
            </svg>
            Undo
          </button>
        </div>
      </div>
    `;
  }

  // Best-effort: try to derive the catalog category from a category key.
  // Most of the time the key IS the catalog category (e.g. "rain-jacket").
  function productCategoryForKey(key: string): string | null {
    const cat = result.categories.find((c) => c.key === key);
    if (!cat || cat.products.length === 0) return null;
    const product = getProduct(cat.products[0].code);
    return product?.category ?? key;
  }

  function bindSwipe() {
    const cat = activeCategory();
    if (!cat) return;
    const stage = host.querySelector("#deck-stage") as HTMLDivElement;
    const progress = host.querySelector("#deck-progress") as HTMLDivElement;
    const undoBtn = host.querySelector("#deck-undo") as HTMLButtonElement;

    mountSwipeDeck(stage, progress, undoBtn, cat.products, () => {
      // When the deck finishes (cursor past the end), return to category list.
      visited.add(cat.key);
      screen = "products";
      activeCatKey = null;
      render();
    });
  }

  host.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-key]")) {
      const key = t.dataset.key!;
      if (t.checked) selected.add(key); else selected.delete(key);
      const cta = host.querySelector("#cat-go");
      if (cta) cta.textContent = `Show me the gear · ${selected.size} ${selected.size === 1 ? "category" : "categories"}`;
      const li = t.closest("label");
      if (li) li.classList.toggle("cat-row--on", t.checked);
    }
  });

  host.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("#cat-go")) {
      if (selected.size === 0) return;
      screen = "products";
      render();
      return;
    }
    if (target.closest("#cat-back")) {
      screen = "categories";
      render();
      return;
    }
    if (target.closest("#swipe-back")) {
      visited.add(activeCatKey ?? "");
      screen = "products";
      activeCatKey = null;
      render();
      return;
    }
    const open = target.closest<HTMLButtonElement>("[data-open]");
    if (open) {
      activeCatKey = open.dataset.open!;
      const cat = result.categories.find((c) => c.key === activeCatKey);
      track("category_opened", { category: activeCatKey, product_count: cat?.products.length ?? 0 });
      screen = "swipe";
      render();
      return;
    }
  });

  render();
}

// ─── Swipe deck (scoped to a single category's products) ────────────────────

const SWIPE_THRESHOLD_PX = 110;
type Decision = "add" | "skip";

function mountSwipeDeck(
  stage: HTMLDivElement,
  progress: HTMLDivElement,
  undoBtn: HTMLButtonElement,
  picks: PlanPick[],
  onFinish: () => void,
): void {
  const history: Decision[] = [];
  let cursor = 0;

  function render(isFreshSwipe = false) {
    if (cursor >= picks.length) { onFinish(); return; }
    progress.textContent = `${cursor + 1} of ${picks.length}`;
    progress.style.visibility = "visible";
    stage.innerHTML = renderCard(picks[cursor], cursor);
    undoBtn.disabled = history.length === 0;
    const top = stage.querySelector(`[data-card-index="${cursor}"]`) as HTMLElement | null;
    if (top) {
      bindCard(top);
      if (isFreshSwipe) {
        top.classList.add("deck-card--entering");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => top.classList.remove("deck-card--entering"));
        });
      }
    }
  }

  function renderCard(entry: PlanPick, index: number): string {
    const p = getProduct(entry.code);
    if (!p) return "";
    const why = entry.why;
    const priceBlock = p.discount_pct > 0
      ? `<span class="deck-card__price--was">CHF ${p.price_chf.toFixed(0)}</span> CHF ${(p.price_chf * (1 - p.discount_pct / 100)).toFixed(0)}`
      : `CHF ${p.price_chf.toFixed(0)}`;
    return `
      <article class="deck-card" data-card-index="${index}" tabindex="0">
        <div class="deck-card__tint"></div>
        <div class="deck-card__art">${illustrationForCategory(p.category)}</div>
        <div class="deck-card__head">
          <span class="deck-card__brand">${escapeHTML(p.brand)} · ${escapeHTML(p.color)} · size ${escapeHTML(p.size)}</span>
        </div>
        <h3 class="deck-card__name">${escapeHTML(p.name)}</h3>
        <div class="deck-card__price">${priceBlock}</div>
        ${why ? `<p class="deck-card__why">${escapeHTML(why)}</p>` : ""}
        <div class="deck-card__meta">
          ${p.weight_g ? `<span class="deck-card__meta-item">${p.weight_g} g</span>` : ""}
          ${p.waterproof_rating_mm ? `<span class="deck-card__meta-item">${p.waterproof_rating_mm.toLocaleString()} mm</span>` : ""}
          ${p.temp_rating_c != null ? `<span class="deck-card__meta-item">${p.temp_rating_c}°C</span>` : ""}
          ${p.material ? `<span class="deck-card__meta-item">${escapeHTML(p.material)}</span>` : ""}
        </div>
        <div class="deck-card__hint">
          <button type="button" class="deck-card__hint-chip deck-card__hint-chip--skip"
                  data-action="skip" title="Skip" aria-label="Skip this one">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                 stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <button type="button" class="deck-card__hint-chip deck-card__hint-chip--add"
                  data-action="add" title="Add to my list" aria-label="Add to list">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                 stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </button>
        </div>
      </article>
    `;
  }

  function commit(decision: Decision, animateDir: "right" | "left") {
    const top = stage.querySelector(`[data-card-index="${cursor}"]`) as HTMLElement | null;
    if (!top) return;
    top.classList.remove("deck-card--grabbing");
    top.style.transform = "";
    void top.offsetWidth;
    top.classList.add(animateDir === "right" ? "deck-card--gone-right" : "deck-card--gone-left");
    const entry = picks[cursor];
    const product = getProduct(entry.code);
    track("swipe_decision", {
      code: entry.code,
      category: product?.category ?? null,
      decision: decision === "add" ? "add" : "skip",
    });
    if (decision === "add") addToList(entry.code, "swipe");
    if ("vibrate" in navigator) navigator.vibrate(decision === "add" ? [10, 30, 12] : 18);
    history.push(decision);
    cursor++;
    window.setTimeout(() => render(true), 320);
  }

  function undo() {
    if (history.length === 0) return;
    const last = history.pop()!;
    cursor--;
    if (last === "add") removeFromList(picks[cursor].code);
    render();
  }

  function bindCard(card: HTMLElement) {
    const tint = card.querySelector(".deck-card__tint") as HTMLDivElement | null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let captured = false;
    // "axis" is settled after the user moves a few pixels: "x" locks in
    // a swipe gesture (we eat the event and intercept), "y" releases the
    // gesture so the page can scroll normally. Until axis is set we're
    // observing only.
    let axis: "" | "x" | "y" = "";
    const AXIS_LOCK_PX = 10;

    function setTransform(dx: number, dy: number) {
      const x = Math.round(dx);
      const y = Math.round(dy * 0.15);
      const tiltSource = Math.abs(dx) < 8 ? 0 : (dx - Math.sign(dx) * 8);
      const rotate = (tiltSource / 18).toFixed(2);
      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`;
      if (tint) {
        const t = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD_PX);
        tint.style.background = dx > 0
          ? "linear-gradient(180deg, rgba(44,122,85,0), rgba(44,122,85,0.18))"
          : "linear-gradient(180deg, rgba(185,28,28,0), rgba(185,28,28,0.14))";
        tint.style.opacity = String(t * 0.85);
      }
    }
    function resetTransform() {
      card.classList.remove("deck-card--grabbing");
      card.style.transform = "";
      if (tint) tint.style.opacity = "0";
    }

    card.addEventListener("pointerdown", (e) => {
      if (Number(card.dataset.cardIndex) !== cursor) return;
      if ((e.target as HTMLElement).closest(".deck-card__hint-chip")) return;
      dragging = true;
      axis = "";
      startX = e.clientX;
      startY = e.clientY;
      // Don't add the grabbing class until we know the gesture is horizontal —
      // that way vertical-scroll gestures don't see any visual jump.
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // Decide the axis once the finger has moved enough.
      if (axis === "") {
        if (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX) {
          axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (axis === "x") {
            // Lock the gesture: capture pointer + tell browser not to scroll.
            card.classList.add("deck-card--grabbing");
            try { card.setPointerCapture(e.pointerId); captured = true; } catch { /* ignore */ }
          } else {
            // Vertical scroll: release and let the page handle it.
            dragging = false;
            return;
          }
        } else {
          return;     // not enough movement to decide yet
        }
      }
      if (axis === "x") {
        e.preventDefault?.();
        setTransform(dx, dy);
      }
    });
    function finish(e: PointerEvent) {
      if (!dragging) { axis = ""; return; }
      dragging = false;
      // Only finalize a swipe if we actually locked the horizontal axis.
      if (axis !== "x") { axis = ""; return; }
      axis = "";
      const dx = e.clientX - startX;
      if (captured) {
        try { card.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        captured = false;
      }
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        commit(dx > 0 ? "add" : "skip", dx > 0 ? "right" : "left");
      } else {
        resetTransform();
      }
    }
    card.addEventListener("pointerup", finish);
    card.addEventListener("pointercancel", finish);
  }

  stage.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLButtonElement | null;
    if (!btn) return;
    const action = btn.dataset.action as Decision;
    if (cursor >= picks.length) return;
    commit(action, action === "add" ? "right" : "left");
  });

  undoBtn.addEventListener("click", undo);

  render();
}
