import { getProduct } from "../lib/catalog";
import { addToList, removeFromList, getList } from "../lib/list";
import { planTrip, type PlanResult, type PlanPick } from "../integrations/ai-planner";
import {
  searchLocations,
  forecast,
  type ForecastSummary,
  type Geocode,
} from "../integrations/weather";
import { getPrefs, setPrefs, type Gender, type Experience, type AgeBucket, type ShoppingFor, type Prefs } from "../lib/prefs";
import { icon } from "../lib/icons";
import { illustrationForCategory } from "../lib/product-art";
import { track } from "../lib/analytics";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── Static option lists ─────────────────────────────────────────────────────

type Purpose = "trip" | "general" | "browse";
const PURPOSE_OPTIONS: Array<{ key: Purpose; label: string; sub: string }> = [
  { key: "trip",    label: "Planning a trip",    sub: "Specific place and dates" },
  { key: "general", label: "Just everyday gear", sub: "No trip in particular" },
  { key: "browse",  label: "Just looking around", sub: "Skip the questions" },
];

const SHOPPING_FOR_OPTIONS: Array<{ key: ShoppingFor; label: string; sub: string }> = [
  { key: "self",    label: "Myself",         sub: "Just my own gear" },
  { key: "someone", label: "Someone else",   sub: "A friend or partner" },
  { key: "family",  label: "My family",      sub: "Two or more people" },
];

const GENDER_FOR_OPTIONS: Array<{ key: Gender; label: string; sub: string }> = [
  { key: "man",   label: "A man",   sub: "Cut for men's bodies" },
  { key: "woman", label: "A woman", sub: "Cut for women's bodies" },
  { key: "other", label: "Unisex",  sub: "Either way" },
];

const AGE_OPTIONS: Array<{ key: AgeBucket; label: string }> = [
  { key: "u20",   label: "Under 20" },
  { key: "20-30", label: "20 to 30" },
  { key: "30-45", label: "30 to 45" },
  { key: "45-60", label: "45 to 60" },
  { key: "60+",   label: "60 plus" },
];

const EXPERIENCE_OPTIONS: Array<{ key: Experience; label: string; sub: string }> = [
  { key: "new", label: "New to this", sub: "First time out" },
  { key: "comfortable", label: "Comfortable", sub: "I've done a few" },
  { key: "enthusiast", label: "Enthusiast", sub: "Out most weekends" },
  { key: "pro", label: "Pro", sub: "I do this all the time" },
];

const SIZE_CHIPS: Array<NonNullable<Prefs["topSize"]>> = ["XS", "S", "M", "L", "XL"];
const SHOE_CHIPS = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45];

type Activity =
  | { key: "day-hike"; label: "Day hike" }
  | { key: "multi-day"; label: "Multi-day trek" }
  | { key: "camping"; label: "Camping" }
  | { key: "climbing"; label: "Climbing" }
  | { key: "trail-run"; label: "Trail run" }
  | { key: "skiing"; label: "Skiing or snowboarding" }
  | { key: "other"; label: string };

const ACTIVITY_OPTIONS: Activity[] = [
  { key: "day-hike", label: "Day hike" },
  { key: "multi-day", label: "Multi-day trek" },
  { key: "camping", label: "Camping" },
  { key: "climbing", label: "Climbing" },
  { key: "trail-run", label: "Trail run" },
  { key: "skiing", label: "Skiing or snowboarding" },
];

type Answers = {
  purpose: Purpose | null;
  activity: Activity | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null; // null means single-day
};

type Step = "purpose" | "shoppingFor" | "whoFor" | "age" | "experience" | "activity" | "location" | "when" | "sizes";

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

function sizesIncomplete(prefs: Prefs): boolean {
  return !prefs.topSize || !prefs.bottomSize || !prefs.shoeSizeEU;
}

