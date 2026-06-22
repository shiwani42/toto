import {
  supabaseConfigured,
  saveSession,
  loadSession,
  newCode,
  randomEmoji,
  randomId,
} from "../lib/session";
import { icon } from "../lib/icons";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Friendly host names used when the user doesn't type one.
const FRIENDLY_NAMES = ["Alpine", "Trail", "Summit", "River", "Pine", "Fox", "Wren", "Wolf", "Cedar", "Stone"];
function defaultName(): string {
  const a = FRIENDLY_NAMES[Math.floor(Math.random() * FRIENDLY_NAMES.length)];
  const b = Math.floor(Math.random() * 90 + 10);
  return `${a} ${b}`;
}

type Mode = "create" | "join" | null;

export function renderConnect(root: HTMLElement) {
  const existing = loadSession();
  const initialCode = new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";

  // The two tiles stay as the discovery layer. Tapping one reveals a
  // single-input form below — no mode toggle, no duplicate labels, no
  // second-tier copy. Default mode for "create" is "family"; partner
  // sessions are reachable by joining a partner code.
  let mode: Mode = initialCode ? "join" : null;

  function render() {
    root.innerHTML = `
      <header>
        <h1>${t("connect.title")}</h1>
      </header>
      <main class="screen-connect connect-v2">
        ${!supabaseConfigured ? `
          <div class="connect-v2__notice">${escapeHTML(t("connect.unavailable"))}</div>
        ` : ""}

        ${existing ? `
          <a class="connect-v2__resume" href="?screen=connected">
            <span class="connect-v2__resume-icon">${escapeHTML(existing.me.emoji)}</span>
            <span class="connect-v2__resume-body">
              <span class="connect-v2__resume-title">${escapeHTML(existing.me.name)}</span>
              <span class="connect-v2__resume-sub">${escapeHTML(existing.code)}</span>
            </span>
            <span class="connect-v2__resume-cta">${t("home.banner.open")} ›</span>
          </a>
        ` : ""}

        <div class="connect-v2__choices">
          <button type="button" class="connect-v2__choice ${mode === "create" ? "connect-v2__choice--on" : ""}" id="choice-start">
            <span class="connect-v2__choice-icon">${icon("users", 28)}</span>
            <span class="connect-v2__choice-title">${t("connect.start")}</span>
          </button>
          <button type="button" class="connect-v2__choice ${mode === "join" ? "connect-v2__choice--on" : ""}" id="choice-join">
            <span class="connect-v2__choice-icon">${icon("compass", 28)}</span>
            <span class="connect-v2__choice-title">${t("connect.join")}</span>
          </button>
        </div>

        ${mode ? `
          <form class="connect-v2__panel" id="connect-form" novalidate>
            ${mode === "create" ? `
              <input id="create-name" class="connect-v2__input" type="text"
                     placeholder="${escapeHTML(t("connect.your_name"))}" autocomplete="off" />
              <button type="submit" id="create-btn" class="primary connect-v2__go">${t("connect.start.go")}</button>
            ` : `
              <input id="join-code" class="connect-v2__input connect-v2__input--code" type="text"
                     placeholder="FAM-A4T7" autocapitalize="characters" maxlength="8"
                     value="${escapeHTML(initialCode)}" autocomplete="off" />
              <button type="submit" id="join-btn" class="primary connect-v2__go">${t("connect.join.btn")}</button>
            `}
          </form>
        ` : ""}
      </main>
    `;

    const choiceStart = root.querySelector("#choice-start") as HTMLButtonElement;
    const choiceJoin = root.querySelector("#choice-join") as HTMLButtonElement;
    choiceStart.addEventListener("click", () => { mode = "create"; render(); });
    choiceJoin.addEventListener("click", () => { mode = "join"; render(); });

    const form = root.querySelector("#connect-form") as HTMLFormElement | null;
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!supabaseConfigured) {
        alert(t("connect.unavailable"));
        return;
      }
      if (mode === "create") {
        const nameRaw = (root.querySelector("#create-name") as HTMLInputElement).value.trim();
        const name = nameRaw || defaultName();
        const code = newCode("FAM");
        saveSession({ code, mode: "family", me: { id: randomId(), name, emoji: randomEmoji() } });
        location.href = "?screen=connected";
      } else if (mode === "join") {
        const code = (root.querySelector("#join-code") as HTMLInputElement).value.trim().toUpperCase();
        if (!/^(FAM|PAR)-[A-Z0-9]{4}$/.test(code)) {
          alert(t("connected.invalid_code"));
          return;
        }
        const sessionMode = code.startsWith("PAR") ? "partner" : "family";
        saveSession({ code, mode: sessionMode, me: { id: randomId(), name: defaultName(), emoji: randomEmoji() } });
        location.href = "?screen=connected";
      }
    });

    // Autofocus the live input when a panel is open.
    const input = root.querySelector("#create-name, #join-code") as HTMLInputElement | null;
    input?.focus();
  }

  render();
}
