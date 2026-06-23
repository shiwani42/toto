import "./style.css";
import type { Screen } from "./lib/types";
import { applyPrefs } from "./lib/prefs";
import { icon } from "./lib/icons";
import { mountCompanion } from "./lib/companion";
import { renderBrowse } from "./screens/browse";
import { renderCompare } from "./screens/compare";
import { renderConnect } from "./screens/connect";
import { renderConnected } from "./screens/connected";
import { renderDone } from "./screens/done";
import { renderHome } from "./screens/home";
import { renderListBuilder } from "./screens/list-builder";
import { renderMap } from "./screens/map";
import { renderPlan } from "./screens/plan";
import { renderRepair } from "./screens/repair";
import { renderScan } from "./screens/scan";
import { renderSettings } from "./screens/settings";
import { renderSmoke } from "./screens/smoke";
import { renderAdmin } from "./screens/admin";
import { loadSession, initGlobalSession } from "./lib/session";
import { initProfileSync } from "./lib/profile";
import { initAnalytics } from "./lib/analytics";
import { LANGUAGES, getLang, setLang, type Language } from "./lib/i18n";
import { setPrefs } from "./lib/prefs";
const VALID_SCREENS: Screen[] = [
  "home",
  "list",
  "map",
  "scan",
  "done",
  "smoke",
  "plan",
  "browse",
  "compare",
  "repair",
  "connect",
  "connected",
  "settings",
  "fit",
  "admin",
];

function currentScreen(): Screen {
  const requested = new URLSearchParams(location.search).get("screen");
  if (requested && (VALID_SCREENS as string[]).includes(requested)) {
    return requested as Screen;
  }
  return "home";
}

// ─── Bottom Tab Bar ──────────────────────────────────────────────────────────

function mountTabBar() {
  // Don't double-mount
  if (document.getElementById("tab-bar")) return;

  const screen = currentScreen();
  document.body.classList.remove("no-tab-bar");

  const session = loadSession();
  const connectHref = session ? "?screen=connected" : "?screen=connect";
  const browseHref = "?screen=browse";

  function isActive(screens: Screen[]): boolean {
    return screens.includes(screen);
  }

  function tabClass(screens: Screen[], extra = ""): string {
    const active = isActive(screens) ? " tab-btn--active" : "";
    return `tab-btn${active}${extra ? " " + extra : ""}`;
  }

  const bar = document.createElement("nav");
  bar.id = "tab-bar";
  bar.className = "tab-bar";
  bar.setAttribute("aria-label", "Main navigation");
  bar.innerHTML = `
    <div class="tab-bar__inner">
      <a id="tab-home" href="?screen=home"
         class="${tabClass(["home"])}"
         aria-label="Home">
        <span class="tab-btn__icon">${icon("home", 22)}</span>
        <span class="tab-btn__label">Home</span>
      </a>

      <a id="tab-find" href="?screen=list"
         class="${tabClass(["list", "done", "map"])}"
         aria-label="My list">
        <span class="tab-btn__icon">${icon("list", 22)}</span>
        <span class="tab-btn__label">List</span>
      </a>

      <a id="tab-scan" href="${browseHref}"
         class="${tabClass(["scan", "browse", "smoke"])}"
         aria-label="Open camera">
        <span class="tab-btn__icon">${icon("camera", 22)}</span>
        <span class="tab-btn__label">Scan</span>
      </a>

      <a id="tab-connect" href="${connectHref}"
         class="${tabClass(["connect", "connected"])}"
         aria-label="Shop with someone">
        <span class="tab-btn__icon">${icon("users", 22)}</span>
        <span class="tab-btn__label">Together</span>
      </a>

      <a id="tab-settings" href="?screen=settings"
         class="${tabClass(["settings", "fit"])}"
         aria-label="Settings">
        <span class="tab-btn__icon">${icon("user", 22)}</span>
        <span class="tab-btn__label">You</span>
      </a>
    </div>
  `;

  document.body.appendChild(bar);
}

// ─── Global language picker (visible on every screen) ───────────────────────

function mountLangPicker() {
  if (document.getElementById("lang-picker")) return;
  const current = getLang();
  const currentLabel = LANGUAGES.find((l) => l.code === current)?.code.toUpperCase() ?? "EN";

  const root = document.createElement("div");
  root.id = "lang-picker";
  root.className = "lang-fab";
  root.innerHTML = `
    <button type="button" class="lang-fab__btn" id="lang-fab-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Language">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span class="lang-fab__label">${currentLabel}</span>
    </button>
    <ul class="lang-fab__menu" id="lang-fab-menu" role="listbox" hidden>
      ${LANGUAGES.map((l) => `
        <li>
          <button type="button" role="option" data-lang="${l.code}"
                  class="lang-fab__opt ${current === l.code ? "lang-fab__opt--active" : ""}"
                  aria-selected="${current === l.code}">
            <span class="lang-fab__opt-native">${l.native}</span>
            <span class="lang-fab__opt-en">${l.label}</span>
          </button>
        </li>
      `).join("")}
    </ul>
  `;
  document.body.appendChild(root);

  const btn = root.querySelector("#lang-fab-btn") as HTMLButtonElement;
  const menu = root.querySelector("#lang-fab-menu") as HTMLUListElement;
  function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  function open()  { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) open(); else close();
  });
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) close();
  });
  menu.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
    b.addEventListener("click", () => {
      const lang = b.dataset.lang as Language;
      setLang(lang);
      setPrefs({ language: lang });
      window.location.reload();
    });
  });
}

// ─── Screen router ───────────────────────────────────────────────────────────

function mount() {
  const root = document.getElementById("app");
  if (!root) throw new Error("#app not found");
  const screen = currentScreen();
  // Reset the cart-bar layout class; the list-builder re-applies it
  // when it mounts and the list has items.
  document.body.classList.remove("has-cart");
  // Subtle screen-in fade: stamp a one-shot class on #app so the new
  // content rises in over ~200ms. Hard cuts read like a 90s site;
  // a tiny ease makes the app feel native.
  root.classList.remove("app-enter");
  void root.offsetWidth;
  root.classList.add("app-enter");
  switch (screen) {
    case "home":
      renderHome(root);
      break;
    case "list":
      renderListBuilder(root);
      break;
    case "smoke":
      renderSmoke(root);
      break;
    case "map":
      renderMap(root);
      break;
    case "scan":
      renderScan(root);
      break;
    case "done":
      renderDone(root);
      break;
    case "plan":
      renderPlan(root);
      break;
    case "browse":
      renderBrowse(root);
      break;
    case "compare":
      renderCompare(root);
      break;
    case "repair":
      renderRepair(root);
      break;
    case "connect":
      renderConnect(root);
      break;
    case "connected":
      renderConnected(root);
      break;
    case "settings":
      renderSettings(root);
      break;
    case "fit":
      // dynamically import so the camera/Vision code doesn't load up front
      import("./screens/fit").then(({ renderFit }) => renderFit(root));
      break;
    case "admin":
      renderAdmin(root);
      break;
  }

  // Mount tab bar AFTER screen render so session state is up-to-date
  mountTabBar();
  mountLangPicker();
  mountCompanion(currentScreen());
}

applyPrefs();
initGlobalSession();
initProfileSync();
initAnalytics();
mount();