// Steps depend on what's missing in prefs and the chosen purpose.
//   - shoppingFor asked if null
//   - whoFor asked if gender is null (skipped if shopping for self/family with no
//     dominant gender)
//   - age, experience asked if null
//   - trip path also asks location + when
//   - sizes asked at the end if any size is missing
function buildSteps(prefs: Prefs, purpose: Purpose | null): Step[] {
  if (purpose === null) return ["purpose"];
  if (purpose === "browse") return ["purpose"];

  const profile: Step[] = [];
  if (!prefs.shoppingFor) profile.push("shoppingFor");
  if (!prefs.gender)      profile.push("whoFor");
  if (!prefs.age)         profile.push("age");
  if (!prefs.experience)  profile.push("experience");

  const tripExtras: Step[] = purpose === "trip" ? ["location", "when"] : [];
  const sizes: Step[] = sizesIncomplete(prefs) ? ["sizes"] : [];
  return ["purpose", ...profile, "activity", ...tripExtras, ...sizes];
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
  const answers: Answers = {
    purpose: null,
    activity: null,
    location: null,
    startDate: null,
    endDate: null,
  };

  let steps: Step[] = buildSteps(getPrefs(), null);
  let i = 0;

  track("wizard_start", { initial_steps: steps.length });

  root.addEventListener("click", onTap);

  function current(): Step { return steps[i]; }
  function rebuildSteps() {
    steps = buildSteps(getPrefs(), answers.purpose);
  }

  function advance() {
    const prev = steps[i];
    if (prev) track("wizard_step", { step: prev });
    i++;
    if (i >= steps.length) {
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
      });
      runPlanner();
      return;
    }
    render();
  }

  function back() {
    i = Math.max(0, i - 1);
    render();
  }

  function onTap(e: Event) {
    const t = e.target as HTMLElement;
    if (t.closest("#back")) { back(); return; }
    if (t.closest(".wizard__skip")) { advance(); return; }
    const btn = t.closest<HTMLButtonElement>("[data-pick]");
    if (!btn) return;
    applyPick(btn.dataset.pick!);
  }

  function applyPick(value: string) {
    const step = current();
    switch (step) {
      case "purpose": {
        if (value === "trip" || value === "general" || value === "browse") {
          answers.purpose = value;
          rebuildSteps();
          if (value === "browse") {
            // Quietly head back home; the wizard isn't useful here.
            window.location.href = "?screen=home";
            return;
          }
          advance(); return;
        }
        return;
      }
      case "shoppingFor": {
        if (value === "skip") { advance(); return; }
        setPrefs({ shoppingFor: value as ShoppingFor });
        advance(); return;
      }
      case "whoFor": {
        if (value === "skip") { advance(); return; }
        setPrefs({ gender: value as Gender });
        advance(); return;
      }
      case "age": {
        if (value === "skip") { advance(); return; }
        setPrefs({ age: value as AgeBucket });
        advance(); return;
      }
      case "experience": {
        if (value === "skip") { advance(); return; }
        setPrefs({ experience: value as Experience });
        advance(); return;
      }
      case "activity": {
        if (value === "other") {
          const v = (root.querySelector("#activity-other") as HTMLInputElement | null)?.value.trim();
          if (!v) return;
          answers.activity = { key: "other", label: v };
        } else {
          const found = ACTIVITY_OPTIONS.find((o) => o.key === value);
          if (!found) return;
          answers.activity = found;
        }
        advance(); return;
      }
      case "location": {
        // Location uses its own click handlers (see mountLocation).
        return;
      }
      case "when": {
        if (value !== "continue") return;
        const s = (root.querySelector("#start-date") as HTMLInputElement | null)?.value || todayIso();
        const e = (root.querySelector("#end-date") as HTMLInputElement | null)?.value;
        answers.startDate = s;
        answers.endDate = e && e >= s ? e : null;
        advance(); return;
      }
      case "sizes": {
        if (value === "skip") { advance(); return; }
        if (value === "continue") { advance(); return; }
        if (value.startsWith("top:")) {
          setPrefs({ topSize: value.slice(4) as Prefs["topSize"], sizeSource: "manual" });
        } else if (value.startsWith("bot:")) {
          setPrefs({ bottomSize: value.slice(4) as Prefs["bottomSize"], sizeSource: "manual" });
        } else if (value.startsWith("shoe:")) {
          setPrefs({ shoeSizeEU: Number(value.slice(5)), sizeSource: "manual" });
        }
        // Re-render the same step to reflect the new selection state.
        render();
        return;
      }
    }
  }

  function render() {
    root.innerHTML = `
      <main class="screen-plan wizard">
        <div class="wizard__top">
          ${i > 0
            ? `<button class="wizard__back" id="back" aria-label="Back">‹</button>`
            : `<a class="wizard__back" href="?screen=home" aria-label="Home">‹</a>`}
          <span class="wizard__progress">Step ${i + 1} of ${steps.length}</span>
        </div>
        ${renderStep()}
      </main>
    `;
    if (current() === "location") mountLocation();
    if (current() === "when") {
      // Fire an initial peek for today's default start date.
      const startInput = root.querySelector("#start-date") as HTMLInputElement | null;
      if (startInput) runPeek(startInput.value);
    }
  }

  function skipBtn(label = "I'll skip"): string {
    return `<button class="wizard__skip" type="button">${label}</button>`;
  }

  function renderStep(): string {
    const step = current();
    if (step === "purpose") {
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">What brings you in?</h1>
          <div class="wizard__list">
            ${PURPOSE_OPTIONS.map((o) => `
              <button class="wizard__opt wizard__opt--row wizard__opt--two" data-pick="${o.key}">
                <span class="wizard__opt-title">${escapeHTML(o.label)}</span>
                <span class="wizard__opt-sub">${escapeHTML(o.sub)}</span>
              </button>`).join("")}
          </div>
        </section>
      `;
    }
    if (step === "shoppingFor") {
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">Who are we shopping for?</h1>
          <div class="wizard__list">
            ${SHOPPING_FOR_OPTIONS.map((o) => `
              <button class="wizard__opt wizard__opt--row wizard__opt--two" data-pick="${o.key}">
                <span class="wizard__opt-title">${escapeHTML(o.label)}</span>
                <span class="wizard__opt-sub">${escapeHTML(o.sub)}</span>
              </button>`).join("")}
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "whoFor") {
      const sf = getPrefs().shoppingFor;
      const headline = sf === "family"
        ? "Whose sizes should I lean on?"
        : sf === "someone"
          ? "Who are you shopping for?"
          : "And who are we packing for?";
      const hint = sf === "family"
        ? "Pick the main wearer, or unisex if it's a mix."
        : "Helps me suggest the right cut.";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(headline)}</h1>
          <p class="wizard__hint">${escapeHTML(hint)}</p>
          <div class="wizard__list">
            ${GENDER_FOR_OPTIONS.map((o) => `
              <button class="wizard__opt wizard__opt--row wizard__opt--two" data-pick="${o.key}">
                <span class="wizard__opt-title">${escapeHTML(o.label)}</span>
                <span class="wizard__opt-sub">${escapeHTML(o.sub)}</span>
              </button>`).join("")}
          </div>
          ${skipBtn("Prefer not to say")}
        </section>
      `;
    }
    if (step === "age") {
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">Age range?</h1>
          <p class="wizard__hint">Helps me tune comfort versus performance.</p>
          <div class="wizard__list">
            ${AGE_OPTIONS.map((o) => `
              <button class="wizard__opt wizard__opt--row" data-pick="${o.key}">${escapeHTML(o.label)}</button>`).join("")}
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "experience") {
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">How outdoorsy are you?</h1>
          <div class="wizard__list">
            ${EXPERIENCE_OPTIONS.map((o) => `
              <button class="wizard__opt wizard__opt--row wizard__opt--two" data-pick="${o.key}">
                <span class="wizard__opt-title">${escapeHTML(o.label)}</span>
                <span class="wizard__opt-sub">${escapeHTML(o.sub)}</span>
              </button>`).join("")}
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "activity") {
      const lead = answers.purpose === "general" ? "Got it. What kind of gear?" : "What are you up to?";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(lead)}</h1>
          <div class="wizard__grid">
            ${ACTIVITY_OPTIONS.map((o) => `<button class="wizard__opt" data-pick="${o.key}">${escapeHTML(o.label)}</button>`).join("")}
          </div>
          <div class="wizard__other">
            <input id="activity-other" type="text" placeholder="Something else" autocomplete="off" />
            <button class="wizard__other-btn" data-pick="other">Continue ›</button>
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "location") {
      const lead = answers.activity?.label ?? "Got it";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(lead)}. Where to?</h1>
          <div class="loc-search">
            <input id="loc-input" type="search" autocomplete="off" placeholder="Type any place, anywhere…" />
            <ul id="loc-results" class="loc-results"></ul>
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "when") {
      const today = todayIso();
      const lead = answers.location ?? "Got it";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(lead)}. When?</h1>
          <p class="wizard__hint">Pick a start. Add an end date if you're out for more than a day.</p>
          <div class="wizard__date-grid">
            <label class="wizard__date-label">
              <span>Start</span>
              <input id="start-date" type="date" value="${today}" min="${today}" />
            </label>
            <label class="wizard__date-label">
              <span>End <small class="muted">(optional)</small></span>
              <input id="end-date" type="date" min="${today}" />
            </label>
          </div>
          <p class="wizard__peek" id="peek"></p>
          <button class="primary" data-pick="continue">Continue</button>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "sizes") {
      const p = getPrefs();
      const block = (label: string, prefix: string, options: Array<string | number>, selected: string | number | null) => `
        <div class="sizes-block">
          <p class="sizes-block__label">${label}</p>
          <div class="wizard__chips">
            ${options.map((s) => `<button class="wizard__chip ${selected === s ? "wizard__chip--on" : ""}" data-pick="${prefix}:${s}">${s}</button>`).join("")}
          </div>
        </div>
      `;
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">What size do you wear?</h1>
          <p class="wizard__hint">Skip anything you don't know.</p>
          ${!p.topSize    ? block("Top",   "top",  SIZE_CHIPS as Array<string|number>, p.topSize) : ""}
          ${!p.bottomSize ? block("Bottom", "bot", SIZE_CHIPS as Array<string|number>, p.bottomSize) : ""}
          ${!p.shoeSizeEU ? block("Shoe (EU)", "shoe", SHOE_CHIPS as Array<string|number>, p.shoeSizeEU) : ""}
          <a class="fit-nudge fit-nudge--lite" href="?screen=fit">
            <span class="fit-nudge__icon">${icon("ruler", 18)}</span>
            <span class="fit-nudge__body">
              <span class="fit-nudge__title">Or take a quick photo</span>
              <span class="fit-nudge__sub">I'll guess your sizes from a single shot.</span>
            </span>
            <span class="fit-nudge__chev" aria-hidden="true">›</span>
          </a>
          <button class="primary" data-pick="continue">Continue</button>
          ${skipBtn("I'll set sizes later")}
        </section>
      `;
    }
    return "";
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
        // Store the plain name. Open-Meteo geocodes 'Chamonix' more reliably
        // than 'Chamonix, Auvergne-Rhône-Alpes'.
        answers.location = r.name;
      } catch {
        return;
      }
      advance();
    });

    input.focus();
  }

  // ─── Weather peek ──────────────────────────────────────────────────────────

  let peekToken = 0;
  async function runPeek(date: string) {
    const peekEl = root.querySelector("#peek") as HTMLParagraphElement | null;
    if (!peekEl) return;
    if (!answers.location) {
      peekEl.classList.remove("wizard__peek--ready");
      peekEl.textContent = "Tip: set a location in the previous step and I'll pull the forecast.";
      return;
    }
    if (!date) return;
    const localToken = ++peekToken;
    peekEl.classList.remove("wizard__peek--ready");
    peekEl.textContent = "Pulling the forecast…";
    try {
      const w = await forecast(answers.location, date, 1);
      if (localToken !== peekToken) return;
      if (!w) {
        peekEl.classList.remove("wizard__peek--ready");
        peekEl.textContent = "I couldn't grab a forecast for that spot. Continuing anyway.";
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

  // Re-fire the peek when start date changes (debounced).
  let peekDebounce: number | undefined;
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.id !== "start-date") return;
    const v = (t as HTMLInputElement).value;
    window.clearTimeout(peekDebounce);
    peekDebounce = window.setTimeout(() => runPeek(v), 200);
  });

  // ─── Submit + result ───────────────────────────────────────────────────────

  function buildTripText(): string {
    // The profile now goes into the system prompt directly; the trip text
    // stays focused on the trip itself.
    const a = answers.activity?.label ?? "An outdoor trip";
    if (answers.purpose === "general") {
      return `Everyday outdoor gear for ${a.toLowerCase()}, no specific trip.`;
    }
    const loc = answers.location ?? "Swiss Alps";
    const dateText = answers.startDate ? `starting ${answers.startDate}` : "soon";
    const dur = answers.endDate
      ? `for ${daysBetween(answers.startDate ?? answers.endDate, answers.endDate)} days`
      : `for a day trip`;
    return `${a} near ${loc} ${dateText}, ${dur}.`;
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
          <p class="wizard__progress-msg" id="progress">${isGeneral ? "Thinking it over…" : "Pulling the forecast…"}</p>
          <div id="weather"></div>
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
        progressEl.textContent = msg;
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
          <span class="cat-row__tick" aria-hidden="true">✓</span>
        </label>
      </li>
    `).join("");

    return `
      <div class="cat-flow">
        ${result.reasoning ? `<p class="cat-summary">${escapeHTML(result.reasoning)}</p>` : ""}
        <h2 class="cat-flow__title">Here's what I'd pack</h2>
        <p class="cat-flow__hint">Uncheck anything you don't need. I'll only show options for the ones you keep.</p>
        <ul class="cat-list">${items}</ul>
        <button class="primary cat-flow__cta" id="cat-go">
          Show me the gear · ${selected.size} ${selected.size === 1 ? "category" : "categories"}
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
          <span class="cat-pick__chev" aria-hidden="true">›</span>
        </button>
      `;
    }).join("");

    const totalAdded = getList().length;

    return `
      <div class="cat-flow">
        <button class="cat-flow__back" id="cat-back">‹ Back to the list</button>
        <h2 class="cat-flow__title">Pick what you want</h2>
        <p class="cat-flow__hint">Tap a category to see options. Swipe right to add, left to skip.</p>
        <div class="cat-picks">${rows}</div>
        <a class="primary cat-flow__cta" href="?screen=map">${totalAdded > 0 ? `Find ${totalAdded} in the store ›` : "Find them in the store ›"}</a>
      </div>
    `;
  }

  // Screen 3: the swipe deck for one category
  function renderSwipe(): string {
    const cat = activeCategory();
    if (!cat) return "";
    return `
      <div class="cat-flow">
        <button class="cat-flow__back" id="swipe-back">‹ Back to categories</button>
        <h2 class="cat-flow__title">${escapeHTML(cat.label)}</h2>
        ${cat.why ? `<p class="cat-flow__hint">${escapeHTML(cat.why)}</p>` : ""}
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
          <span class="deck-card__zone">Zone ${escapeHTML(p.zone)}</span>
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
      startX = e.clientX;
      startY = e.clientY;
      card.classList.add("deck-card--grabbing");
      try { card.setPointerCapture(e.pointerId); captured = true; } catch { /* ignore */ }
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      setTransform(e.clientX - startX, e.clientY - startY);
    });
    function finish(e: PointerEvent) {
      if (!dragging) return;
      dragging = false;
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
