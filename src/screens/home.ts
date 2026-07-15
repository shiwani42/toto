import { loadSession } from "../lib/session";
import { getList } from "../lib/list";
import { icon } from "../lib/icons";
import { totoMascot } from "../lib/toto";
import { t } from "../lib/i18n";
import { getInsights } from "../lib/history";
import {
  getActiveShop,
  setActiveShop,
  fetchShopBySlug,
} from "../lib/shops";
import { primeCatalog, resetCatalog } from "../lib/catalog";
import { supabaseConfigured } from "../lib/supabase";
import { mountInstallHint } from "../lib/pwa-install";

// "In a rush" was a dashed quick chip below the three choice cards. It
// pointed at /browse — the same destination as "I'm just looking" — so
// it doubled the same affordance with a clashing visual treatment. The
// three cards already cover every entry path.

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
  const activeShop = getActiveShop();
  const showFindShop = hasList && !activeShop;
  const showEnterShop = !activeShop && supabaseConfigured;

  root.innerHTML = `
    <main class="screen-home">
      ${activeSession ? `
        <a class="home-banner" href="?screen=connected">
          <span>${escapeHTML(activeSession.me.emoji)} ${t("home.banner.with")} ${escapeHTML(activeSession.me.name)}</span>
          <span class="home-banner__open">${t("home.banner.open")}</span>
        </a>
      ` : ""}

      ${activeShop ? `
        <div class="home-shop-banner" role="status">
          <div class="home-shop-banner__text">
            <span class="home-shop-banner__label">${escapeHTML(t("home.shop.at"))}</span>
            <strong class="home-shop-banner__name">${escapeHTML(activeShop.name)}</strong>
          </div>
          <button type="button" class="home-shop-banner__leave" id="leave-shop">${escapeHTML(t("home.shop.leave"))}</button>
        </div>
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
          <a class="home-choice" href="?screen=list">
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

        ${showFindShop ? `
        <li>
          <a class="home-choice home-choice--find-shop" href="?screen=nearby">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("store", 24)}</span>
            </div>
            <h2 class="home-choice__title">${t("home.choice.nearby")}</h2>
            <p class="home-choice__sub">${t("home.choice.nearby.sub").replace("{n}", String(existingList.length))}</p>
          </a>
        </li>
        ` : ""}

        ${showEnterShop ? `
        <li>
          <div class="home-choice home-choice--enter-shop">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("store", 24)}</span>
            </div>
            <h2 class="home-choice__title">${escapeHTML(t("home.shop.enter"))}</h2>
            <p class="home-choice__sub">${escapeHTML(t("home.shop.enter.sub"))}</p>
            <form class="home-shop-enter" id="enter-shop-form" novalidate>
              <input id="enter-shop-slug" type="text" required autocomplete="off"
                     spellcheck="false" inputmode="text"
                     placeholder="${escapeHTML(t("home.shop.slug.placeholder"))}"
                     class="home-shop-enter__input" aria-label="${escapeHTML(t("home.shop.slug.placeholder"))}" />
              <button type="submit" class="home-shop-enter__btn">${escapeHTML(t("home.shop.enter.btn"))}</button>
            </form>
            <p id="enter-shop-status" class="home-shop-enter__status" role="status" aria-live="polite"></p>
            <a class="home-shop-browse" href="?screen=shops">${escapeHTML(t("home.shop.browse"))}</a>
          </div>
        </li>
        ` : ""}
      </ul>

      <div id="pwa-install-slot"></div>
    </main>
  `;

  const installSlot = root.querySelector("#pwa-install-slot") as HTMLElement | null;
  if (installSlot) mountInstallHint(installSlot);

  // Tap Toto → re-trigger the greeting wiggle + a faster tail wag burst.
  const hero = root.querySelector("#toto-hero");
  hero?.addEventListener("click", () => {
    hero.classList.remove("toto-hero--wave");
    void (hero as HTMLElement).offsetWidth; // restart the animation
    hero.classList.add("toto-hero--wave");
    if ("vibrate" in navigator) navigator.vibrate(12);
  });

  const leaveBtn = root.querySelector("#leave-shop");
  leaveBtn?.addEventListener("click", () => {
    setActiveShop(null);
    resetCatalog();
    const url = new URL(window.location.href);
    url.searchParams.delete("shop");
    url.searchParams.set("screen", "home");
    window.location.href = url.toString();
  });

  const enterForm = root.querySelector("#enter-shop-form") as HTMLFormElement | null;
  const slugInput = root.querySelector("#enter-shop-slug") as HTMLInputElement | null;
  const statusEl = root.querySelector("#enter-shop-status") as HTMLElement | null;
  enterForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = (slugInput?.value ?? "").trim().toLowerCase();
    if (!raw) {
      if (statusEl) statusEl.textContent = t("home.shop.slug.placeholder");
      return;
    }
    if (statusEl) statusEl.textContent = t("home.shop.loading");
    try {
      const shop = await fetchShopBySlug(raw);
      if (!shop) {
        if (statusEl) statusEl.textContent = t("home.shop.notfound");
        return;
      }
      setActiveShop(shop);
      await primeCatalog(shop.id);
      const url = new URL(window.location.href);
      url.searchParams.set("shop", shop.slug);
      url.searchParams.set("screen", "home");
      window.location.href = url.toString();
    } catch {
      if (statusEl) statusEl.textContent = t("home.shop.notfound");
    }
  });
}
