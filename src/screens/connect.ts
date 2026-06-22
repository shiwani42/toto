import {
  supabaseConfigured,
  saveSession,
  loadSession,
  newCode,
  randomEmoji,
  randomId,
} from "../lib/session";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// A small list of friendly host names. If the user doesn't type one, we
// pick from these so the session immediately has personality.
const FRIENDLY_NAMES = ["Alpine", "Trail", "Summit", "River", "Pine", "Fox", "Wren", "Wolf", "Cedar", "Stone"];
function defaultName(): string {
  const a = FRIENDLY_NAMES[Math.floor(Math.random() * FRIENDLY_NAMES.length)];
  const b = Math.floor(Math.random() * 90 + 10);
  return `${a} ${b}`;
}

type Mode = "create" | "join";

export function renderConnect(root: HTMLElement) {
  const existing = loadSession();
  const initialCode = new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";

  // Minimalist single-form approach. No choice tiles, no mode toggle,
  // no second-tier copy. The user lands on one input. If they have a
  // code, the toggle link below swaps the form into join mode. The
  // family/partner distinction was a power-user setting that confused
  // first-timers; we default to "family" for in-store shopping.
  let mode: Mode = initialCode ? "join" : "create";

  function render() {
    root.innerHTML = `
      <header>
        <h1>${t("connect.title")}</h1>
      </header>
      <main class="screen-connect connect-min">
        ${!supabaseConfigured ? `
          <div class="connect-min__notice">${escapeHTML(t("connect.unavailable"))}</div>
        ` : ""}

        ${existing ? `
          <a class="connect-min__resume" href="?screen=connected">
            <span class="connect-min__resume-icon">${escapeHTML(existing.me.emoji)}</span>
            <span class="connect-min__resume-body">
              <span class="connect-min__resume-title">${escapeHTML(existing.me.name)}</span>
              <span class="connect-min__resume-sub">${escapeHTML(existing.code)}</span>
            </span>
            <span class="connect-min__resume-cta">${t("home.banner.open")} ›</span>
          </a>
        ` : ""}

        <form class="connect-min__form" id="connect-form" novalidate>
          ${mode === "create" ? `
            <input id="create-name" class="connect-min__input" type="text"
                   placeholder="${escapeHTML(t("connect.your_name"))}" autocomplete="off" />
            <button type="submit" id="create-btn" class="primary connect-min__go">${t("connect.start.go")}</button>
          ` : `
            <input id="join-code" class="connect-min__input connect-min__input--code" type="text"
                   placeholder="FAM-A4T7" autocapitalize="characters" maxlength="8"
                   value="${escapeHTML(initialCode)}" autocomplete="off" />
            <button type="submit" id="join-btn" class="primary connect-min__go">${t("connect.join.btn")}</button>
          `}
        </form>

        <button type="button" id="mode-swap" class="connect-min__swap">
          ${mode === "create" ? t("connect.have_code") : t("connect.no_code")}
        </button>

        <a class="link-btn connect-min__back" href="?screen=home">${t("connect.back")}</a>
      </main>
    `;

    const swap = root.querySelector("#mode-swap") as HTMLButtonElement;
    swap.addEventListener("click", () => {
      mode = mode === "create" ? "join" : "create";
      render();
    });

    const form = root.querySelector("#connect-form") as HTMLFormElement;
    form.addEventListener("submit", (e) => {
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
      } else {
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

    // Autofocus the live input.
    const input = root.querySelector("#create-name, #join-code") as HTMLInputElement | null;
    input?.focus();
  }

  render();
}
