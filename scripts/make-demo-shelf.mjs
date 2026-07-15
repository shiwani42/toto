#!/usr/bin/env node
/**
 * Generate a printable A4 "demo shelf" of ~12 EAN-13 barcodes from
 * data/products.json. Print the HTML, tape it up, point the camera.
 *
 * Usage:
 *   npm run demo-shelf
 *   node scripts/make-demo-shelf.mjs [--out data/demo-shelf.html] [codes…]
 *
 * Default pick: unique product_ids, prefer waterproof + weight_g < 400,
 * then fill to 12 with other EAN-13 catalog rows.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bwipjs from "bwip-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "data", "products.json");

function parseArgs(argv) {
  let out = path.join(ROOT, "data", "demo-shelf.html");
  const codes = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) {
      out = path.resolve(argv[++i]);
    } else if (a.startsWith("--out=")) {
      out = path.resolve(a.slice("--out=".length));
    } else if (!a.startsWith("-")) {
      codes.push(a);
    }
  }
  return { out, codes };
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isEan13(code) {
  return /^\d{13}$/.test(code);
}

function pickDefault(products, n = 12) {
  const seen = new Set();
  const picks = [];
  const tryAdd = (pred) => {
    for (const p of products) {
      if (picks.length >= n) break;
      if (!isEan13(p.product_code)) continue;
      if (seen.has(p.product_id)) continue;
      if (!pred(p)) continue;
      seen.add(p.product_id);
      picks.push(p);
    }
  };
  tryAdd(
    (p) =>
      Array.isArray(p.tags) &&
      p.tags.includes("waterproof") &&
      typeof p.weight_g === "number" &&
      p.weight_g < 400,
  );
  tryAdd(() => true);
  return picks;
}

async function barcodePngDataUri(text) {
  const png = await bwipjs.toBuffer({
    bcid: "ean13",
    text,
    scale: 3,
    height: 14,
    includetext: true,
    textxalign: "center",
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}

function cellHTML(p, img) {
  const subtitle = [p.brand, p.size, p.color].filter(Boolean).join(" · ");
  const weight = typeof p.weight_g === "number" ? `${p.weight_g} g` : "";
  return `
    <article class="cell">
      <img class="cell__barcode" src="${img}" alt="EAN-13 ${escapeHTML(p.product_code)}" />
      <h2 class="cell__name">${escapeHTML(p.name)}</h2>
      <p class="cell__meta">${escapeHTML(subtitle)}${weight ? ` · ${escapeHTML(weight)}` : ""}</p>
      <p class="cell__code">${escapeHTML(p.product_code)}</p>
    </article>
  `;
}

async function main() {
  const { out, codes } = parseArgs(process.argv.slice(2));
  const products = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const byCode = new Map(products.map((p) => [p.product_code, p]));

  let selected;
  if (codes.length > 0) {
    selected = codes.map((c) => {
      const p = byCode.get(c);
      if (!p) throw new Error(`Unknown product_code: ${c}`);
      if (!isEan13(c)) throw new Error(`Not EAN-13 (demo shelf is EAN-13 only): ${c}`);
      return p;
    });
  } else {
    selected = pickDefault(products, 12);
  }

  if (selected.length === 0) {
    throw new Error("No products selected for the demo shelf.");
  }

  const cells = [];
  for (const p of selected) {
    const img = await barcodePngDataUri(p.product_code);
    cells.push(cellHTML(p, img));
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Toto demo shelf</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
      color: #1a1a1a;
      background: #fff;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8mm;
      padding-bottom: 3mm;
      border-bottom: 1.5px solid #1a1a1a;
    }
    header h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    header p {
      margin: 0;
      font-size: 9pt;
      color: #555;
      text-align: right;
      max-width: 55%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5mm 4mm;
    }
    .cell {
      border: 1px solid #ccc;
      border-radius: 2mm;
      padding: 3mm 2.5mm 2.5mm;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .cell__barcode {
      display: block;
      width: 100%;
      height: auto;
      max-height: 28mm;
      object-fit: contain;
      margin: 0 auto 2mm;
    }
    .cell__name {
      margin: 0 0 1mm;
      font-size: 8.5pt;
      line-height: 1.2;
      font-weight: 650;
    }
    .cell__meta {
      margin: 0;
      font-size: 7pt;
      color: #555;
      line-height: 1.25;
    }
    .cell__code {
      margin: 1.5mm 0 0;
      font-size: 7pt;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: 0.04em;
      color: #333;
    }
    footer {
      margin-top: 6mm;
      font-size: 8pt;
      color: #777;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Toto · demo shelf</h1>
    <p>Print A4 · tape at eye height · scan with Toto camera.<br />
       Default mix: waterproof under 400&nbsp;g, then other EAN-13 SKUs.</p>
  </header>
  <div class="grid">
    ${cells.join("\n")}
  </div>
  <footer>
    <span>${selected.length} barcodes · from products.json</span>
    <span>Powered by Toto</span>
  </footer>
</body>
</html>
`;

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
  console.log(`Wrote ${selected.length} barcodes → ${path.relative(ROOT, out)}`);
  for (const p of selected) {
    console.log(`  ${p.product_code}  ${p.name}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
