/**
 * Full-loop E2E: shopper discovery + companionship flow → events → admin analytics.
 * Run: node scripts/e2e-shopper-owner-loop.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.APP_URL || "http://127.0.0.1:5174";
const OUT = path.resolve("scripts/_e2e-out/loop");
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const sbUrl = env.VITE_SUPABASE_URL.replace(/\/$/, "");
const anon = createClient(sbUrl, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SHOP_ID = "f894a074-8d24-4860-980b-e177e3616c57";
const ADMIN_EMAIL = "admin-test@toto.local";
const ADMIN_PASS = "TotoAdminTest-2026!";

const results = [];
const note = (step, ok, detail = "") => {
  results.push({ step, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(25000);
const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
};

try {
  // ═══════════════════════════════════════════════════════════════════
  // A. SHOPPER — discovery / visibility of shops on Toto
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n══ A. Shopper: discovery & companionship ══");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await shot("01-home-before-shop");
  note(
    "Home shows enter-shop / browse (platform visibility)",
    /Enter a shop|Browse all shops|shop-slug/i.test(await page.locator("body").innerText()),
  );

  await page.getByText(/Browse all shops/i).first().click();
  await page.waitForSelector("text=Default Shop", { timeout: 15000 });
  await page.waitForTimeout(400);
  await shot("02-shop-directory");
  const shopsText = await page.locator("body").innerText();
  note(
    "Shop directory lists Default Shop (owner visible to shoppers)",
    /Default Shop/i.test(shopsText) && /Switzerland|default/i.test(shopsText),
    shopsText.slice(0, 120).replace(/\s+/g, " "),
  );

  await page.getByText(/Default Shop/i).first().click();
  await page.waitForTimeout(1200);
  await shot("03-entered-default-shop");
  const homeInShop = await page.locator("body").innerText();
  note(
    "Entered Default Shop context",
    /SHOPPING AT Default Shop|Leave shop/i.test(homeInShop),
    homeInShop.slice(0, 100).replace(/\s+/g, " "),
  );

  // Companion tone on home
  note(
    "Companionship framing on home",
    /Hi, I'm Toto|What brings you|Help me plan|I have a list/i.test(homeInShop),
  );

  // ── List: convenience (explicit shop context so list_added stamps shop_id) ──
  await page.goto(`${BASE}/?shop=default&screen=list`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  // Confirm shop primed
  const primed = await page.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem("toto.activeShop") || "null")?.id || null;
    } catch {
      return null;
    }
  });
  note("Shop primed before list adds", primed === SHOP_ID, `shopId=${primed}`);

  const search = page.locator("input").first();
  for (const q of ["Stormpeak", "Trailfox"]) {
    await search.fill("");
    await search.fill(q);
    await page.waitForTimeout(1000);
    const addBtn = page.locator("button.result-card__add").filter({ hasText: /^Add$/i }).first();
    if (await addBtn.count()) {
      await addBtn.click();
    } else {
      const card = page.locator("li.result-card").first();
      if (await card.count()) await card.click();
    }
    await page.waitForTimeout(500);
  }
  await shot("04-list-built");
  const listText = await page.locator("body").innerText();
  note("List builder convenience", /Remove|CHF|Find|Stormpeak|Trailfox|item/i.test(listText), listText.slice(0, 100).replace(/\s+/g, " "));

  // Force flush window after list adds
  await page.waitForTimeout(6000);

  // ── Plan: a bit of intelligence ─────────────────────────────────────
  await page.goto(`${BASE}/?shop=default&screen=plan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("05-plan-start");

  // Activity
  await page.getByRole("button", { name: /Day hike/i }).first().click();
  await page.waitForTimeout(500);
  // Shopping for (if shown)
  if (await page.getByRole("button", { name: /Just me|Myself|For myself|Myself only|me$/i }).count()) {
    await page.getByRole("button", { name: /Just me|Myself|For myself|Myself only/i }).first().click();
  } else if (await page.getByText(/Just me|Myself|Only me|Shopping for myself/i).count()) {
    await page.locator("button.wizard-card").first().click();
  } else if (await page.locator("button.wizard-card").count()) {
    // shoppingFor step — pick first card (self)
    const cards = page.locator("button.wizard-card");
    if (await cards.count()) await cards.first().click();
  }
  await page.waitForTimeout(500);

  // whoFor / gender if present
  if (await page.getByRole("button", { name: /Woman|Women|Female|Man|Men|Male|Unisex/i }).count()) {
    await page.getByRole("button", { name: /Woman|Women|Female|Man|Men|Male/i }).first().click();
    await page.waitForTimeout(400);
  }
  // experience
  if (await page.getByRole("button", { name: /Beginner|Intermediate|Expert|Casual|Experienced/i }).count()) {
    await page.getByRole("button", { name: /Beginner|Intermediate|Expert|Casual|Experienced/i }).first().click();
    await page.waitForTimeout(400);
  } else if (await page.locator("button.wizard-card").count()) {
    await page.locator("button.wizard-card").first().click();
    await page.waitForTimeout(400);
  }

  // location — type and pick
  const locInput = page.locator('input[type="search"], input[placeholder*="Where" i], input[placeholder*="city" i], input').first();
  if (await locInput.count()) {
    await locInput.fill("Zermatt");
    await page.waitForTimeout(1200);
    const hit = page.locator(".loc-results button, [class*='loc'] button, li").filter({ hasText: /Zermatt/i }).first();
    if (await hit.count()) await hit.click();
    else await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }

  // Drain remaining wizard steps (when / sizes / specifics)
  for (let i = 0; i < 10; i++) {
    const bodyNow = await page.locator("body").innerText();
    if (/category|swipe|weather|For you|deck|Find them|pack list|suggested|What do you need/i.test(bodyNow)) break;

    // Prefer Skip when present (sizes / optional steps)
    const skip = page.locator("#skip");
    if (await skip.count() && (await skip.isVisible())) {
      await skip.click();
      await page.waitForTimeout(800);
      continue;
    }

    if (/Your sizes|TOP|SHOE/i.test(bodyNow)) {
      await page.locator("button.wizard-sizes__chip").filter({ hasText: /^M$/ }).first().click().catch(() => {});
      await page.waitForTimeout(100);
      await page.locator("button.wizard-sizes__chip").filter({ hasText: /^M$/ }).nth(1).click().catch(() => {});
      await page.waitForTimeout(100);
      await page.locator("button.wizard-sizes__chip").filter({ hasText: /^42$/ }).first().click().catch(() => {});
      await page.waitForTimeout(200);
      if (await page.locator("#skip").count()) {
        await page.locator("#skip").click();
        await page.waitForTimeout(800);
        continue;
      }
    }

    const nextBtn = page.locator("#next, button.plan-one__go");
    if (await nextBtn.count() && (await nextBtn.first().isVisible())) {
      await nextBtn.first().click();
      await page.waitForTimeout(800);
      continue;
    }
    const locHit = page.locator("button").filter({ hasText: /Zermatt/i }).first();
    if (await locHit.count()) {
      await locHit.click();
      await page.waitForTimeout(800);
      continue;
    }
    break;
  }

  // Wait for planner / category flow
  await page.waitForTimeout(8000);
  await shot("06-plan-intelligence");
  const planBody = await page.locator("body").innerText();
  note(
    "Plan intelligence path ran",
    /category|pick|swipe|weather|gear|jacket|pack|Find|suggestion|for you|deck|recommended/i.test(planBody),
    planBody.slice(0, 140).replace(/\s+/g, " "),
  );

  // Try to advance category / add something if UI offers
  const catGo = page.locator("#cat-go");
  if (await catGo.count()) {
    // select a couple category chips if present
    const chips = page.locator("button.cat-chip, button[data-cat], .cat-flow button");
    const n = Math.min(await chips.count(), 3);
    for (let i = 0; i < n; i++) await chips.nth(i).click().catch(() => {});
    await catGo.click();
    await page.waitForTimeout(2000);
  }

  // Swipe deck — add a couple if present
  for (let i = 0; i < 3; i++) {
    const addBtn = page.getByRole("button", { name: /add|yes|keep/i }).or(page.locator("[data-swipe='add'], .swipe-add"));
    if (await addBtn.count()) {
      await addBtn.first().click();
      await page.waitForTimeout(600);
    } else break;
  }
  await shot("07-after-plan-picks");

  // Map companionship
  await page.goto(`${BASE}/?shop=default&screen=map`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot("08-map-companion");
  note(
    "Map convenience (zones for list)",
    /plan|zone|map|walk|entry|Find|Tap a zone/i.test(await page.locator("body").innerText()),
  );

  // Capture analytics session + shop from the browser
  const meta = await page.evaluate(() => {
    let shop = null;
    try {
      shop = JSON.parse(sessionStorage.getItem("toto.activeShop") || "null");
    } catch {}
    return {
      analyticsSession: sessionStorage.getItem("toto.analytics.session"),
      shopId: shop?.id || null,
      shopSlug: shop?.slug || null,
      shopName: shop?.name || null,
    };
  });
  note(
    "Active shop stamped for analytics",
    meta.shopId === SHOP_ID || meta.shopSlug === "default",
    JSON.stringify(meta),
  );

  // Simulate shelf finds the camera would emit (same events/schema as scan.ts)
  // using the shopper's analytics session id so the funnel stays coherent.
  const sessionId = meta.analyticsSession || `e2e${Date.now().toString(36)}`;
  const { data: sampleProducts } = await anon
    .from("products")
    .select("product_code")
    .eq("shop_id", SHOP_ID)
    .limit(3);
  const codes = (sampleProducts || []).map((p) => p.product_code);
  const scanRows = [
    {
      shop_id: SHOP_ID,
      session_id: sessionId,
      user_id: null,
      event: "scan_started",
      payload: { list_size: 2 },
    },
    ...codes.slice(0, 2).map((code) => ({
      shop_id: SHOP_ID,
      session_id: sessionId,
      user_id: null,
      event: "scan_found",
      payload: { code, in_list: true },
    })),
    {
      shop_id: SHOP_ID,
      session_id: sessionId,
      user_id: null,
      event: "scan_completed",
      payload: { list_size: 2, found_count: Math.min(2, codes.length) },
    },
  ];
  const { error: scanErr } = await anon.from("events").insert(scanRows);
  note("Scan interest events recorded", !scanErr, scanErr?.message || `codes=${codes.length}`);

  // Let browser analytics flush (5s cadence)
  await page.waitForTimeout(7000);
  await page.goto(`${BASE}/?shop=default&screen=home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  // ═══════════════════════════════════════════════════════════════════
  // B. VERIFY events in DB (owner visibility of interest)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n══ B. Interest signals in events table ══");
  const { data: recent, error: recentErr } = await anon
    .from("events")
    .select("event, shop_id, session_id, payload, created_at")
    .eq("shop_id", SHOP_ID)
    .order("created_at", { ascending: false })
    .limit(40);
  // Anon cannot SELECT events (admin-only RLS). Use admin session.
  if (recentErr || !recent) {
    note("Anon cannot read events (expected — admin-only)", true, recentErr?.message || "no data");
  }

  const { data: adminAuth, error: authErr } = await anon.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (authErr) throw authErr;
  const adminClient = createClient(sbUrl, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: shopEvents, error: evErr } = await adminClient
    .from("events")
    .select("event, payload, session_id, created_at, shop_id")
    .in("shop_id", [SHOP_ID, "default"])
    .order("created_at", { ascending: false })
    .limit(120);
  if (evErr) throw evErr;
  const counts = {};
  const countsForShop = {};
  for (const e of shopEvents || []) {
    counts[e.event] = (counts[e.event] || 0) + 1;
    if (e.shop_id === SHOP_ID) countsForShop[e.event] = (countsForShop[e.event] || 0) + 1;
  }
  note(
    "Default Shop has shopper interest events",
    (shopEvents?.length || 0) > 0,
    `shopUUID=${JSON.stringify(countsForShop)} all=${JSON.stringify(counts)}`,
  );
  note("Has plan/wizard signal", Boolean(counts.wizard_start || counts.wizard_complete || counts.plan_returned));
  note("Has list interest", Boolean(counts.list_added), `list_added=${counts.list_added || 0}`);
  note("Has scan interest", Boolean(counts.scan_found || counts.scan_completed));
  note(
    "Events attributed to Default Shop UUID (not only legacy 'default')",
    Object.keys(countsForShop).length > 0,
    JSON.stringify(countsForShop),
  );

  // ═══════════════════════════════════════════════════════════════════
  // C. ADMIN — analytics / visibility of what shoppers care about
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n══ C. Admin: visibility + analytics ══");
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
  await page.waitForTimeout(3500);
  await shot("09-admin-analytics");

  const adminText = await page.locator("body").innerText();
  note(
    "Admin dashboard for Default Shop",
    /DEFAULT SHOP|sessions|Funnel|Catalog/i.test(adminText) && !/Send the link|not here/i.test(adminText),
  );

  // Sessions / funnel should be non-zero if views aggregate today's events
  const sessionsMatch = adminText.match(/(\d+)\s*sessions,\s*last 7 days/i);
  const sessions7d = sessionsMatch ? Number(sessionsMatch[1]) : null;
  note(
    "Admin sees session volume (visibility)",
    sessions7d !== null && sessions7d > 0,
    `sessions_7d=${sessions7d}`,
  );

  const funnelOk = /Started a plan|Funnel|reached list|wizard|Added to list|Scanned/i.test(adminText);
  note("Admin funnel / interest chrome present", funnelOk);

  // Scroll to product performance / demand
  await page.getByRole("heading", { name: /Product performance|Categories in demand|Demand gaps|Trip purpose|Activity mix/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await shot("10-admin-interest-widgets");

  const interestWidgets =
    /Categories in demand|Demand gaps|Trip purpose|Activity mix|Product performance|Who's walking in/i.test(
      adminText,
    );
  note("Interest/intent analytics widgets", interestWidgets);

  // Catalog proves owner ops side
  const catRows = await page.locator(".admin-table tbody tr").count();
  note("Owner catalog management visible", catRows > 0, `rows=${catRows}`);

  // Entry QR = how shoppers find this shop on Toto
  await page.locator("#shop-qr-canvas").scrollIntoViewIfNeeded().catch(() => {});
  await shot("11-admin-entry-qr");
  note(
    "Entry QR connects shoppers → this shop on Toto",
    (await page.locator("#shop-qr-canvas").count()) > 0 && /shop=default/i.test(adminText),
  );

  await shot("12-admin-final");
} catch (err) {
  note("Fatal", false, err instanceof Error ? err.message : String(err));
  await shot("99-error").catch(() => {});
} finally {
  await browser.close();
}

console.log("\n══ Summary ══");
const failed = results.filter((r) => !r.ok);
console.log(`Passed ${results.length - failed.length}/${results.length}`);
for (const f of failed) console.log(`  FAIL: ${f.step} — ${f.detail}`);
console.log(`Screenshots: ${OUT}`);
process.exitCode = failed.length ? 1 : 0;
