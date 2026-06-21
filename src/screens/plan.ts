import type { Product } from "../lib/types";
import { getProduct } from "../lib/catalog";
import { addToList, removeFromList } from "../lib/list";
import { planTrip, type PlanResult } from "../integrations/ai-planner";
import {
  searchLocations,
  forecast,
  type ForecastSummary,
  type Geocode,
} from "../integrations/weather";
import { getPrefs, setPrefs, type Gender, type Experience, type Prefs } from "../lib/prefs";
import { illustrationForCategory } from "../lib/product-art";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── Static option lists ─────────────────────────────────────────────────────

const GENDER_OPTIONS: Array<{ key: Gender; label: string }> = [
  { key: "man", label: "Man" },
  { key: "woman", label: "Woman" },
  { key: "other", label: "Other" },
];

const EXPERIENCE_OPTIONS: Array<{ key: Experience; label: string; sub: string }> = [
  { key: "new", label: "New to this", sub: "First time out" },
  { key: "comfortable", label: "Comfortable", sub: "I've done a few" },
  { key: "enthusiast", label: "Enthusiast", sub: "Out most weekends" },
  { key: "pro", label: "Pro", sub: "I do this all the time" },
];

type Activity =
  | { key: "day-hike"; label: "Day hike" }
  | { key: "multi-day"; label: "Multi-day trek" }
  | { key: "camping"; label: "Camping" }
  | { key: "climbing"; label: "Climbing" }
  | { key: "trail-run"; label: "Trail run" }
  | { key: "skiing"; label: "Skiing or snowboarding" }
  | { key: "other"; label: string };

type Duration =
  | { key: "day"; label: "Day trip"; days: 1 }
  | { key: "overnight"; label: "Overnight"; days: 2 }
  | { key: "short"; label: "2 to 3 days"; days: 3 }
  | { key: "long"; label: "4 or more days"; days: 5 };

const ACTIVITY_OPTIONS: Activity[] = [
  { key: "day-hike", label: "Day hike" },
  { key: "multi-day", label: "Multi-day trek" },
  { key: "camping", label: "Camping" },
  { key: "climbing", label: "Climbing" },
  { key: "trail-run", label: "Trail run" },
  { key: "skiing", label: "Skiing or snowboarding" },
];

const DURATION_OPTIONS: Duration[] = [
  { key: "day", label: "Day trip", days: 1 },
  { key: "overnight", label: "Overnight", days: 2 },
  { key: "short", label: "2 to 3 days", days: 3 },
  { key: "long", label: "4 or more days", days: 5 },
];

type Answers = {
  activity: Activity | null;
  location: string | null;
  date: string | null;
  duration: Duration | null;
};

type Step = "gender" | "experience" | "activity" | "location" | "date" | "duration";

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

