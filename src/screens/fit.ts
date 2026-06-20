import { setPrefs, getPrefs } from "../lib/prefs";

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as
  | string
  | undefined;

const MODEL = "claude-haiku-4-5-20251001";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type FitEstimate = {
  topSize: "XS" | "S" | "M" | "L" | "XL" | null;
  bottomSize: "XS" | "S" | "M" | "L" | "XL" | null;
  shoeSizeEU: number | null;
  reasoning: string;
  silhouetteNotes: string;
};

async function estimateFromPhoto(jpegBase64: string): Promise<FitEstimate> {
  if (!ANTHROPIC_API_KEY) {
    console.error("Fit Check unavailable (VITE_ANTHROPIC_API_KEY missing).");
    throw new Error("Fit Check isn't available right now. You can type your sizes in Settings instead.");
  }
  const prompt = `Estimate clothing and footwear sizes from a single photo of a person.

Return ONLY a JSON object, no commentary, no markdown fences:
{
  "topSize": "XS"|"S"|"M"|"L"|"XL"|null,
  "bottomSize": "XS"|"S"|"M"|"L"|"XL"|null,
  "shoeSizeEU": <integer 36-46>|null,
  "reasoning": "<= 200 chars, what visual cues drove the call",
  "silhouetteNotes": "<= 150 chars about apparent build (e.g. 'slim shoulders, athletic build')"
}

Be conservative — return null for fields that can't be inferred from the photo (e.g. shoe size when feet aren't visible). Don't ask follow-up questions.`;

  const body = {
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: jpegBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Fit Check API failed (${res.status}):`, text.slice(0, 200));
    throw new Error("I couldn't read the photo just now.");
  }

  const json = await res.json();
  const text = (json.content?.[0]?.text ?? "").trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("Fit Check response wasn't valid JSON:", text.slice(0, 200));
    throw new Error("I couldn't read the photo just now.");
  }
  const parsed = JSON.parse(match[0]);
  return {
    topSize: parsed.topSize ?? null,
    bottomSize: parsed.bottomSize ?? null,
    shoeSizeEU:
      typeof parsed.shoeSizeEU === "number" ? parsed.shoeSizeEU : null,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    silhouetteNotes:
      typeof parsed.silhouetteNotes === "string"
        ? parsed.silhouetteNotes
        : "",
  };
}

function fileToBase64Jpeg(
  file: File,
  maxDim = 1024,
): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D unsupported"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't load image"));
    };
    img.src = url;
  });
}

export function renderFit(root: HTMLElement) {
  const existing = getPrefs();

  root.innerHTML = `
    <header>
      <h1>Quick fit check.</h1>
    </header>
    <main class="screen-fit">
      <label class="capture-btn">
        <input id="file" type="file" accept="image/*" capture="environment" hidden />
        <span>📸 Take a photo</span>
      </label>
      <p class="fit-privacy">🔒 One look, then it's gone. Nothing stored.</p>

      <div id="preview"></div>
      <div id="result"></div>

      ${existing.sizeSource ? `<p class="tag">Last saved: ${escapeHTML(`top ${existing.topSize ?? "?"}, bottom ${existing.bottomSize ?? "?"}, shoe EU ${existing.shoeSizeEU ?? "?"}`)} <a class="inline-link" href="?screen=settings">edit</a></p>` : ""}

      <a class="link-btn" href="?screen=settings">‹ Back to settings</a>
    </main>
  `;

  const fileInput = root.querySelector("#file") as HTMLInputElement;
  const previewEl = root.querySelector("#preview") as HTMLDivElement;
  const resultEl = root.querySelector("#result") as HTMLDivElement;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    previewEl.innerHTML = `<div class="status">Tidying up the photo…</div>`;
    resultEl.innerHTML = "";
    let imgData: { base64: string; dataUrl: string };
    try {
      imgData = await fileToBase64Jpeg(file);
    } catch (err) {
      previewEl.innerHTML = `<div class="status">Hit a snag: ${escapeHTML((err as Error).message)}</div>`;
      return;
    }
    previewEl.innerHTML = `
      <div class="fit-preview">
        <img src="${imgData.dataUrl}" alt="Your photo for fit estimation" />
        <div class="status">Looking it over…</div>
      </div>
    `;
    try {
      const est = await estimateFromPhoto(imgData.base64);
      // Save into prefs immediately so other screens can use them.
      setPrefs({
        topSize: est.topSize,
        bottomSize: est.bottomSize,
        shoeSizeEU: est.shoeSizeEU,
        sizeSource: "fit-check",
      });
      // Replace the inline status with the result.
      previewEl.innerHTML = `
        <div class="fit-preview">
          <img src="${imgData.dataUrl}" alt="Your photo for fit estimation" />
        </div>
      `;
      resultEl.innerHTML = `
        <div class="diff-card">
          <h3>Here's what I'd guess.</h3>
          <ul class="diff-list">
            <li><span class="diff-list__label">Top</span><span class="diff-list__delta">${est.topSize ?? "?"}</span></li>
            <li><span class="diff-list__label">Bottom</span><span class="diff-list__delta">${est.bottomSize ?? "?"}</span></li>
            <li><span class="diff-list__label">Shoe (EU)</span><span class="diff-list__delta">${est.shoeSizeEU ?? "?"}</span></li>
          </ul>
          <p class="ai-banner__reason" style="margin-top:8px">${escapeHTML(est.reasoning)}</p>
          <p class="tag">${escapeHTML(est.silhouetteNotes)}</p>
          <p class="tag">Saved. I'll lean on these next time you build a list.</p>
        </div>
      `;
    } catch (err) {
      previewEl.innerHTML = `
        <div class="fit-preview">
          <img src="${imgData.dataUrl}" alt="Your photo for fit estimation" />
        </div>
      `;
      resultEl.innerHTML = `<div class="status">Error: ${escapeHTML((err as Error).message)}</div>`;
    }
  });
}
