import { getProduct } from "../lib/catalog";
import { repairProgramFor, type RepairProgram } from "../fixtures/repair-programs";
import { startScanner, type ScannerHandle } from "../lib/scanner";
import { cameraErrorMessage } from "../lib/camera-errors";
import type { Product } from "../lib/types";
import { t } from "../lib/i18n";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decide(p: Product, prog: RepairProgram): {
  recommendation: "Repair" | "Replace" | "Either";
  reasoning: string;
} {
  const median = prog.repairCostBands.medium;
  const ratio = median / p.price_chf;
  if (ratio < 0.25)
    return {
      recommendation: "Repair",
      reasoning: `A repair runs about CHF ${median}, only ${Math.round(ratio * 100)}% of a new one at CHF ${p.price_chf.toFixed(0)}. Keep the one you have.`,
    };
  if (ratio < 0.6)
    return {
      recommendation: "Either",
      reasoning: `Repair is around CHF ${median}, about ${Math.round(ratio * 100)}% of a new one at CHF ${p.price_chf.toFixed(0)}. Worth fixing if it fits well or you're attached to it.`,
    };
  return {
    recommendation: "Replace",
    reasoning: `Repair is about CHF ${median}, ${Math.round(ratio * 100)}% of a new one at CHF ${p.price_chf.toFixed(0)}. A replacement makes more sense unless the damage is cosmetic.`,
  };
}

function repairCard(p: Product, prog: RepairProgram): string {
  const accepted = prog.acceptedCategories.includes(p.category);
  if (!accepted) {
    return `
      <div class="diff-card">
        <h3>${escapeHTML(prog.brand)} ${t("repair.no_category").replace("{category}", escapeHTML(p.category))}</h3>
        <p class="diff-card__lead">${escapeHTML(prog.programName)} ${t("repair.accepts")} ${prog.acceptedCategories.map((c) => `<code>${escapeHTML(c)}</code>`).join(", ")}.</p>
      </div>
    `;
  }
  const { recommendation, reasoning } = decide(p, prog);
  const recColor =
    recommendation === "Repair"  ? "var(--ok)"
  : recommendation === "Replace" ? "var(--bad)"
  : "var(--warn)";
  const recLabel = recommendation === "Repair"  ? t("repair.recommend")
                 : recommendation === "Replace" ? t("repair.recommend.replace")
                 : t("repair.recommend.either");
  return `
    <div class="diff-card">
      <h3>${escapeHTML(prog.programName)}</h3>
      <p class="diff-card__lead">${escapeHTML(prog.pitch)}</p>

      <div class="repair-rec" style="border-color:${recColor}">
        <div class="repair-rec__label" style="color:${recColor}">${escapeHTML(recLabel)}</div>
        <div class="repair-rec__reasoning">${escapeHTML(reasoning)}</div>
      </div>

      <ul class="diff-list">
        <li><span class="diff-list__label">${t("repair.minor")}</span><span class="diff-list__delta">~CHF ${prog.repairCostBands.minor}</span></li>
        <li><span class="diff-list__label">${t("repair.medium")}</span><span class="diff-list__delta">~CHF ${prog.repairCostBands.medium}</span></li>
        <li><span class="diff-list__label">${t("repair.major")}</span><span class="diff-list__delta">~CHF ${prog.repairCostBands.major}</span></li>
        <li><span class="diff-list__label">${t("repair.new_cost")}</span><span class="diff-list__delta">CHF ${p.price_chf.toFixed(0)}</span></li>
        <li><span class="diff-list__label">${t("repair.turnaround")}</span><span class="diff-list__delta">${escapeHTML(prog.turnaroundDays)} ${t("repair.days")}</span></li>
        ${prog.perk ? `<li><span class="diff-list__label">${t("repair.perk")}</span><span class="diff-list__delta" style="color:var(--ok)">${escapeHTML(prog.perk)}</span></li>` : ""}
      </ul>

      <a class="primary" href="${escapeHTML(prog.url)}" target="_blank" rel="noreferrer noopener">
        ${t("repair.start")} ${escapeHTML(prog.brand)}
      </a>
    </div>
  `;
}

function buildResultHTML(product: Product): string {
  const prog = repairProgramFor(product.brand);
  if (!prog) {
    return `
      <div class="diff-card">
        <h3>${t("repair.no_program")} ${escapeHTML(product.brand)}.</h3>
        <p class="diff-card__lead">${t("repair.no_program.sub")} <strong>CHF ${product.price_chf.toFixed(0)}</strong>.</p>
      </div>
    `;
  }
  return repairCard(product, prog);
}

export function renderRepair(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>${t("repair.title")}</h1>
    </header>
    <main class="screen-compare">
      <div id="status" class="status" hidden></div>
      <div id="capture-view" class="compare-cam"></div>
      <button class="primary" id="scan-btn">${t("repair.scan")}</button>
      <div id="result"></div>

      <a class="link-btn" href="?screen=list">${t("compare.back")}</a>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const captureViewEl = root.querySelector("#capture-view") as HTMLDivElement;
  const resultEl = root.querySelector("#result") as HTMLDivElement;
  const scanBtn = root.querySelector("#scan-btn") as HTMLButtonElement;

  function setStatus(msg: string) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  let handle: ScannerHandle | null = null;
  let paused = false;

  async function ensureScanner(): Promise<void> {
    if (handle) return;
    handle = await startScanner({
      host: captureViewEl,
      onFrame: () => { /* no overlay */ },
      onScan: (code) => {
        if (paused) return;
        const product = getProduct(code.text);
        if (!product) {
          setStatus(t("repair.unknown"));
          return;
        }
        if ("vibrate" in navigator) navigator.vibrate(60);
        paused = true;
        captureViewEl.classList.remove("compare-cam--active");
        scanBtn.textContent = t("repair.scan_another");
        setStatus(`${t("repair.got_it")} ${product.name}, ${product.brand}, ${product.size}`);
        resultEl.innerHTML = buildResultHTML(product);
      },
    });
  }

  scanBtn.addEventListener("click", async () => {
    setStatus(t("scan.warming"));
    try {
      await ensureScanner();
      paused = false;
      captureViewEl.classList.add("compare-cam--active");
      setStatus(t("repair.point"));
    } catch (err) {
      console.error("Repair scanner failed:", err);
      setStatus(cameraErrorMessage(err));
    }
  });

  const prefilled = new URLSearchParams(window.location.search).get("code");
  if (prefilled) {
    const product = getProduct(prefilled);
    if (product) {
      scanBtn.textContent = t("repair.scan_different");
      setStatus(`Looking at: ${product.name}, ${product.brand}.`);
      resultEl.innerHTML = buildResultHTML(product);
    }
  }

  window.addEventListener("pagehide", () => { handle?.stop(); }, { once: true });
}