function buildSteps(prefs: Prefs): Step[] {
  const profile: Step[] = prefs.profileOffered ? [] : ["gender", "experience"];
  return [...profile, "activity", "location", "date", "duration"];
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

export function renderPlan(root: HTMLElement) {
  const prefs = getPrefs();
  const steps = buildSteps(prefs);
  let i = 0;

  const answers: Answers = { activity: null, location: null, date: null, duration: null };

  root.addEventListener("click", onTap);

  function current(): Step { return steps[i]; }

  function advance() {
    i++;
    // Mark profile as offered once we've moved past the last profile step.
    if (i > 0 && steps[i - 1] === "experience") {
      setPrefs({ profileOffered: true });
    }
    if (i >= steps.length) { runPlanner(); return; }
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
      case "gender": {
        if (value === "skip") { advance(); return; }
        setPrefs({ gender: value as Gender });
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
      case "date": {
        if (value !== "continue") return;
        const v = (root.querySelector("#when-date") as HTMLInputElement | null)?.value || todayIso();
        answers.date = v;
        advance(); return;
      }
      case "duration": {
        const found = DURATION_OPTIONS.find((o) => o.key === value);
        if (!found) return;
        answers.duration = found;
        advance(); return;
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
    if (current() === "date") {
      // Fire an initial peek for today's default value, so the line appears
      // even if the user doesn't change the date input.
      const dateInput = root.querySelector("#when-date") as HTMLInputElement | null;
      if (dateInput) runPeek(dateInput.value);
    }
  }

  function skipBtn(label = "I'll skip"): string {
    return `<button class="wizard__skip" type="button">${label}</button>`;
  }

  function renderStep(): string {
    const step = current();
    if (step === "gender") {
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">First, who am I packing for?</h1>
          <p class="wizard__hint">This helps me suggest the right cut and size.</p>
          <div class="wizard__list">
            ${GENDER_OPTIONS.map((o) => `<button class="wizard__opt wizard__opt--row" data-pick="${o.key}">${o.label}</button>`).join("")}
          </div>
          ${skipBtn("Prefer not to say")}
        </section>
      `;
    }
    if (step === "experience") {
      const lead = leadFromPrefs();
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(lead)} How outdoorsy are you?</h1>
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
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(transitionLead())} What are you up to?</h1>
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
          <p class="wizard__hint">Type a place. I'll pull it from the world map.</p>
          <div class="loc-search">
            <input id="loc-input" type="search" autocomplete="off" placeholder="e.g. Chamonix, Yosemite, Patagonia…" />
            <ul id="loc-results" class="loc-results"></ul>
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "date") {
      const today = todayIso();
      const lead = answers.location ?? "Got it";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(lead)}. When?</h1>
          <div class="wizard__date-row">
            <input id="when-date" type="date" value="${today}" min="${today}" />
            <button class="primary wizard__date-go" data-pick="continue">Continue</button>
          </div>
          <p class="wizard__peek" id="peek"></p>
          ${skipBtn()}
        </section>
      `;
    }
    if (step === "duration") {
      const dateLabel = answers.date ? friendlyDate(answers.date) : "Got it";
      return `
        <section class="wizard__step">
          <h1 class="wizard__q">${escapeHTML(dateLabel)}. How long are you out?</h1>
          <div class="wizard__list">
            ${DURATION_OPTIONS.map((o) => `<button class="wizard__opt wizard__opt--row" data-pick="${o.key}">${escapeHTML(o.label)}</button>`).join("")}
          </div>
          ${skipBtn()}
        </section>
      `;
    }
    return "";
  }

  function leadFromPrefs(): string {
    const g = getPrefs().gender;
    if (g === "man") return "Good to know.";
    if (g === "woman") return "Good to know.";
    if (g === "other") return "Got it.";
    return "No worries.";
  }
  function transitionLead(): string {
    // After profile (or skipped), start the trip questions warmly.
    return getPrefs().profileOffered || i === 0 ? "Now, the trip." : "Got it.";
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

  // Re-fire the peek on commit (change), debounced. Listening to both 'input'
  // and 'change' raced and clobbered each other; date pickers only need change.
  let peekDebounce: number | undefined;
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.id !== "when-date") return;
    const v = (t as HTMLInputElement).value;
    window.clearTimeout(peekDebounce);
    peekDebounce = window.setTimeout(() => runPeek(v), 200);
  });

  // ─── Submit + result ───────────────────────────────────────────────────────

  function buildTripText(): string {
    // The profile now goes into the system prompt directly; the trip text
    // stays focused on the trip itself.
    const a = answers.activity?.label ?? "An outdoor trip";
    const loc = answers.location ?? "Swiss Alps";
    const dateText = answers.date ? `on ${answers.date}` : "soon";
    const dur = answers.duration?.label ?? "a few days";
    return `${a} near ${loc} ${dateText}, lasting ${dur.toLowerCase()}.`;
  }

  async function runPlanner() {
    // Build a personalized headline from the user's answers, so they feel heard.
    const activity = answers.activity?.label.toLowerCase() ?? "your trip";
    const loc = answers.location ?? "your spot";
    const when = answers.date ? friendlyDate(answers.date) : "soon";
    const dur = answers.duration?.label.toLowerCase() ?? "a few days";

    root.innerHTML = `
      <main class="screen-plan wizard">
        <div class="wizard__loading">
          <h1 class="wizard__q">Curating gear for your ${escapeHTML(activity)} in <strong>${escapeHTML(loc)}</strong>.</h1>
          <p class="wizard__loading-sub">${escapeHTML(when)} · ${escapeHTML(dur)}</p>
          <p class="wizard__progress-msg" id="progress">Pulling the forecast…</p>
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
        experience: cur.experience,
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
      const deck = result.picks
        .map(({ code, why }) => {
          const p = getProduct(code);
          return p ? { p, why } : null;
        })
        .filter((x): x is { p: Product; why: string } => Boolean(x));
      progressEl.remove();
      renderResult(result, deck, resultEl);
    } catch (err) {
      console.warn("planTrip failed:", err);
      progressEl.textContent = "";
      resultEl.innerHTML = `<div class="status">Something didn't go through. Try again in a moment.</div>`;
    }
  }

  function renderResult(
    _result: PlanResult,
    deck: Array<{ p: Product; why: string }>,
    target: HTMLElement,
  ) {
    if (deck.length === 0) {
      target.innerHTML = `<div class="status">I couldn't find a good match. Try a different place or season.</div>`;
      return;
    }
    mountSwipeDeck(target, deck, { summary: _result.reasoning ?? "" });
  }

  render();
}

