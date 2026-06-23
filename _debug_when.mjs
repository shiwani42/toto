// Reproduce the When-step button issue.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on("console", (msg) => console.log(`[${msg.type()}]`, msg.text()));
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto("https://toto-4xfl.onrender.com/?screen=plan");
await page.waitForTimeout(800);
console.log("On step:", await page.$eval(".wizard__q", (el) => el.textContent));
// Pick Day hike
await page.click('[data-activity="day-hike"]');
await page.waitForTimeout(300);
// Walk through any preference steps (just Skip until we hit Where, then When)
for (let i = 0; i < 8; i++) {
  const q = await page.$eval(".wizard__q", (el) => el.textContent).catch(() => "");
  console.log("Step:", q);
  if (q.includes("When")) break;
  await page.click("#skip");
  await page.waitForTimeout(300);
}
console.log("Should be on When now");
// Inspect both buttons
const skipExists = await page.$("#skip");
const nextExists = await page.$("#next");
console.log("Skip exists:", !!skipExists, "Continue exists:", !!nextExists);
// Click Continue
console.log("Clicking Continue...");
await page.click("#next");
await page.waitForTimeout(500);
const newQ = await page.$eval(".wizard__q", (el) => el.textContent).catch(() => "ERR");
console.log("After Continue, step:", newQ);

await browser.close();
