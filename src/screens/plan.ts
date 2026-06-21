import { getProduct } from "../lib/catalog";
import { addToList, removeFromList, getList } from "../lib/list";
import { planTrip, type PlanResult, type PlanPick } from "../integrations/ai-planner";
import {
  searchLocations,
  forecast,
  type ForecastSummary,
  type Geocode,
} from "../integrations/weather";
import { getPrefs } from "../lib/prefs";
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
  purpose: Purpose;
  activity: Activity | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  extra: string;
};

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
    purpose: "trip", // arrival here implies planning a trip
    activity: null,
    location: null,
    startDate: null,
    endDate: null,
    extra: "",
  };

  track("wizard_start", { initial_steps: 1 });

  function render() {
    const today = todayIso();
    root.innerHTML = `
      <main class="screen-plan plan-one">
        <header class="plan-one__head">
          <a class="wizard__back" href="?screen=home" aria-label="Home">‹</a>
          <h1>Plan a trip</h1>
          <p class="tag">Tell me what you can. Skip anything you don't know.</p>
        </header>

        <section class="plan-one__field">
          <label class="plan-one__label">What kind of trip</label>
          <div class="plan-one__chips" id="activity-chips">
            ${ACTIVITY_OPTIONS.map((o) => `<button class="plan-one__chip" type="button" data-activity="${o.key}">${escapeHTML(o.label)}</button>`).join("")}
          </div>
        </section>

        <section class="plan-one__field">
          <label class="plan-one__label" for="loc-input">Where to</label>
          <div class="loc-search">
            <input id="loc-input" type="search" autocomplete="off" placeholder="Any place, anywhere…" />
            <ul id="loc-results" class="loc-results"></ul>
          </div>
          <p class="plan-one__chosen" id="loc-chosen"></p>
        </section>

        <section class="plan-one__field">
          <label class="plan-one__label">When</label>
          <div class="wizard__date-grid">
            <label class="wizard__date-label">
              <span>Start</span>
              <input id="start-date" type="date" min="${today}" />
            </label>
            <label class="wizard__date-label">
              <span>End <small class="muted">(optional)</small></span>
              <input id="end-date" type="date" min="${today}" />
            </label>
          </div>
          <p class="wizard__peek" id="peek"></p>
        </section>

        <section class="plan-one__field">
          <label class="plan-one__label" for="extra">Anything else</label>
          <textarea id="extra" rows="2" placeholder="In your own words. E.g. 'first time skiing', 'wife and two kids', 'I run hot'…"></textarea>
        </section>

        <button class="primary plan-one__go" id="plan-go">Show me what to bring</button>

        <a class="link-btn plan-one__alt" href="?screen=browse">Or just browse the store ›</a>
      </main>
    `;

    mountLocation();
    wireActivityChips();
    wireDates();
    wireExtra();
    wireSubmit();
  }

  function wireActivityChips() {
    const host = root.querySelector("#activity-chips") as HTMLDivElement;
    host.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-activity]");
      if (!btn) return;
      const key = btn.dataset.activity!;
      const found = ACTIVITY_OPTIONS.find((o) => o.key === key);
      if (!found) return;
      answers.activity = found;
      host.querySelectorAll<HTMLButtonElement>("[data-activity]").forEach((b) => {
        b.classList.toggle("plan-one__chip--on", b === btn);
      });
    });
  }

  function wireDates() {
    const startEl = root.querySelector("#start-date") as HTMLInputElement;
    const endEl = root.querySelector("#end-date") as HTMLInputElement;
    function readDates() {
      const s = startEl.value;
      const e = endEl.value;
      answers.startDate = s || null;
      answers.endDate = e && (!s || e >= s) ? e : null;
      if (answers.startDate) runPeek(answers.startDate);
    }
    startEl.addEventListener("change", readDates);
    endEl.addEventListener("change", readDates);
  }

  function wireExtra() {
    const el = root.querySelector("#extra") as HTMLTextAreaElement;
    el.addEventListener("input", () => { answers.extra = el.value.trim(); });
  }

  function wireSubmit() {
    const btn = root.querySelector("#plan-go") as HTMLButtonElement;
    btn.addEventListener("click", () => {
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
        has_extra: answers.extra.length > 0,
      });
      runPlanner();
    });
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
        // Show what was picked, hide the dropdown, also fire weather peek
        // if a start date is set.
        const chosen = root.querySelector("#loc-chosen") as HTMLParagraphElement | null;
        if (chosen) chosen.textContent = `✓ ${r.name}${r.country ? `, ${r.country}` : ""}`;
        input.value = "";
        list.innerHTML = "";
        if (answers.startDate) runPeek(answers.startDate);
      } catch {
        return;
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
    const a = answers.activity?.label ?? "An outdoor trip";
    const loc = answers.location ?? "Swiss Alps";
    const dateText = answers.startDate ? `starting ${answers.startDate}` : "soon";
    const dur = answers.endDate
      ? `for ${daysBetween(answers.startDate ?? answers.endDate, answers.endDate)} days`
      : answers.startDate ? `for a day trip` : "duration unspecified";
    const base = `${a} near ${loc} ${dateText}, ${dur}.`;
    return answers.extra ? `${base} Note from the shopper: ${answers.extra}` : base;
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
