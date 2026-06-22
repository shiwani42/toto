// Capture specific in-screen states the user has flagged.
import { chromium } from "playwright";
import { join } from "node:path";

const BASE = "https://toto-4xfl.onrender.com";
const OUT = "_audit";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
});
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem("toto.list", JSON.stringify([
      "2846287789562", "5628895968545", "1020203635321",
    ]));
    sessionStorage.setItem("toto.found", JSON.stringify(["2846287789562"]));
  } catch {}
});

// Connect — default mode (create) lands directly on the form
{
  const page = await ctx.newPage();
  await page.goto(BASE + "/?screen=connect", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "10b-connect-start.png"), fullPage: true });
  console.log("✓ connect-start");
  await page.close();
}

// Connect — join mode (after tapping the swap link)
{
  const page = await ctx.newPage();
  await page.goto(BASE + "/?screen=connect", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.click("#mode-swap");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "10c-connect-join.png"), fullPage: true });
  console.log("✓ connect-join");
  await page.close();
}

// Plan wizard, step several steps in to hit non-activity steps
{
  const page = await ctx.newPage();
  await page.goto(BASE + "/?screen=plan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // Tap "Day hike" — first card
  await page.click('[data-activity="day-hike"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "03b-plan-step2.png"), fullPage: true });
  console.log("✓ plan-step2");
  // Try to walk to specifics by tapping Skip until we land there
  for (let i = 0; i < 8; i++) {
    const last = await page.$('h1:has-text("Anything special")');
    if (last) break;
    await page.click("#skip");
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(OUT, "03c-plan-specifics.png"), fullPage: true });
  console.log("✓ plan-specifics");
  await page.close();
}

await browser.close();
console.log("Done.");
