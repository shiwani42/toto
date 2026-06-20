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

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderConnect(root: HTMLElement) {
  const existing = loadSession();
  const joinCode =
    new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";

  root.innerHTML = `
    <header>
      <h1>Shop with someone.</h1>
    </header>
    <main class="screen-connect">
      ${!supabaseConfigured ? `
      <div class="alert-card alert-card--amber" style="margin-bottom:2px">
        <p style="font-size:13px;font-weight:600;margin:0">Live sessions aren't available here yet.</p>
      </div>
      ` : ""}
      ${
        existing
          ? `
        <div class="connect-banner">
          You're in <strong>${escapeHTML(existing.code)}</strong> as
          <strong>${escapeHTML(existing.me.emoji)} ${escapeHTML(existing.me.name)}</strong>
          (${escapeHTML(existing.mode)})
          <a class="primary" style="padding:8px 16px;font-size:13px" href="?screen=connected">Open ›</a>
          <button class="link-btn" id="leave">Leave</button>
        </div>
      `
          : ""
      }

      <section class="card-section">
        <h2>Start a session</h2>
        <div class="row-group">
          <label>Your name <input id="create-name" type="text" placeholder="e.g. Shiwani" /></label>
        </div>
        <p class="section-label">Where is everyone?</p>
        <div class="mode-cards">
          <label class="mode-card mode-card--active" id="mode-family-card">
            <input type="radio" name="mode" value="family" checked style="display:none" />
            <span class="mode-card__icon">${icon("store", 22)}</span>
            <span class="mode-card__title">All in the store</span>
            <span class="mode-card__sub">Shopping together, side by side</span>
          </label>
          <label class="mode-card" id="mode-partner-card">
            <input type="radio" name="mode" value="partner" style="display:none" />
            <span class="mode-card__icon">${icon("home", 22)}</span>
            <span class="mode-card__title">One at home</span>
            <span class="mode-card__sub">They watch the cart and vote</span>
          </label>
        </div>
        <button id="create-btn" class="primary" style="margin-top:14px">Start the session</button>
      </section>

      <section class="card-section">
        <h2>Join one</h2>
        <div class="row-group">
          <label>Code <input id="join-code" type="text" placeholder="FAM-A4T7" value="${escapeHTML(joinCode)}" autocapitalize="characters" /></label>
          <label>Your name <input id="join-name" type="text" placeholder="e.g. Alex" /></label>
        </div>
        <button id="join-btn" class="primary">Join</button>
      </section>

      <a class="link-btn" href="?screen=list">‹ Back to shopping</a>
    </main>
  `;

  const createBtn = root.querySelector("#create-btn") as HTMLButtonElement;
  const joinBtn = root.querySelector("#join-btn") as HTMLButtonElement;
  const leaveBtn = root.querySelector("#leave") as HTMLButtonElement | null;
  const modeFamilyCard = root.querySelector("#mode-family-card") as HTMLLabelElement | null;
  const modePartnerCard = root.querySelector("#mode-partner-card") as HTMLLabelElement | null;

  // Mode card visual toggle (radio inputs are hidden)
  function syncModeCards() {
    const checked = (root.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value;
    modeFamilyCard?.classList.toggle("mode-card--active", checked === "family");
    modePartnerCard?.classList.toggle("mode-card--active", checked === "partner");
  }
  modeFamilyCard?.addEventListener("click", () => { setTimeout(syncModeCards, 0); });
  modePartnerCard?.addEventListener("click", () => { setTimeout(syncModeCards, 0); });

  createBtn.addEventListener("click", () => {
    if (!supabaseConfigured) {
      alert("Live sessions aren't available here yet.");
      return;
    }
    const name =
      (root.querySelector("#create-name") as HTMLInputElement).value.trim() ||
      "Host";
    const mode =
      ((root.querySelector('input[name="mode"]:checked') as HTMLInputElement)
        ?.value as Mode) ?? "family";
    const code = newCode(mode === "family" ? "FAM" : "PAR");
    saveSession({
      code,
      mode,
      me: { id: randomId(), name, emoji: randomEmoji() },
    });
    location.href = "?screen=connected";
  });

  joinBtn.addEventListener("click", () => {
    if (!supabaseConfigured) {
      alert("Live sessions aren't available here yet.");
      return;
    }
    let code = (
      root.querySelector("#join-code") as HTMLInputElement
    ).value
      .trim()
      .toUpperCase();
    if (!/^(FAM|PAR)-[A-Z0-9]{4}$/.test(code)) {
      alert("That code doesn't look right. It should be like FAM-A4T7 or PAR-J2KP.");
      return;
    }
    const name =
      (root.querySelector("#join-name") as HTMLInputElement).value.trim() ||
      "Guest";
    const mode: Mode = code.startsWith("PAR") ? "partner" : "family";
    saveSession({
      code,
      mode,
      me: { id: randomId(), name, emoji: randomEmoji() },
    });
    location.href = "?screen=connected";
  });

  leaveBtn?.addEventListener("click", () => {
    if (!confirm("Leave this session? You can rejoin with the same code.")) return;
    sessionStorage.removeItem("toto.session");
    location.reload();
  });
}