// ─── Swipe deck (unchanged) ──────────────────────────────────────────────────

type Decision = "add" | "skip";
type DeckEntry = { p: Product; why: string };
type DeckOptions = { summary: string };

const SWIPE_THRESHOLD_PX = 110;

function mountSwipeDeck(
  host: HTMLElement,
  deck: DeckEntry[],
  opts: DeckOptions,
): void {
  const history: Decision[] = [];
  let cursor = 0;

  host.innerHTML = `
    <div class="deck-frame">
      ${opts.summary
        ? `<p class="ai-banner__reason" style="text-align:center;max-width:340px">${escapeHTML(opts.summary)}</p>`
        : ""}
      <div class="deck-progress" id="deck-progress"></div>
      <div class="deck-stage" id="deck-stage"></div>
      <button class="deck-undo-link" id="deck-undo" disabled
              title="Undo last" aria-label="Undo last">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
        </svg>
        Undo
      </button>
    </div>
  `;

  const stage = host.querySelector("#deck-stage") as HTMLDivElement;
  const progress = host.querySelector("#deck-progress") as HTMLDivElement;
  const undoBtn = host.querySelector("#deck-undo") as HTMLButtonElement;

  function render(isFreshSwipe = false) {
    if (cursor >= deck.length) { renderSummary(); return; }
    progress.textContent = `${cursor + 1} of ${deck.length}`;
    progress.style.visibility = "visible";
    stage.innerHTML = renderCard(deck[cursor], 0, cursor);
    undoBtn.disabled = history.length === 0;
    undoBtn.style.visibility = "visible";
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

  function renderSummary() {
    const added = history.filter((d) => d === "add").length;
    progress.style.visibility = "hidden";
    undoBtn.style.visibility = "hidden";
    stage.style.minHeight = "auto";
    stage.innerHTML = `
      <div class="deck-summary">
        <div class="deck-summary__count">${added}</div>
        <h2 class="deck-summary__title">${added === 0 ? "No new picks this time." : added === 1 ? "One on your list." : `${added} on your list.`}</h2>
        <p class="deck-summary__sub">${
          added === 0
            ? "Want to try a different trip, or build a list manually?"
            : "Ready to find them in the store?"
        }</p>
        ${
          added > 0
            ? `<a class="primary" href="?screen=map" style="min-width:220px">Show me where they are</a>`
            : `<a class="primary" href="?screen=list" style="min-width:220px">Build a list myself</a>`
        }
        <button class="link-btn" id="deck-restart">Plan a different trip</button>
      </div>
    `;
    const restart = stage.querySelector("#deck-restart") as HTMLButtonElement;
    restart.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", "plan");
      window.location.href = url.toString();
    });
  }

  function renderCard(entry: DeckEntry, depth: number, index: number): string {
    const { p, why } = entry;
    const priceBlock = p.discount_pct > 0
      ? `<span class="deck-card__price--was">CHF ${p.price_chf.toFixed(0)}</span> CHF ${(p.price_chf * (1 - p.discount_pct / 100)).toFixed(0)}`
      : `CHF ${p.price_chf.toFixed(0)}`;
    return `
      <article class="deck-card" data-card-index="${index}" tabindex="${depth === 0 ? "0" : "-1"}">
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
        ${depth === 0 ? `
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
        ` : ""}
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
    const entry = deck[cursor];
    if (decision === "add") addToList(entry.p.product_code);
    if ("vibrate" in navigator) navigator.vibrate(decision === "add" ? [10, 30, 12] : 18);
    history.push(decision);
    cursor++;
    window.setTimeout(() => render(true), 320);
  }

  function undo() {
    if (history.length === 0) return;
    const last = history.pop()!;
    cursor--;
    if (last === "add") removeFromList(deck[cursor].p.product_code);
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
        if (dx > 0) tint.style.background = "linear-gradient(180deg, rgba(44,122,85,0), rgba(44,122,85,0.18))";
        else tint.style.background = "linear-gradient(180deg, rgba(185,28,28,0), rgba(185,28,28,0.14))";
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
    if (cursor >= deck.length) return;
    if (action === "add") commit("add", "right");
    else commit("skip", "left");
  });

  undoBtn.addEventListener("click", undo);

  function onKey(e: KeyboardEvent) {
    if (!host.isConnected) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (cursor >= deck.length) return;
    if (e.key === "ArrowRight") { e.preventDefault(); commit("add", "right"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); commit("skip", "left"); }
    else if ((e.key === "Backspace" || e.key === "z") && history.length > 0) { e.preventDefault(); undo(); }
  }
  document.addEventListener("keydown", onKey);

  render();
}
