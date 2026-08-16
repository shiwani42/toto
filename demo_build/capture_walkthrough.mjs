/**
 * Full Toto product walkthrough for Remotion.
 * Covers shopper journey + owner/platform dashboard like the classic E2E film.
 *
 *   APP_URL=http://127.0.0.1:5174 node capture_walkthrough.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PARENT = path.resolve(ROOT, "..");
const BASE = process.env.APP_URL || "http://127.0.0.1:5173";
const FIT_PHOTO = path.join(ROOT, "fixtures", "fit-subject.jpg");
const REPAIR_CODE = "7610000000011";
const RAW_DIR = path.join(ROOT, "recordings", "_raw");
const PARTIAL = path.join(ROOT, "recordings", "walkthrough.partial.mp4");
const OUT = path.join(ROOT, "recordings", "walkthrough.mp4");
const MARKERS = path.join(ROOT, "recordings", "markers.json");
const SHOTS = path.join(ROOT, "screenshots");

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(PARENT, ".env"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sbUrl = env.VITE_SUPABASE_URL.replace(/\/$/, "");
const SHOP_ID = "f894a074-8d24-4860-980b-e177e3616c57";
const ADMIN_EMAIL = "admin-test@toto.local";
const ADMIN_PASS = "TotoAdminTest-2026!";
const W = 390;
const H = 844;

const pause = (page, ms = 900) => page.waitForTimeout(ms);
const t0 = Date.now();
const mark = (id) => {
  markers[id] = (Date.now() - t0) / 1000;
};
const markers = { started: 0 };

async function expectText(page, pattern, label) {
  const body = await page.locator("body").innerText();
  if (!pattern.test(body)) {
    throw new Error(`Expected ${label}: /${pattern.source}/ not found`);
  }
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: false,
  });
}

async function seedList(page) {
  await page.evaluate(() => {
    sessionStorage.setItem(
      "toto.list",
      JSON.stringify(["7610000000011", "7610000000028", "7610000000035"]),
    );
  });
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  permissions: ["camera"],
  recordVideo: { dir: RAW_DIR, size: { width: W, height: H } },
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

try {
  mark("home");
  await page.goto(`${BASE}/?shop=default`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("toto.prefs");
    sessionStorage.removeItem("toto.list");
    sessionStorage.removeItem("toto.session");
  });
  await page.goto(`${BASE}/?shop=default`, { waitUntil: "networkidle" });
  await page
    .waitForFunction(
      () => {
        const v = document.querySelector("#toto-hero video");
        if (!v) return true;
        return (
          v.ended ||
          (v.duration > 0 && v.currentTime >= v.duration - 0.08)
        );
      },
      { timeout: 8000 },
    )
    .catch(() => {});
  await pause(page, 400);
  await shot(page, "home");

  mark("plan");
  await page.goto(`${BASE}/?shop=default&screen=plan`, {
    waitUntil: "networkidle",
  });
  await pause(page, 900);

  async function tapLabel(re) {
    const btn = page.getByRole("button", { name: re }).first();
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();
    await pause(page, 750);
  }

  await tapLabel(/Day hike/i);
  if (await page.getByRole("button", { name: /Myself/i }).count()) {
    await tapLabel(/Myself/i);
  }
  if (await page.getByRole("button", { name: /Men's cut/i }).count()) {
    await tapLabel(/Men's cut/i);
  }
  if (await page.getByRole("button", { name: /Comfortable/i }).count()) {
    await tapLabel(/Comfortable/i);
  }

  mark("plan-place");
  const loc = page.locator("#loc-input");
  if (await loc.count()) {
    await loc.fill("Zermatt");
    await pause(page, 1400);
    const hit = page.locator("button.loc-results__item").first();
    if (await hit.count()) await hit.click();
    else await page.locator("#skip").click();
    await pause(page, 800);
  }

  if (await page.locator("#next").count()) {
    await page.locator("#next").click();
    await pause(page, 800);
  }

  mark("plan-sizes");
  if (await page.locator('[data-size="top:M"]').count()) {
    await page.locator('[data-size="top:M"]').click();
    await pause(page, 400);
    await page.locator('[data-size="bot:M"]').click();
    await pause(page, 400);
    await page.locator('[data-size="shoe:42"]').click();
    await pause(page, 900);
  }

  if (await page.getByRole("button", { name: /Wet weather/i }).count()) {
    await page.getByRole("button", { name: /Wet weather/i }).click();
    await pause(page, 400);
    const light = page.getByRole("button", { name: /Light is key/i });
    if (await light.count()) await light.click();
    await pause(page, 400);
    await page.locator("#next").click();
  }

  mark("plan-list");
  await page.waitForSelector(".cat-pick, .deck-card, .cat-flow", {
    timeout: 28000,
  });
  await pause(page, 1400);
  await shot(page, "plan");
  await expectText(page, /Find them|option|added|hardshell|jacket|category/i, "plan-list");

  const cat = page.locator("button.cat-pick").first();
  if (await cat.count()) {
    await cat.click();
    await pause(page, 1200);
  }
  mark("plan-swipe");
  const addChip = page.locator('[data-action="add"]').first();
  if (await addChip.count()) {
    await addChip.click();
    await pause(page, 900);
    if (await page.locator('[data-action="add"]').count()) {
      await page.locator('[data-action="add"]').first().click();
      await pause(page, 900);
    }
  }
  await shot(page, "plan-swipe");
  await pause(page, 1000);

  await page.goto(`${BASE}/?shop=default&screen=list`, {
    waitUntil: "networkidle",
  });
  await seedList(page);
  await page.reload({ waitUntil: "networkidle" });
  await pause(page, 1400);
  await shot(page, "list");

  mark("map");
  await seedList(page);
  await page.goto(`${BASE}/?shop=default&screen=map`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".map-img, .zone-pin", { timeout: 12000 });
  await pause(page, 2400);
  await shot(page, "map");

  mark("scan");
  await seedList(page);
  await page.goto(`${BASE}/?shop=default&screen=scan`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".scan-viewport, #start-scan-btn", { timeout: 12000 });
  const startScan = page.locator("#start-scan-btn");
  if (await startScan.count()) {
    await startScan.click().catch(() => {});
    await pause(page, 1800);
  }
  await pause(page, 1600);
  await shot(page, "scan");

  // Seed interest events for owner analytics
  const anon = createClient(sbUrl, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const meta = await page.evaluate(
    () =>
      sessionStorage.getItem("toto.analytics.session") ||
      `demo${Date.now().toString(36)}`,
  );
  const { data: prods } = await anon
    .from("products")
    .select("product_code")
    .eq("shop_id", SHOP_ID)
    .limit(3);
  const codes = (prods || []).map((p) => p.product_code);
  await anon.from("events").insert([
    {
      shop_id: SHOP_ID,
      session_id: meta,
      user_id: null,
      event: "scan_started",
      payload: { list_size: 3 },
    },
    ...codes.map((code) => ({
      shop_id: SHOP_ID,
      session_id: meta,
      user_id: null,
      event: "scan_found",
      payload: { code, in_list: true, category: "Footwear" },
    })),
    {
      shop_id: SHOP_ID,
      session_id: meta,
      user_id: null,
      event: "scan_completed",
      payload: { list_size: 3, found_count: codes.length },
    },
  ]);

  // ── Fit Check: photo to sizes ──────────────────────────────────────
  mark("fit");
  await page.goto(`${BASE}/?shop=default&screen=fit`, {
    waitUntil: "networkidle",
  });
  await pause(page, 1000);
  await shot(page, "fit");
  await page.locator("#file").setInputFiles(FIT_PHOTO);
  await page.waitForSelector("text=Here's what I'd guess", { timeout: 20000 });
  await pause(page, 1800);
  mark("fit-result");
  await shot(page, "fit-result");

  // ── Repair vs Replace ──────────────────────────────────────────────
  mark("repair");
  const listCodes = await page.evaluate(() => {
    try {
      const raw = sessionStorage.getItem("toto.list");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const repairCode =
    (Array.isArray(listCodes) && listCodes[0]) || REPAIR_CODE;
  await page.goto(
    `${BASE}/?shop=default&screen=repair&code=${repairCode}`,
    { waitUntil: "networkidle" },
  );
  await pause(page, 2200);
  await expectText(page, /Repair|Replace|Either|ReFit|CHF/i, "repair");
  await shot(page, "repair");

  await seedList(page);

  // ── Twin Shopper ───────────────────────────────────────────────────
  mark("connect");
  await page.goto(`${BASE}/?shop=default&screen=connect`, {
    waitUntil: "networkidle",
  });
  await pause(page, 400);
  await page.locator("#choice-start").click();
  await pause(page, 350);
  await page.locator("#create-name").fill("Sam");
  await page.locator("#create-btn").click();
  await page.waitForURL(/screen=connected/, { timeout: 10000 });
  await page.waitForSelector(".conn-hint, .conn-pick, .conn-stream__row", {
    timeout: 8000,
  });
  await pause(page, 800);
  mark("connected");
  await expectText(page, /FAM-|PAR-/i, "connected-code");
  const chat = page.locator("#chat-input");
  if (await chat.count()) {
    await chat.fill("This shell?");
    await page.locator("#chat-form button[type=submit]").click();
    await pause(page, 900);
    await chat.fill("The boots too.");
    await page.locator("#chat-form button[type=submit]").click();
    await pause(page, 1400);
  }
  await pause(page, 4200);
  await shot(page, "connect");

  // ── Owner dashboard ────────────────────────────────────────────────
  mark("dashboard");
  const { data: adminAuth, error: authErr } = await anon.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (authErr) throw authErr;

  const ref = new URL(sbUrl).hostname.split(".")[0];
  const storageKey = `sb-${ref}-auth-token`;
  await page.goto(`${BASE}/?screen=dashboard`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ storageKey, session }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: 3600,
          token_type: "bearer",
          user: { email: session.user.email },
        }),
      );
    },
    { storageKey, session: adminAuth.session },
  );
  await page.goto(`${BASE}/?screen=dashboard`, { waitUntil: "networkidle" });
  await pause(page, 3200);
  await expectText(
    page,
    /Shop insights|On lists|Planning for|DEFAULT SHOP/i,
    "dashboard",
  );
  await shot(page, "dashboard-owner");

  // Scroll owner insights
  for (const heading of [
    /Planning for/i,
    /Products they want/i,
    /Who's shopping/i,
  ]) {
    await page
      .getByRole("heading", { name: heading })
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await pause(page, 1400);
  }
  await shot(page, "dashboard-owner-scroll");

  // Platform usage
  mark("platform");
  const platformTab = page.getByRole("tab", { name: /^Platform$/i });
  if (await platformTab.count()) {
    await platformTab.click();
    await pause(page, 2800);
    await expectText(page, /sessions, last 7 days|Funnel/i, "platform");
    await shot(page, "dashboard-platform");
    await page
      .getByRole("heading", { name: /Funnel|By hour/i })
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await pause(page, 1800);
  }

  // Back to owner: settings + QR + catalog
  mark("ops");
  const ownerTab = page.getByRole("tab", { name: /Shop insights/i });
  if (await ownerTab.count()) {
    await ownerTab.click();
    await pause(page, 2200);
  }
  await page
    .getByRole("heading", { name: /Shop settings/i })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await pause(page, 1800);
  await page.locator("#shop-qr-canvas").scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2000);
  await shot(page, "dashboard-qr");
  await page
    .getByRole("heading", { name: /Catalog/i })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await pause(page, 2200);
  await shot(page, "dashboard-catalog");

  mark("end");
} catch (err) {
  console.error("Capture failed:", err);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();

  let webm = null;
  if (video) webm = await video.path();
  else {
    const files = fs
      .readdirSync(RAW_DIR)
      .filter((f) => f.endsWith(".webm"))
      .map((f) => path.join(RAW_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    webm = files[0] || null;
  }

  fs.writeFileSync(MARKERS, JSON.stringify(markers, null, 2));
  console.log("Markers:", markers);

  if (!webm || !fs.existsSync(webm)) {
    console.error("No WebM produced");
    process.exitCode = 1;
  } else {
    const r = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        webm,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-profile:v",
        "baseline",
        "-level",
        "3.1",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-shortest",
        "-movflags",
        "+faststart",
        PARTIAL,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(r.stderr);
      process.exitCode = 1;
    } else {
      fs.renameSync(PARTIAL, OUT);
      const st = fs.statSync(OUT);
      console.log(`Wrote ${OUT} (${Math.round(st.size / 1024)} KB)`);
    }
  }
}
