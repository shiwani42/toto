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
import { loadSession, initGlobalSession } from "./lib/session";
import { initProfileSync } from "./lib/profile";
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

  // The home screen is its own thing. No tab bar.
  if (screen === "home") {
    document.body.classList.add("no-tab-bar");
    return;
  }
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
         class="${tabClass([])}"
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


// ─── Screen router ───────────────────────────────────────────────────────────

function mount() {
  const root = document.getElementById("app");
  if (!root) throw new Error("#app not found");
  const screen = currentScreen();
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
  }

  // Mount tab bar AFTER screen render so session state is up-to-date
  mountTabBar();
  mountCompanion(currentScreen());
}

applyPrefs();
initGlobalSession();
initProfileSync();
mount();
