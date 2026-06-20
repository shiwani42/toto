import { loadSession } from "../lib/session";
import { getList } from "../lib/list";
import { icon } from "../lib/icons";
import { totoMascot } from "../lib/toto";

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

  root.innerHTML = `
    <main class="screen-home">
      ${activeSession ? `
        <a class="home-banner" href="?screen=connected">
          <span>${escapeHTML(activeSession.me.emoji)} Shopping with ${escapeHTML(activeSession.me.name)}</span>
          <span class="home-banner__open">Open ›</span>
        </a>
      ` : ""}

      <section class="home-greeting">
        <button type="button" class="toto-hero" id="toto-hero" aria-label="Hi from Toto">${totoMascot(180)}</button>
        <h1 class="home-greeting__hi">Hi, I'm Toto.</h1>
        <p class="home-greeting__sub">What brings you in today?</p>
      </section>

      <ul class="home-choices">
        ${hasList ? `
          <li>
            <a class="home-choice home-choice--resume" href="?screen=list">
              <div class="home-choice__head">
                <span class="home-choice__icon">${icon("list", 24)}</span>
                <span class="home-choice__badge">in progress</span>
              </div>
              <h2 class="home-choice__title">Pick up where you left off</h2>
              <p class="home-choice__sub">${existingList.length} thing${existingList.length > 1 ? "s" : ""} on your list.</p>
            </a>
          </li>
        ` : `
          <li>
            <a class="home-choice" href="?screen=list">
              <div class="home-choice__head">
                <span class="home-choice__icon">${icon("list", 24)}</span>
              </div>
              <h2 class="home-choice__title">I have a list</h2>
              <p class="home-choice__sub">Search by name, size, or brand.</p>
            </a>
          </li>
        `}

        <li>
          <a class="home-choice" href="?screen=plan">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("compass", 24)}</span>
            </div>
            <h2 class="home-choice__title">Help me plan it</h2>
            <p class="home-choice__sub">Tell me where, I'll suggest gear.</p>
          </a>
        </li>

        <li>
          <a class="home-choice" href="?screen=browse">
            <div class="home-choice__head">
              <span class="home-choice__icon">${icon("eye", 24)}</span>
            </div>
            <h2 class="home-choice__title">I'm just looking</h2>
            <p class="home-choice__sub">Point the camera, I'll explain.</p>
          </a>
        </li>
      </ul>

      <details class="home-more">
        <summary>More tools</summary>
        <div class="home-more__grid">
          <a class="home-more__chip" href="?screen=compare">
            ${icon("scale", 16)} Compare two
          </a>
          <a class="home-more__chip" href="?screen=repair">
            ${icon("wrench", 16)} Repair check
          </a>
          <a class="home-more__chip" href="?screen=fit">
            ${icon("ruler", 16)} Fit check
          </a>
          <a class="home-more__chip" href="?screen=connect">
            ${icon("users", 16)} Shop together
          </a>
          <a class="home-more__chip" href="?screen=settings">
            ${icon("settings", 16)} Settings
          </a>
        </div>
      </details>
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
