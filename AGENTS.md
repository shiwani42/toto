# AGENTS.md — Toto project brief

> Live document. Any coding agent opening this repo should read this file first, then **[`HANDOFF.md`](./HANDOFF.md)** for current ops status (migrations, env, what's deferred). Latest entries at the bottom of the [Changelog](#changelog).

## Project

**Toto** — multi-tenant in-store AI concierge for outdoor retail. The shopper stands in front of a wall of jackets / boots / tents and the app helps them collapse 250+ SKUs into the 2–3 right ones — without talking to staff. Opens from an entry QR; no install.

**Scanning:** `zxing-wasm` (+ optional native `BarcodeDetector`) with a custom AR overlay and find-list carousel. No license key, no domain allow-list. (Early builds used Scandit; that path is parked — see changelog 2026-06-23.)

**Ops source of truth:** [`HANDOFF.md`](./HANDOFF.md). This file is product history + architecture; HANDOFF is what to do next on the live Supabase / Render project.

## Versioning strategy (shipped)

We staged as v1 → v2 → v3. **All three product layers shipped**; the platform is now multi-tenant (shops, admin, analytics).

### v1 — shopper with a list (shipped)

1. **Entry QR → web app** (`/?shop=<slug>` when multi-tenant).
2. **Enter requirements** — search / demo list / plan output.
3. **Navigate to location** — zones A–G on the shop map (or bundled `store-map.png`) with pins.
4. **At the shelf, scan** — camera + `zxing-wasm`; green dots on list matches; carousel ticks items off; beep + haptic.
5. **Done** — found vs missing; optional zone loop to the next area.

### v2 — trip plan → list (shipped)

`?screen=plan` — wizard → Open-Meteo weather → Claude (or heuristic) → swipe deck → list.

### v3 — small lenses (shipped)

Price Decoder, Repair vs Replace, Twin Shopper (Connect + votes), Fit Check. Shelf Lens (filter-based MatrixScan-style browse) stays **parked**.

## The deliverable is a demo video

Submission mindset: **working app + video walkthrough**. Ask: *will this read on camera in 60 seconds?*

- Demo assets: `data/sample-barcodes.pdf`, `data/products.json`, and optionally `npm run demo-shelf` → `data/demo-shelf.html` (printable A4 of ~12 EAN-13 barcodes).
- Web-based (no install) is a feature — open via QR.
- End-to-end on camera: list → map → scan → done (or plan → swipe → list).
- Target ≤ 2 min; `video.mp4` at repo root when recorded.

**Demo shelf:** `npm run demo-shelf` generates `data/demo-shelf.html` (bwip-js). Print A4, tape at eye height. Default pick prefers waterproof under 400 g, then fills to 12 unique EAN-13 SKUs.

## Repo layout

The Vite app lives at repo root — no `app/` wrapper.

```
Toto/
├── AGENTS.md                 ← you are here (product / history)
├── HANDOFF.md                ← ops source of truth for agents
├── README.md                 ← user-facing overview
├── render.yaml               ← Render Static Site blueprint
├── index.html, package.json, tsconfig.json, vite.config.ts
├── .env                      ← optional VITE_SUPABASE_* / VITE_ANTHROPIC_API_KEY — gitignored
├── .env.example
├── public/
├── scripts/
│   └── make-demo-shelf.mjs   ← printable EAN-13 shelf (npm run demo-shelf)
├── src/
│   ├── main.ts               ← query-string router + tab bar
│   ├── style.css
│   ├── screens/              ← one module per ?screen=…
│   ├── lib/                  ← catalog, shops, scanner, auth, …
│   ├── integrations/         ← ai-planner, weather
│   └── fixtures/             ← repair-programs
├── data/                     ← products.json, sample-barcodes.pdf, store-map.png, demo-shelf.html
├── supabase/migrations/      ← 0001 … 0007
├── docs/                     ← ideas-bank, barcode-sdk-alternatives, archived Scandit notes
├── body-measurements/        ← submodule (parked)
└── frontend-reference/       ← design reference — read-only
```

### Where to put new code

| Adding… | Goes in |
|---|---|
| A new screen (`?screen=foo`) | `src/screens/foo.ts` + register in `src/main.ts` + `Screen` in `src/lib/types.ts` |
| A new external API wrapper | `src/integrations/<name>.ts` |
| A new fixture / lookup table | `src/fixtures/<name>.ts` |
| A new domain primitive | `src/lib/<name>.ts` |

## Scanner (current)

`src/lib/scanner.ts` — camera stream + `zxing-wasm` decode + optional `BarcodeDetector`. Symbologies: EAN-13, EAN-8, UPC, QR, Code128, Code39, Data Matrix. Scan / compare / repair / browse / smoke all share this wrapper. Overlay + carousel live in `src/screens/scan.ts`.

Archived Scandit research: `docs/barcode-sdk-alternatives.md`, `docs/scandit-web-sdk.md` (historical only).

## Architecture (shopper + shops)

**Catalog:** `src/lib/catalog.ts` — in-memory `Map`; primed from Supabase when `?shop=<slug>`, else bundled `products.json`. Sync getters for screens.

**Shops:** `src/lib/shops.ts` — active shop in sessionStorage; `fetchShopBySlug`, `fetchAllShops` (directory), `fetchShopsNear`, admin helpers. Screens: `shops`, `nearby`, `shop-onboarding`, `admin`.

**Auth / admin:** magic link via Supabase; admin = legacy `admins` or `shop_admins`.

**AI:** optional `VITE_ANTHROPIC_API_KEY` for plan + Fit Check; weather via Open-Meteo (no key).

Full tables / migration checklist: [`HANDOFF.md`](./HANDOFF.md).

## Build phases (status)

v1–v3 product phases and multi-tenant finalize are **done** in code. Human still applies Supabase migrations + Render env (HANDOFF §4). Optional: record `video.mp4`.

Demo shelf script (old Phase 5): **done** — `npm run demo-shelf`.

## Decisions made

| Decision | Choice | Why |
|---|---|---|
| Stack | Vite + TypeScript, vanilla DOM | Lightest path; ESM-native; trivial Render deploy |
| Framework | none | Imperative camera UI; no React needed |
| Scanner | zxing-wasm | Apache 2.0; no license / allow-list |
| Backend | Supabase (optional for local demo) | Auth, Realtime, shops, catalog, analytics |
| Hosting | Render Static Site | Free HTTPS; `render.yaml` |
| Catalog fallback | Bundled `products.json` | Works offline / without shop context |
| Symbologies | EAN-13, QR, Code128 (+ extras) | Catalog + demo-book SKUs |

## Open questions / parked

- **Shelf Lens** — filter-based browse; parked (HANDOFF §5).
- **Demo video** — still to record.
- **body-measurements submodule** — parked; Fit Check uses Claude Vision.

## Working agreements

- **Secrets** — never paste env keys into chat, commits, or screenshots. Use `.env` (gitignored); template in `.env.example`.
- **Commits** — small, descriptive. Never credit AI tools as author, committer, or `Co-authored-by:`; use the human's configured git identity only.
- **`data/`** — catalog + demo assets; treat as fixtures.
- **`body-measurements/`** — submodule; don't edit in place.
- **Ops** — follow [`HANDOFF.md`](./HANDOFF.md) before inventing platform workarounds.

## Changelog

- **2026-06-19** — Initial AGENTS.md. Two features (Shelf Lens, Find My Product) mapped to Scandit primitives. Build phases drafted. No code yet — `app/` directory not created. Next step: Phase 0 scaffold.
- **2026-06-19 (later)** — Added the **demo-video constraint** as a top-level section: deliverable is `video.mp4` at repo root, must use Scandit's sample dataset (PDF + products.json), must show end-to-end app interaction. Plan: generate an extra A4 sheet of printed EAN-13 barcodes from products.json so we can demo *"waterproof shells under 400g"* (the headline filter) — added as a Phase 5 task. Storyboard drafted: ≤2 min, one phone take, Shelf Lens → Find My Product.
- **2026-06-19 (Phase 0 done + scope refined to v1/v2/v3)** — User clarified the staging:
    - **v1** = the "certain shopper with a list" flow: QR → enter list → navigate to zone → scan shelf → highlight matches. Pure Scandit BarcodeFind + a small navigation step. The two-features framing (Shelf Lens / Find My Product) was simplified to one unified flow.
    - **v2** = "shopper with an end goal but no list": trip plan → AI-generated checklist → drop into v1.
    - **v3** = small lenses on top (Price Decoder, Repair vs Replace, Twin Shopper) — no heavy new tech, solve real shopper pains, demo well.
    Phase plan rewritten to match. **Shelf Lens (filter-based scanning) is parked** — not in v1; may reappear inside v2 or v3 if it earns its keep.
    Phase 0 scaffold complete: Vite + TS + Scandit @ 8.4.0 + license key wired. Smoke-test `npm run build` green (97 KB gzipped bundle). Code uses the 8.x API (`DataCaptureContext.forLicenseKey`, `Camera.pickBestGuess`) — see "Scandit 8.x API delta" section.
    Next: Phase 1 — catalog loader + list builder.

- **2026-06-19 (v1 complete + deployed)** — Phases 1-3 done and live on Render.
    - **Phase 1 (catalog + list builder)**: `src/types.ts`, `src/catalog.ts` with `Map<barcode, Product>` + lowercased haystack for substring search, `src/list.ts` with sessionStorage, `src/screens/list-builder.ts` with debounced search + chip view + Continue. Tiny query-string router in `main.ts` (`?screen=list|map|scan|done|smoke`). User caught a search bug: "boot size 42" missed because "size" wasn't in any field — fixed by enriching the haystack with `size <s>` and adding a stopword strip.
    - **Phase 2 (map navigation)**: `src/screens/map.ts` renders `store-map.png` with absolute-positioned pulsing pins on each zone the user's items live in. Zones sorted by recommended walking path (A → B → C → F → D → E → G, the red dashed arrow on the map). Per-zone cards below the map list the items. CTA goes to scan.
    - **Phase 3 (BarcodeFind + done)**: `src/screens/scan.ts` configures the 8.x SDK (`forLicenseKey`, `pickBestGuessForPosition(WorldFacing)`), adds a `CameraSwitchControl`, builds `BarcodeFindItem[]` from the list, mounts `BarcodeFindView`. Workaround: `BarcodeFindView.createWithSettings()` in 8.4.0 doesn't auto-register the custom element — we call `(BarcodeFindView as any).register()` first or scans fail with "setTorchAvailable is not a function". `didTapFinishButton` stashes found codes in sessionStorage and routes to `?screen=done`. `src/screens/done.ts` splits into found vs missing groups.
    - **Render deploy**: configured via `render.yaml` blueprint (static site named `toto`, `npm install && npm run build` at repo root, publish `dist/`, SPA rewrite, long cache on `/assets/*`). Env var `VITE_SCANDIT_LICENSE_KEY` set via the Render UI. Bundle ID for the Scandit license must match the deploy hostname (subdomain TBD on next blueprint apply).
    - **Demo helper**: "Load demo list" button on list-builder pre-fills 8 items that are *guaranteed* in `sample-barcodes.pdf` (1 trail shoe, 1 mid boot, 1 hiking shoe, 2 wearit socks, knitted hoodie, 3/4 sleeve T-shirt, short sleeve V-neck). Cross-verified against the PDF pages.
    - Next: v2 (trip plan → AI gear list), v3 (compare, repair, connect).

- **2026-06-19 (v2 + v3 shipped)** — All four innovation features pushed and live.
    - **v2 — agentic AI planner (`?screen=plan`)**:
        - `src/weather.ts` wraps Open-Meteo (free, no API key) — geocoding + daily forecast (temp range, precip, snow, wind, sunrise/sunset).
        - `src/ai-planner.ts` runs a Claude tool-use loop (`claude-haiku-4-5`). Model gets a `get_weather_forecast` tool. It calls the tool with location + days from the trip text, reads the actual forecast back, then picks 4-8 catalog items grounded in the live conditions. Falls back to a keyword heuristic when `VITE_ANTHROPIC_API_KEY` isn't set.
        - `src/screens/plan.ts` shows progress ("Checking the forecast for Zermatt…"), a weather card with the live data, then the gear list with one-sentence reasoning that references the forecast verbatim. This is the *Smart AI implementation* judging-criterion hit.
    - **v3.1 — Price Decoder (`?screen=compare`)**: scan two products into slots A and B. `src/screens/compare.ts` runs a heuristic explainer over the catalog diff: material (40 %), waterproof rating (18 %), temp rating (15 %), weight (12 %), extra features (10 %), residual → brand premium. Card shows where the price gap goes.
    - **v3.2 — Repair vs Replace (`?screen=repair`)**: `src/repair-programs.ts` is a per-brand lookup (Nordfjell ReFit, Pinewild Mended, Glaronia Loop, Steinbock Bench, Alpitec Tune, wearit Cycle) modeled after Patagonia Worn Wear / Arc'teryx ReBird in shape. Scan a product → card with program name, repair cost bands, turnaround, perk, and a Repair / Either / Replace recommendation from `medianRepair / newPrice` ratio.
    - **v3.3 + v3.4 — Connect (`?screen=connect`, `?screen=connected`)**: realtime multi-user sessions. **Family** mode = multiple in-store shoppers sharing a code (FAM-XXXX); **Partner-at-home** mode = one in store, one remote (PAR-XXXX). `src/session.ts` is a Supabase Realtime wrapper — presence (`name`, `emoji`, `zone`) + a `session-event` broadcast (`list:added`, `list:removed`, `scan:found`, `vote`, `chat`). `src/list.ts` best-effort-broadcasts list mutations when a session is active. `src/screens/connect.ts` = create/join lobby; `src/screens/connected.ts` = roster + activity feed + chat + invite-share. Requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars (Supabase Publishable key — `sb_publishable_...` — works in the ANON_KEY slot under the new naming).
    - **Accessibility pass**: `src/prefs.ts` for localStorage prefs + TTS announcer; `src/screens/settings.ts` exposes high-contrast, larger text (+25 %), reduce motion, speak-scan-results, top/bottom/shoe sizes. CSS adds `:root[data-high-contrast]` / `[data-large-text]` / `[data-reduce-motion]` overrides plus visible focus rings and a skip-link. Scan flow uses `announce()` on Finish.
    - **Fit Check (`?screen=fit`)**: photo (opt-in, ephemeral) → Claude Vision (`claude-haiku-4-5`, base64 inline image) → estimated top/bottom/shoe sizes + reasoning + silhouette notes. Saved into prefs as `sizeSource: "fit-check"`. Photo is compressed client-side, sent once, dropped. The `body-measurements/` Python submodule is parked as the "production" target — it can't run in the browser; we explicitly chose Claude Vision for the in-browser path.
    - All entry points linked from the list-builder header: `search · plan · compare · repair · connect · fit check · ⚙ settings`.

- **2026-06-20 (rebrand + restructure)** — Project renamed to **Toto**. Repo flattened and reorganized:
    - Old paths `nightiangles.*` / `TrailMate` removed across README, AGENTS, app source, frontend-reference, render.yaml. Storage keys renamed (`nightiangles.list` → `toto.list`, etc.) — existing user sessions/preferences are wiped on first load after deploy.
    - Vendor folder `scandit-challenge/` removed. Dataset moved to top-level `data/` (`products.json`, `sample-barcodes.pdf`, `store-map.png`, `README.md`). The two import paths into the old location were updated.
    - `Ideas_bank.txt` → `docs/ideas-bank.md`. `florence-nightingale.jpg` (mascot for the old name) deleted.
    - **App flattened to repo root** — `app/` wrapper gone. `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `public/`, `src/` now live at root. `render.yaml` lost its `rootDir: app` line. `package.json` renamed `app` → `toto`.
    - **`src/` regrouped by responsibility:** `src/lib/` (catalog, list, session, prefs, types), `src/integrations/` (ai-planner, weather), `src/fixtures/` (repair-programs). `src/main.ts`, `src/style.css`, and `src/screens/` stay at top. All ~30 import statements rewritten.
    - Build green at new root: 424 modules, ~75 KB gzipped JS bundle (unchanged from before).
    - **Action items left for the user:** spin up a new Render service at the chosen subdomain, set the Scandit license `bundleId` to match, copy `VITE_SCANDIT_LICENSE_KEY` (+ optional Anthropic / Supabase keys) into the Render UI.

- **2026-06-23 (post-rebrand: barcode migration + masterpiece polish + multi-tenant pivot)** — Big stretch. See [`HANDOFF.md`](./HANDOFF.md) for the full state.
    - **Scanning stack swapped from Scandit to zxing-wasm** (Apache 2.0, no license key, no allow-list). `src/lib/scanner.ts` wraps `zxing-wasm/reader` + optional native `BarcodeDetector` on supporting browsers. Symbologies unchanged. Removed all Scandit config + license var.
    - **Screens polished** into what the user called the "masterpiece" state: home hero mascot, list with cart bar as a warm-charcoal pill, plan wizard rebuilt as an 8-step per-question flow, map ↔ scan zone-by-zone loop with arrival toast, Toto mascot on Browse / Connect narrating screen state, connected screen simplified to tap-to-copy code + unified stream + chat, admin dashboard rebuilt around a hero KPI + visual funnel.
    - **Multi-person shopping flow**: when `shoppingFor` is family / someone-else, a `party` step captures each person's name + gender + top/bottom/shoe sizes via a slide-up sheet, persists into `prefs.partyMembers`, and the planner text now includes a per-person breakdown so the AI's picks match the actual group. Swipe cards render a "For [name]" tag when the product size + gender match a party member (two-pass heuristic in `matchPartyMember`).
    - **Multi-tenant platform pivot**: three new migrations landed (`0003_shops`, `0004_products`, `0005_shop_assets_storage`). `shops` + `shop_admins` + `products` tables all RLS-scoped; anon reads on shops for cross-shop discovery, admin-only writes. `src/lib/shops.ts` and `src/screens/shop-onboarding.ts` for the signup flow. `src/lib/catalog.ts` refactored around a mutable current-products cache that primes from Supabase when `?shop=<slug>` is in the URL and falls back to the bundled JSON otherwise — **shopper API stayed synchronous, screens didn't change**. Admin gained a Catalog table (seed / CSV import / per-row edit), a Shop settings card with zone-map upload to Supabase Storage. `nearby` screen (Settings → Tools) does cross-shop product search grouped by shop with haversine distance.
    - **Analytics attribution**: `analytics.ts` now stamps the active shop's UUID on every event; legacy 'default' rows still work.
    - **Auth**: `signInWithEmail(email, landingScreen)` bounces the magic link back to any screen; `isAdmin()` accepts legacy `admins` OR any `shop_admins` membership.
    - **Action items left for the user:** run the three new migrations in Supabase, set Site URL + Redirect URLs to the Render origin, confirm `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ANTHROPIC_API_KEY` on Render, then `/?screen=shop-onboarding` → seed the demo catalog → upload a zone map. Full walkthrough in [`HANDOFF.md`](./HANDOFF.md).
    - **Not shipped (deferred to next agent):** admin shop-switcher when the same person owns multiple shops, QR generator for the entry URL, cross-shop entry point on Home, per-shop SQL views (`v_headline_counters` etc.) that filter to a specific shop id instead of relying on RLS aggregation, `zone_positions` map-hotspot editor, per-product `image_url`.

- **2026-07-16 (multi-tenant follow-ups)** — Picked up deferred items from `HANDOFF.md` §3:
    - **Admin shop switcher** — pill row when an owner has multiple shops; `toto.adminShopId` in sessionStorage via `resolveAdminShop` / `setAdminShopId` in `shops.ts`. Catalog + analytics scoped to the selection.
    - **Shop-scoped analytics** — migration `0006_shop_scoped_analytics.sql` adds `shop_id` to aggregation views; admin filters client-side (graceful fallback if migration not applied). Same migration hardens anon `events` insert to real shops or `'default'`.
    - **Entry QR** — Shop settings renders QR via `qrcode` for `/?shop=<slug>`; Download PNG + Print A4 sheet with shop name + Powered by Toto footer.
    - **Home nearby card** — fourth choice when list nonempty and no active shop.
    - **CSV / seed chunking** — upserts in batches of 500 with progress feedback.
    - **Still deferred:** zone-map hotspot editor (`zone_positions`), per-product `image_url`, party-sheet rename, auth flicker fix.
    - **Action items for the user:** run migration `0006` in Supabase (plus any earlier migrations still pending). See `HANDOFF.md` §2.

- **2026-07-16 (finalize — remaining backlog cleared)** — Code-complete for HANDOFF deferred items:
    - **Zone-map hotspot editor** — admin pin placer for A–G / entry / checkout; `shops.zone_positions` JSONB (migration `0007`). `map.ts` consumes shop map URL + pins via `resolveZonePositions`.
    - **Product photos** — `products.image_url`; admin upload to `shop-assets`; swipe deck uses `illustrationForProduct`.
    - **Detail-sheet rename** — `.detail-sheet*` canonical, `.party-sheet*` aliases.
    - **Auth flicker** — `waitForAuthUser()` on admin + shop-onboarding.
    - **Polish** — lazy `qrcode` import; `color-mix` solid fallbacks.
    - **User action:** run migrations `0006` + `0007` (and any earlier ones still pending). Full checklist in [`HANDOFF.md`](./HANDOFF.md). No further required agent backlog for the platform track.

- **2026-07-16 (HANDOFF rewrite)** — Rewrote [`HANDOFF.md`](./HANDOFF.md) as the canonical ops handoff for future agents: one-liner + stack, shipped surface, architecture (shops / catalog / auth / pins), human checklist (migrations `0001`–`0007` + Auth + env + bootstrap), deferred/parked, verify steps, and “Start here”. Keep HANDOFF at repo root; do not delete it.

- **2026-07-16 (polish pass)** — High-impact UX without platform rewrites:
    - Home: active-shop banner + Leave; enter-by-slug when Supabase is configured.
    - Connect: wire `scan:found` broadcasts; Twin Shopper Yes / Maybe / No vote cards on Connected.
    - Admin / onboarding: CSV column guide + sample download; clearer unconfigured checklist.
    - See [`HANDOFF.md`](./HANDOFF.md) §6 for remaining nice-to-haves.

- **2026-07-16 (agent leftovers)** — Shipped remaining agent-doable nice-to-haves:
    - **Shop directory** (`?screen=shops`) — browse / search all shops via `fetchAllShops`; linked from Home (under enter-by-slug) and Settings → Tools.
    - **Demo shelf** — `scripts/make-demo-shelf.mjs` + `npm run demo-shelf` → `data/demo-shelf.html` (A4 printable EAN-13 grid via bwip-js).
    - **Docs** — AGENTS.md scrubbed to zxing-wasm + multi-tenant reality; HANDOFF remains ops source of truth; supabase README + data README dead Scandit env refs cleaned.
    - Human checklist (migrations / Auth / Render env / shop bootstrap) still open — no `.env` or Supabase CLI in agent environment.
