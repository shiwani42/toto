import { loadSession } from "../lib/session";
import { getList } from "../lib/list";
import { icon } from "../lib/icons";
import { totoMascot } from "../lib/toto";
import { t } from "../lib/i18n";
import { getInsights } from "../lib/history";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


export function renderHome(root: HTMLElement) {
  const activeSession = loadSession();
  const existingList = getList();
  const hasList = existingList.length > 0;
  const insights = getInsights();
  const isReturning = insights.tripCount > 0;
  const lastCategory = insights.topCategories[0]?.category;

  // First-run is just the home screen itself — the giant Toto mascot,
  // three choice cards, and the in-a-rush chip are the welcome. A
  // separate intro page added nothing the home page didn't already say.

  root.innerHTML = `
    <main class="screen-home">
      ${activeSession ? `
        <a class="home-banner" href="?screen=connected">
          <span>${escapeHTML(activeSession.me.emoji)} ${t("home.banner.with")} ${escapeHTML(activeSession.me.name)}</span>
          <span class="home-banner__open">${t("home.banner.open")} ›</span>
        </a>
      ` : ""}

      <section class="home-greeting">
        <button type="button" class="toto-hero" id="toto-hero" aria-label="Hi from Toto">${totoMascot(180)}</button>
        <h1 class="home-greeting__hi">${isReturning ? t("home.back") : t("home.hi")}</h1>
        <p class="home-greeting__sub">${
          isReturning && lastCategory
            ? t("home.back.last").replace("{category}", escapeHTML(lastCategory))
            : t("home.sub")
        }</p>
      </section>

      <ul class="home-choices">
        <li>
          <a class="home-choice" href="?screen=${hasList ? "list" : "list"}">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("list", 24)}</span>
              ${hasList ? `<span class="home-choice__badge">${t("home.badge.in_progress")}</span>` : ""}
            </div>
            <h2 class="home-choice__title">${hasList ? t("home.choice.resume") : t("home.choice.list")}</h2>
            <p class="home-choice__sub">${hasList ? `${existingList.length} ${existingList.length === 1 ? "item" : "items"}.` : t("home.choice.list.sub")}</p>
          </a>
        </li>

        <li>
          <a class="home-choice" href="?screen=plan">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("compass", 24)}</span>
            </div>
            <h2 class="home-choice__title">${t("home.choice.plan")}</h2>
            <p class="home-choice__sub">${t("home.choice.plan.sub")}</p>
          </a>
        </li>

        <li>
          <a class="home-choice" href="?screen=browse">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("eye", 24)}</span>
            </div>
            <h2 class="home-choice__title">${t("home.choice.browse")}</h2>
            <p class="home-choice__sub">${t("home.choice.browse.sub")}</p>
          </a>
        </li>
      </ul>

      <a class="home-quick" href="?screen=browse">
        ${icon("zap", 16)}
        <span class="home-quick__main">${t("home.quick")}</span>
        <span class="home-quick__sub">${t("home.quick.sub")}</span>
      </a>
    </main>
  `;

  // Tap Toto → re-trigger the greeting wiggle + a faster tail wag burst.
  const hero = root.querySelector("#toto-hero");
  hero?.addEventListener("click", () => {
    hero.classList.remove("toto-hero--wave");
    void (hero as HTMLElement).offsetWidth; // restart the animation
    hero.classList.add("toto-hero--wave");
    if ("vibrate" in navigator) navigator.vibrate(12);
  });
}
