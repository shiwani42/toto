// Visual audit: take phone-sized screenshots of every screen against the
// live Render build, so we can review them side by side and spot the
// inconsistencies that have been bothering the user.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://toto-4xfl.onrender.com";
const OUT = "_audit";
if (!existsSync(OUT)) mkdirSync(OUT);

const SCREENS = [
  { name: "01-home",      url: "/?screen=home" },
  { name: "02-list",      url: "/?screen=list" },
  { name: "03-plan",      url: "/?screen=plan" },
  { name: "04-browse",    url: "/?screen=browse" },
  { name: "05-map",       url: "/?screen=map" },
  { name: "06-scan",      url: "/?screen=scan" },
  { name: "07-done",      url: "/?screen=done" },
  { name: "08-compare",   url: "/?screen=compare" },
  { name: "09-repair",    url: "/?screen=repair" },
  { name: "10-connect",   url: "/?screen=connect" },
  { name: "11-settings",  url: "/?screen=settings" },
  { name: "12-fit",       url: "/?screen=fit" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 }, // iPhone 11 Pro Max-ish
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
});

// Seed sessionStorage so list/scan/done/map screens have content.
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem("toto.list", JSON.stringify([
      "2846287789562", "5628895968545", "1020203635321",
    ]));
    sessionStorage.setItem("toto.found", JSON.stringify(["2846287789562"]));
  } catch {}
});

for (const s of SCREENS) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + s.url, { waitUntil: "domcontentloaded", timeout: 15000 });
    // Let animations settle and let camera screens settle into their
    // fallback or running state (camera boot can take a couple seconds
    // to fail in headless Playwright).
    await page.waitForTimeout(3500);
    const out = join(OUT, `${s.name}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`✓ ${s.name}`);
  } catch (err) {
    console.warn(`✗ ${s.name}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nDone. Audit saved to ${OUT}/`);
