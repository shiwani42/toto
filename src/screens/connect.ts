import {
  supabaseConfigured,
  saveSession,
  loadSession,
  newCode,
  randomEmoji,
  randomId,
  type Mode,
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

// A small list of friendly host names. If the user doesn't type one, we
// pick from these so the session immediately has personality.
const FRIENDLY_NAMES = ["Alpine", "Trail", "Summit", "River", "Pine", "Fox", "Wren", "Wolf", "Cedar", "Stone"];
function defaultName(): string {
  const a = FRIENDLY_NAMES[Math.floor(Math.random() * FRIENDLY_NAMES.length)];
  const b = Math.floor(Math.random() * 90 + 10);
  return `${a} ${b}`;
}

export function renderConnect(root: HTMLElement) {
  const existing = loadSession();
  const initialCode = new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";

  // Two simple choices. Tap one and the form for it slides in inline.
  // Default mode is "family" — most realistic case for in-store shopping.
  // The partner / at-home mode is reachable via a quiet toggle once you tap Start.
  root.innerHTML = `
    <header>
      <h1>${t("connect.title")}</h1>
    </header>
    <main class="screen-connect connect-v2">
      ${!supabaseConfigured ? `
        <div class="connect-v2__notice">${escapeHTML("Live sessions aren't available here yet.")}</div>
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
        <button type="button" class="connect-v2__choice" id="choice-start">
          <span class="connect-v2__choice-icon">${icon("users", 28)}</span>
          <span class="connect-v2__choice-title">${t("connect.start")}</span>
        </button>
        <button type="button" class="connect-v2__choice" id="choice-join">
          <span class="connect-v2__choice-icon">${icon("compass", 28)}</span>
          <span class="connect-v2__choice-title">${t("connect.join")}</span>
        </button>
      </div>

      <div class="connect-v2__panel" id="start-panel" hidden>
        <input id="create-name" class="connect-v2__input" type="text" placeholder="${escapeHTML(t("connect.your_name"))}" />
        <div class="connect-v2__mode" id="mode-toggle">
          <button type="button" class="connect-v2__mode-btn connect-v2__mode-btn--on" data-mode="family">
            <span class="connect-v2__mode-icon">${icon("store", 18)}</span>
            ${t("connect.mode.family")}
          </button>
          <button type="button" class="connect-v2__mode-btn" data-mode="partner">
            <span class="connect-v2__mode-icon">${icon("home", 18)}</span>
            ${t("connect.mode.partner")}
          </button>
        </div>
        <button id="create-btn" class="primary connect-v2__go">${t("connect.start")}</button>
      </div>

      <div class="connect-v2__panel" id="join-panel" hidden>
        <input id="join-code" class="connect-v2__input connect-v2__input--code" type="text"
               placeholder="FAM-A4T7" autocapitalize="characters" maxlength="8"
               value="${escapeHTML(initialCode)}" />
        <button id="join-btn" class="primary connect-v2__go">${t("connect.join.btn")}</button>
      </div>

      <div id="empty-preview" class="empty-preview" aria-hidden="true">
        <div class="empty-preview__label">${escapeHTML(t("preview.label"))}</div>
        <div class="empty-preview__chat">
          <div class="empty-preview__chat-head">
            <span class="empty-preview__chat-code">FAM-A4T7</span>
            <span class="empty-preview__chat-people">
              <span class="empty-preview__avatar empty-preview__avatar--a">🐻</span>
              <span class="empty-preview__avatar empty-preview__avatar--b">🦊</span>
            </span>
          </div>
          <div class="empty-preview__chat-row">
            <span class="empty-preview__chat-name">Alpine 14</span>
            <span class="empty-preview__chat-msg">${escapeHTML(t("connect.preview_msg1"))}</span>
          </div>
          <div class="empty-preview__chat-row empty-preview__chat-row--right">
            <span class="empty-preview__chat-msg">${escapeHTML(t("connect.preview_msg2"))}</span>
            <span class="empty-preview__chat-name">Trail 28</span>
          </div>
        </div>
        <div class="empty-preview__hint">${escapeHTML(t("connect.preview_hint"))}</div>
      </div>

      <a class="link-btn connect-v2__back" href="?screen=list">${t("connect.back")}</a>
    </main>
  `;

  const startPanel = root.querySelector("#start-panel") as HTMLDivElement;
  const joinPanel = root.querySelector("#join-panel") as HTMLDivElement;
  const choiceStart = root.querySelector("#choice-start") as HTMLButtonElement;
  const choiceJoin = root.querySelector("#choice-join") as HTMLButtonElement;
  const createBtn = root.querySelector("#create-btn") as HTMLButtonElement;
  const joinBtn = root.querySelector("#join-btn") as HTMLButtonElement;

  function openPanel(which: "start" | "join") {
    startPanel.hidden = which !== "start";
    joinPanel.hidden = which !== "join";
    choiceStart.classList.toggle("connect-v2__choice--on", which === "start");
    choiceJoin.classList.toggle("connect-v2__choice--on", which === "join");
    const input = (which === "start" ? root.querySelector("#create-name") : root.querySelector("#join-code")) as HTMLInputElement | null;
    input?.focus();
    const previewEl = root.querySelector("#empty-preview") as HTMLDivElement | null;
    if (previewEl) previewEl.hidden = true;
  }
  choiceStart.addEventListener("click", () => openPanel("start"));
  choiceJoin.addEventListener("click", () => openPanel("join"));

  // Mode toggle inside the start panel.
  const modeToggle = root.querySelector("#mode-toggle") as HTMLDivElement;
  modeToggle.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]");
    if (!btn) return;
    modeToggle.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
      b.classList.toggle("connect-v2__mode-btn--on", b === btn);
    });
  });

  createBtn.addEventListener("click", () => {
    if (!supabaseConfigured) { alert("Live sessions aren't available here yet."); return; }
    const nameRaw = (root.querySelector("#create-name") as HTMLInputElement).value.trim();
    const name = nameRaw || defaultName();
    const activeMode = modeToggle.querySelector(".connect-v2__mode-btn--on") as HTMLButtonElement | null;
    const mode: Mode = (activeMode?.dataset.mode as Mode) ?? "family";
    const code = newCode(mode === "family" ? "FAM" : "PAR");
    saveSession({ code, mode, me: { id: randomId(), name, emoji: randomEmoji() } });
    location.href = "?screen=connected";
  });

  joinBtn.addEventListener("click", () => {
    if (!supabaseConfigured) { alert("Live sessions aren't available here yet."); return; }
    const code = (root.querySelector("#join-code") as HTMLInputElement).value.trim().toUpperCase();
    if (!/^(FAM|PAR)-[A-Z0-9]{4}$/.test(code)) {
      alert(t("connected.invalid_code"));
      return;
    }
    const mode: Mode = code.startsWith("PAR") ? "partner" : "family";
    saveSession({ code, mode, me: { id: randomId(), name: defaultName(), emoji: randomEmoji() } });
    location.href = "?screen=connected";
  });

  // If a deep-link arrived with ?code=... we auto-open the join panel.
  if (initialCode) openPanel("join");
}
