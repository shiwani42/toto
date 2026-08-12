/**
 * Record a narrated-paced E2E video: shopper on Toto → Default Shop →
 * list/plan/map → admin analytics.
 *
 * Output: video/toto-e2e-shopper-admin.mp4
 *
 *   node scripts/record-e2e-video.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.APP_URL || "http://127.0.0.1:5174";
const RAW_DIR = path.join(ROOT, "video", "_raw");
const OUT_MP4 = path.join(ROOT, "video", "toto-e2e-shopper-admin.mp4");
fs.mkdirSync(RAW_DIR, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env"), "utf8")
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

async function title(page, heading, sub = "") {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;height:100%;font-family:Georgia,serif;background:#1a2e24;color:#f4f1ea;
      display:flex;align-items:center;justify-content:center;text-align:center}
    .wrap{padding:32px;max-width:340px}
    h1{font-size:28px;line-height:1.2;margin:0 0 12px;font-weight:600;letter-spacing:-0.02em}
    p{font-size:15px;line-height:1.45;margin:0;opacity:.82;font-family:system-ui,sans-serif}
    .tag{display:inline-block;margin-bottom:16px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;
      font-family:system-ui,sans-serif;opacity:.65}
  </style></head><body><div class="wrap">
    <div class="tag">Toto · E2E</div>
    <h1>${heading}</h1>
    ${sub ? `<p>${sub}</p>` : ""}
  </div></body></html>`);
  await page.waitForTimeout(2200);
}

async function pause(page, ms = 900) {
  await page.waitForTimeout(ms);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: RAW_DIR, size: { width: W, height: H } },
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

try {
  // ── Opening ──────────────────────────────────────────────────────────
  await title(
    page,
    "Shopper meets Toto",
    "Companionship and convenience in-store — then the same visit shows up for the shop owner as visibility and analytics.",
  );

  // ── Shopper: home + discovery ────────────────────────────────────────
  await title(page, "1 · Discover shops on Toto", "Owners become visible through the shop directory and entry QR.");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pause(page, 1600);

  await page.getByText(/Browse all shops/i).first().click();
  await page.waitForSelector("text=Default Shop", { timeout: 15000 });
  await pause(page, 2000);

  await page.getByText(/Default Shop/i).first().click();
  await page.waitForTimeout(1200);
  await pause(page, 2000);

  // ── List ─────────────────────────────────────────────────────────────
  await title(page, "2 · Build a list", "Search the catalog — Toto helps collapse the wall of choice.");
  await page.goto(`${BASE}/?shop=default&screen=list`, { waitUntil: "networkidle" });
  await pause(page, 1500);

  const search = page.locator("input").first();
  for (const q of ["Stormpeak", "Trailfox"]) {
    await search.fill("");
    await search.fill(q);
    await pause(page, 1100);
    const addBtn = page.locator("button.result-card__add").filter({ hasText: /^Add$/i }).first();
    if (await addBtn.count()) await addBtn.click();
    else {
      const card = page.locator("li.result-card").first();
      if (await card.count()) await card.click();
    }
    await pause(page, 900);
  }
  await pause(page, 1500);

  // ── Plan ─────────────────────────────────────────────────────────────
  await title(page, "3 · Plan with a bit of intelligence", "Trip prefs → Toto suggests gear for the conditions.");
  await page.goto(`${BASE}/?shop=default&screen=plan`, { waitUntil: "networkidle" });
  await pause(page, 1200);

  await page.getByRole("button", { name: /Day hike/i }).first().click();
  await pause(page, 800);

  if (await page.locator("button.wizard-card").count()) {
    await page.locator("button.wizard-card").first().click();
    await pause(page, 700);
  }
  if (await page.getByRole("button", { name: /Woman|Women|Female|Man|Men|Male/i }).count()) {
    await page.getByRole("button", { name: /Woman|Women|Female|Man|Men|Male/i }).first().click();
    await pause(page, 700);
  }
  if (await page.locator("button.wizard-card").count()) {
    await page.locator("button.wizard-card").first().click();
    await pause(page, 700);
  }

  const locInput = page.locator("input").first();
  if (await locInput.count()) {
    await locInput.fill("Zermatt");
    await pause(page, 1400);
    const hit = page.locator("button").filter({ hasText: /Zermatt/i }).first();
    if (await hit.count()) await hit.click();
    await pause(page, 900);
  }

  for (let i = 0; i < 10; i++) {
    const bodyNow = await page.locator("body").innerText();
    if (/category|swipe|weather|deck|Find them|suggested|Anything special/i.test(bodyNow) && /Continue|Skip|Next/i.test(bodyNow)) {
      // on specifics or later — click continue once more if needed after sizes
    }
    if (/category|swipe|For you|deck|Find them|pack/i.test(bodyNow) && !/Anything special|Your sizes/i.test(bodyNow)) break;

    const skip = page.locator("#skip");
    if (await skip.count() && (await skip.isVisible())) {
      await skip.click();
      await pause(page, 900);
      continue;
    }
    const nextBtn = page.locator("#next, button.plan-one__go");
    if (await nextBtn.count() && (await nextBtn.first().isVisible())) {
      await nextBtn.first().click();
      await pause(page, 900);
      continue;
    }
    break;
  }
  await pause(page, 2500);

  // If still on specifics, continue into planner
  if (await page.locator("#next").count()) {
    await page.locator("#next").click();
    await pause(page, 4000);
  }
  await pause(page, 2000);

  // ── Map ──────────────────────────────────────────────────────────────
  await title(page, "4 · Navigate the floor", "Zones on the map — walk with a plan, not a wall of jackets.");
  await page.goto(`${BASE}/?shop=default&screen=map`, { waitUntil: "networkidle" });
  await pause(page, 2800);

  // ── Scan UI ──────────────────────────────────────────────────────────
  await title(page, "5 · Scan at the shelf", "Camera AR finds list matches. (Demo records the scan screen; live camera needs a phone.)");
  await page.goto(`${BASE}/?shop=default&screen=scan`, { waitUntil: "networkidle" });
  await pause(page, 2500);

  // Emit scan interest events (same schema as production scan) so admin analytics move
  const meta = await page.evaluate(() => ({
    session: sessionStorage.getItem("toto.analytics.session") || `vid${Date.now().toString(36)}`,
  }));
  const anon = createClient(sbUrl, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: prods } = await anon.from("products").select("product_code").eq("shop_id", SHOP_ID).limit(2);
  const codes = (prods || []).map((p) => p.product_code);
  await anon.from("events").insert([
    { shop_id: SHOP_ID, session_id: meta.session, user_id: null, event: "scan_started", payload: { list_size: 2 } },
    ...codes.map((code) => ({
      shop_id: SHOP_ID,
      session_id: meta.session,
      user_id: null,
      event: "scan_found",
      payload: { code, in_list: true },
    })),
    {
      shop_id: SHOP_ID,
      session_id: meta.session,
      user_id: null,
      event: "scan_completed",
      payload: { list_size: 2, found_count: codes.length },
    },
  ]);
  await pause(page, 1500);

  // Let analytics flush from the browser session too
  await pause(page, 5500);

  // ── Bridge card ──────────────────────────────────────────────────────
  await title(
    page,
    "Meanwhile, at the shop…",
    "The same visit is anonymous events on the shop’s id — visibility and intent for the owner.",
  );

  // ── Admin ────────────────────────────────────────────────────────────
  await title(page, "6 · Owner admin", "Sessions, funnel, interest widgets, catalog, entry QR.");

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
  await pause(page, 3500);

  // Scroll through analytics story
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(page, 1500);
  await page.getByRole("heading", { name: /Funnel/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 1800);
  await page.getByRole("heading", { name: /Categories in demand|Demand gaps|Trip purpose|Activity mix/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2000);
  await page.getByRole("heading", { name: /Product performance|Usage by hour/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2000);
  await page.getByRole("heading", { name: /Shop settings/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2200);
  await page.locator("#shop-qr-canvas").scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2500);
  await page.getByRole("heading", { name: /Catalog/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(page, 2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(page, 2000);

  await title(
    page,
    "Two sides, one loop",
    "Shoppers get a companion. Owners get visibility into what people actually wanted — on Toto.",
  );
} catch (err) {
  console.error("Recording failed:", err);
  await title(page, "Recording error", err instanceof Error ? err.message : String(err)).catch(() => {});
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();

  let webm = null;
  if (video) {
    webm = await video.path();
    console.log("Raw WebM:", webm);
  } else {
    const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".webm"));
    files.sort((a, b) => fs.statSync(path.join(RAW_DIR, b)).mtimeMs - fs.statSync(path.join(RAW_DIR, a)).mtimeMs);
    webm = files[0] ? path.join(RAW_DIR, files[0]) : null;
  }

  if (!webm || !fs.existsSync(webm)) {
    console.error("No WebM produced");
    process.exitCode = 1;
  } else {
    fs.mkdirSync(path.dirname(OUT_MP4), { recursive: true });
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
        "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x1a2e24,fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-profile:v",
        "baseline",
        "-level",
        "3.1",
        "-pix_fmt",
        "yuv420p",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-b:v",
        "2M",
        "-maxrate",
        "2.5M",
        "-bufsize",
        "4M",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        "-movflags",
        "+faststart",
        OUT_MP4,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(r.stderr);
      // fallback: copy webm next to mp4 path
      const fallback = OUT_MP4.replace(/\.mp4$/, ".webm");
      fs.copyFileSync(webm, fallback);
      console.log("ffmpeg failed; saved WebM instead:", fallback);
      process.exitCode = 1;
    } else {
      const st = fs.statSync(OUT_MP4);
      console.log(`Wrote ${OUT_MP4} (${Math.round(st.size / 1024)} KB)`);
    }
  }
}
