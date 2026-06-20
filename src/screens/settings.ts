import { applyPrefs, getPrefs, setPrefs, type Prefs, type Gender, type Experience } from "../lib/prefs";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const SIZE_OPTIONS: Array<NonNullable<Prefs["topSize"]>> = ["XS", "S", "M", "L", "XL"];
const SHOE_OPTIONS = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
const GENDER_LABELS: Record<Gender, string> = {
  man: "Man",
  woman: "Woman",
  other: "Other",
};
const EXPERIENCE_LABELS: Record<Experience, string> = {
  new: "New to this",
  comfortable: "Comfortable",
  enthusiast: "Enthusiast",
  pro: "Pro",
};

export function renderSettings(root: HTMLElement) {
  const p = getPrefs();

  root.innerHTML = `
    <header>
      <h1>Your preferences.</h1>
    </header>
    <main class="screen-settings">
      <section class="card-section" aria-labelledby="you-h">
        <h2 id="you-h">You</h2>
        <p class="tag">Helps me pick the right cut and difficulty.</p>

        <div class="row-group">
          <label>I'm shopping for
            <select id="gender">
              <option value="">Prefer not to say</option>
              ${(Object.keys(GENDER_LABELS) as Gender[]).map((g) =>
                `<option value="${g}" ${p.gender === g ? "selected" : ""}>${GENDER_LABELS[g]}</option>`,
              ).join("")}
            </select>
          </label>

          <label>How outdoorsy
            <select id="experience">
              <option value="">Not set</option>
              ${(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((e) =>
                `<option value="${e}" ${p.experience === e ? "selected" : ""}>${EXPERIENCE_LABELS[e]}</option>`,
              ).join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="card-section" aria-labelledby="a11y-h">
        <h2 id="a11y-h">Accessibility</h2>

        <label class="toggle">
          <input type="checkbox" id="hc" ${p.highContrast ? "checked" : ""} />
          <span><strong>High contrast</strong><br/><small>Sharper borders, stronger text</small></span>
        </label>

        <label class="toggle">
          <input type="checkbox" id="lt" ${p.largeText ? "checked" : ""} />
          <span><strong>Larger text</strong><br/><small>About 25% bigger everywhere</small></span>
        </label>

        <label class="toggle">
          <input type="checkbox" id="rm" ${p.reduceMotion ? "checked" : ""} />
          <span><strong>Reduce motion</strong><br/><small>Quiet down pulses and flashes</small></span>
        </label>

        <label class="toggle">
          <input type="checkbox" id="tts" ${p.ttsAnnouncements ? "checked" : ""} />
          <span><strong>Speak scan results</strong><br/><small>I'll read each find out loud</small></span>
        </label>

        <button id="test-tts" class="link-btn">Hear me</button>
      </section>

      <section class="card-section" aria-labelledby="size-h">
        <h2 id="size-h">Your sizes</h2>
        <p class="tag">
          Or just <a class="inline-link" href="?screen=fit">snap a photo</a>.
        </p>

        <div class="row-group">
          <label>Top size
            <select id="top-size">
              <option value="">Not set</option>
              ${SIZE_OPTIONS.map((s) => `<option value="${s}" ${p.topSize === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>

          <label>Bottom size
            <select id="bottom-size">
              <option value="">Not set</option>
              ${SIZE_OPTIONS.map((s) => `<option value="${s}" ${p.bottomSize === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>

          <label>Shoe size (EU)
            <select id="shoe-size">
              <option value="">Not set</option>
              ${SHOE_OPTIONS.map((s) => `<option value="${s}" ${p.shoeSizeEU === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
        </div>

        ${p.sizeSource ? `<p class="tag">From: ${escapeHTML(p.sizeSource === "fit-check" ? "a fit photo" : "what you typed in")}</p>` : ""}
      </section>

      <a class="link-btn" href="?screen=list">‹ Back</a>
    </main>
  `;

  const bindCheck = (
    id: string,
    field: keyof Prefs,
    extra?: (val: boolean) => void,
  ) => {
    const el = root.querySelector(`#${id}`) as HTMLInputElement;
    el.addEventListener("change", () => {
      const next = setPrefs({ [field]: el.checked } as Partial<Prefs>);
      extra?.(el.checked);
      applyPrefs(next);
    });
  };

  bindCheck("hc", "highContrast");
  bindCheck("lt", "largeText");
  bindCheck("rm", "reduceMotion");
  bindCheck("tts", "ttsAnnouncements");

  (root.querySelector("#test-tts") as HTMLButtonElement).addEventListener(
    "click",
    () => {
      if (!("speechSynthesis" in window)) {
        alert("This browser doesn't support speech.");
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        "I sound like this. Trail shoe by Pinewild, size 42. Got it.",
      );
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    },
  );

  (root.querySelector("#top-size") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      const val = (e.target as HTMLSelectElement).value;
      setPrefs({
        topSize: (val || null) as Prefs["topSize"],
        sizeSource: val ? "manual" : null,
      });
    },
  );
  (root.querySelector("#bottom-size") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      const val = (e.target as HTMLSelectElement).value;
      setPrefs({
        bottomSize: (val || null) as Prefs["bottomSize"],
        sizeSource: val ? "manual" : null,
      });
    },
  );
  (root.querySelector("#shoe-size") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      const val = (e.target as HTMLSelectElement).value;
      setPrefs({
        shoeSizeEU: val ? Number(val) : null,
        sizeSource: val ? "manual" : null,
      });
    },
  );

  (root.querySelector("#gender") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      const val = (e.target as HTMLSelectElement).value;
      setPrefs({ gender: (val || null) as Gender | null });
    },
  );
  (root.querySelector("#experience") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      const val = (e.target as HTMLSelectElement).value;
      setPrefs({ experience: (val || null) as Experience | null });
    },
  );
}
