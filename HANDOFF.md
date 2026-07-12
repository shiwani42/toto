# Toto — Handoff

> Read this first if you're picking Toto up mid-flight. It captures the state as of commit **`4412e75`** on `main`, what's shipped, what the human still needs to do outside the code, and what a coding agent should pick up next.

**Also read, in order:** [`README.md`](./README.md) for the product framing, [`AGENTS.md`](./AGENTS.md) for the older changelog and working agreements, and the migrations in [`supabase/migrations/`](./supabase/migrations/).

---

## 1. Where the project is right now

Toto shipped as a single-shop demo (v1 → v3 in `AGENTS.md`) and then pivoted mid-June 2026 into a **multi-tenant platform**: many shops sign up, each manages their own catalog + zone map + admin dashboard, and a shopper can arrive via `?shop=<slug>` at any of them. The shopper-facing UI didn't change during that pivot — everything is behind the same synchronous `getProduct()` / `search()` API, backed by a per-shop cache primed on boot.

Deployed at **https://toto-4xfl.onrender.com/** (Render Static Site, auto-deploy from `main`).

Repo at **https://github.com/shiwani42/toto**.

### Feature surface

| Screen (`?screen=…`) | Audience | Status |
|---|---|---|
| `home` | shopper | done |
| `list` | shopper | done |
| `plan` | shopper | done — 8-step wizard, party support, weather-aware planner |
| `browse` | shopper | done — camera + Toto-narrated messages |
| `map` | shopper | done — map ↔ scan loop, next-stop pulse, arrival toast |
| `scan` | shopper | done — auto-return to map when zone finishes |
| `done` | shopper | done — hero mascot + basket / still-looking split |
| `compare` | shopper | done — deterministic price-diff explainer |
| `repair` | shopper | done — per-brand repair-vs-replace lookup |
| `fit` | shopper | done — Claude Vision size estimator (opt-in photo) |
| `connect` | shopper | done — Start / Join tiles + minimal form |
| `connected` | shopper | done — tap-to-copy code + unified activity stream |
| `settings` | shopper | done — accessibility + size prefs + "Find a shop near you" tool |
| `nearby` | shopper | done — cross-shop product search grouped by shop with haversine distance |
| `admin` | shop owner | done — hero KPI + visual funnel + catalog table with per-row edit + shop-settings + zone-map upload |
| `shop-onboarding` | shop owner | done — magic-link sign-in → name / slug / city form → creates shop + admin row |

### Design language

- Monochrome line icons in `src/lib/icons.ts` for chrome (tab bar, home, connect, admin). Emojis are kept for the plan wizard option cards — the human chose that inconsistency deliberately (see conversation on 2026-06-23).
- Design tokens in `src/style.css` (green accent, warm-charcoal cart bar gradient, `--panel-strong` for soft input fills). Screen-in fade is a 220ms `#app.app-enter` animation, respects `prefers-reduced-motion`.
- Toto mascot SVG in `src/lib/toto.ts`; companion bubble in `src/lib/companion.ts`. Companion is hidden on `scan / compare / repair / fit / connected` (see the `noCompanion` set) — Browse and Connect keep it and route their status text through the new `setTotoText` export.

### Multi-tenant additions (2026-06-23)

- **DB**: three new migrations, in order — `0003_shops.sql` (shops + shop_admins + RLS + `is_shop_admin(uuid)` / `my_shop_ids()` helpers), `0004_products.sql` (per-shop catalog + `v_my_products` + `v_product_availability` views + RLS), `0005_shop_assets_storage.sql` (public `shop-assets` bucket with path-prefix RLS).
- **Catalog runtime**: `src/lib/catalog.ts` now holds a mutable "current" product array with an indexed byBarcode map + haystack. `primeCatalog(shopId)` reads sessionStorage cache synchronously first (10-min freshness, versioned), then does an async Supabase refetch. Falls back to bundled `data/products.json` silently on any failure. `main.ts` invokes it once on boot from `resolveShopContext()`.
- **Analytics**: `src/lib/analytics.ts` stamps events with the active shop's UUID (falls back to `'default'` so legacy dashboards keep working).
- **Auth**: `src/lib/admin.ts` accepts EITHER the legacy `public.admins` allow-list OR any `shop_admins` membership. Magic-link redirect goes to a configurable landing screen (`admin.ts` uses `"admin"`, `shop-onboarding.ts` uses `"shop-onboarding"`).
- **Onboarding**: new `/?screen=shop-onboarding` in `src/screens/shop-onboarding.ts`. Signup flow creates `shops` + owner `shop_admins` rows in one submit.
- **Admin catalog UI**: `src/screens/admin.ts` has three new sections — Shop settings card (name / slug / zone-map upload via Storage), Catalog table (tap a row to open the row editor sheet with price / stock / zone / aisle), plus Seed / Import CSV bulk actions.
- **Cross-shop discovery**: `src/screens/nearby.ts` geolocates the shopper, hits `v_product_availability`, groups by shop with haversine distance. Reached only via Settings → Tools (no shopper-flow UI change).

---

## 2. What you (the human) still need to do

These aren't code — they're one-time platform configuration. Everything below is required for the multi-tenant work to actually function against your Supabase project. Skip any of them and the platform features fail silently or with 500s.

### 2.1 Supabase — run the new migrations

Project → SQL Editor → new query. Paste each file's contents and run. Idempotent, safe to re-run.

1. `supabase/migrations/0003_shops.sql`
2. `supabase/migrations/0004_products.sql`
3. `supabase/migrations/0005_shop_assets_storage.sql`

If your project has never had `0001_profiles.sql` or `0002_events_admin.sql` applied, run those first — the new migrations depend on the `events` table, the `is_admin()` function, and Supabase Storage.

### 2.2 Supabase — fix the magic-link redirect

Project → Authentication → URL Configuration:

- **Site URL** — `https://toto-4xfl.onrender.com` (or whatever your production origin is)
- **Redirect URLs** — add `https://toto-4xfl.onrender.com/**` (double star — allows the app to bounce to `?screen=admin`, `?screen=shop-onboarding`, etc.)

Without this the sign-in email link still points at localhost.

### 2.3 Supabase — verify Storage bucket

Project → Storage. There should be a bucket called `shop-assets`, marked Public. If missing, re-run migration 0005.

### 2.4 Render — verify env vars

Settings → Environment. Confirm all three are set:

- `VITE_SUPABASE_URL` — from Supabase → Project Settings → API
- `VITE_SUPABASE_ANON_KEY` — the anon / publishable key (either `eyJ…` or `sb_publishable_…`)
- `VITE_ANTHROPIC_API_KEY` — for the trip planner + fit-check Vision calls

Render auto-deploys on push to `main`. If you change env vars, do **Manual Deploy → Clear build cache & deploy** to bust the Vite cache.

### 2.5 Bootstrap yourself as a shop owner (first-time)

Two paths — pick one:

- **Through the app**: open `https://toto-4xfl.onrender.com/?screen=shop-onboarding`, sign in with your email, click the magic link, fill the form. The app inserts the `shops` + `shop_admins` rows.
- **Manually in Supabase**: Table editor → `shops` → insert row (`slug`, `name`, `owner_email` = your email). Then `shop_admins` → insert row (`shop_id` = the UUID you just made, `email` = your email, `role` = 'owner').

### 2.6 First-run test walkthrough

Once configured:

1. `/?screen=shop-onboarding` → sign in → create your shop → land on `/?screen=admin&shop=<slug>`.
2. Scroll to **Catalog** → **Seed with demo catalog** — upserts the bundled 249-product JSON into your shop.
3. **Shop settings** → **Upload a zone map** — attach a PNG / JPG / SVG store layout.
4. Tap any catalog row → row editor sheet → change price / stock / zone → Save.
5. Open `/?shop=<your-slug>` in a private tab — you're now shopping at your shop, seeing your Supabase-backed catalog.
6. Add a few items to the list → `/?screen=settings` → **Find a shop near you** — grants geolocation, shows shops carrying your list items with distance + coverage.

---

## 3. What a coding agent should pick up next

These are the known follow-ups, in rough order of impact. Each is scoped to fit inside a single session.

### 3.1 Shop picker for admins who own multiple shops

Right now `mountShopSettings()` and the catalog table use whichever shop UUID comes back first from `v_my_products`. If an admin is on multiple shops, they'll always land on the same one. Add a lightweight shop switcher — a select or pill row at the top of the admin — that stashes the chosen `shop_id` in sessionStorage and re-filters every query. `src/lib/shops.ts` already exports `fetchMyShops()` for this.

### 3.2 Ingestion polish for the catalog

- **CSV import** currently parses in the browser and upserts in one call. For >1k-row catalogs this can time out. Batch the upsert into chunks of ~500 rows with progress feedback.
- **Zone-map hotspot editor** — after upload, let the admin drop pins on the map image to say "zone A is here", "zone B is there". Persist the pin coordinates in a `shops.zone_positions` JSONB. The shopper's `src/screens/map.ts` currently hardcodes zone positions on the bundled `store-map.png` — feed it from the shop row when present.
- **Per-product images** — the `products` table doesn't have an `image_url` column yet. Add one, wire uploads through the same `shop-assets` bucket under `products/<code>.jpg`, and update the swipe deck to render the image next to the product-art SVG fallback.

### 3.3 Publish the shop URL as a QR

The shopper is meant to enter via QR at the shop entrance. Add a "Print your entry QR" panel on the admin (or during onboarding) that generates a QR encoding `https://toto-4xfl.onrender.com/?shop=<slug>` as a downloadable PNG. Cheapest path: import `qrcode` from npm and render into a `<canvas>`. Print-friendly A4 layout with the shop name + a "Powered by Toto" footer.

### 3.4 Cross-shop search entry from the home screen

Right now `nearby` is only reachable via Settings → Tools. When a shopper has items on their list and hasn't picked a shop, the home screen could surface it as a fourth choice card ("Find a shop that has these"). The human's constraint was "no shopper UI changes" during the multi-tenant build — that hold is now released, so this becomes a fair follow-up. Keep it minimal: a card that appears only when `getList().length > 0 && !getActiveShop()`.

### 3.5 Analytics: session attribution for the shop owner

`analytics.ts` stamps `shop_id` on events, but the SQL views (`v_headline_counters`, `v_funnel_daily`, `v_top_categories`, etc.) still aggregate across the admin's readable rows without filtering by the currently-selected shop. Once the shop switcher (§3.1) lands, either:
- add a `where shop_id = ?` filter to each view (requires parametrizing them, which Supabase's Views don't support cleanly) — better as SQL functions returning tables, or
- do the filter client-side after fetch.

### 3.6 Data-privacy audit

The multi-tenant migrations lock down cross-shop reads via RLS. Two things worth double-checking:

- **Anonymous inserts on `events`** are still open (the `events_insert_any` policy). A malicious script could spam events with any `shop_id`. Consider adding a shop-existence check in the policy: `with check (shop_id = 'default' or exists (select 1 from shops where id::text = shop_id))`.
- **`shops` SELECT is fully public** so cross-shop discovery works. Fine for the current field set (name, slug, address, lat/lng, brand color, zone map URL). If you ever add PII-shaped fields (owner phone, revenue), split them into a `shops_private` view with `is_shop_admin()` RLS.

### 3.7 Deferred polish and known issues

- **The "Send sign-in link" button on Settings** was style-neutered when `.btn-primary` didn't exist; now uses `.primary`. Double-check on a real Supabase-configured deploy — this was tested only against the type system.
- **`renderCatalogEditor` uses `class="party-sheet"`** — the sheet component is generic. Consider renaming to `.detail-sheet` (with `.party-sheet-host` as an alias for backward compat) so it doesn't read like it belongs to the party step.
- **Auth session pickup after email-link click** relies on Supabase's default hash-fragment flow. The MutationObserver in `shop-onboarding.ts` remounts the form when the user returns authenticated. This is racy — if the observer fires before `getCurrentUser()` resolves the second time, you get a brief flicker back to the sign-in card. Consider awaiting the `getSession()` promise before rendering the sign-in card at all.
- **`data/products.json`** still ships in the bundle (~600 KB) even for shops that have their own Supabase catalog. It's the fallback, so removing it is not free — but there's ~600 KB of bundle savings to be had if you can prove no code path needs the fallback. Realistically: leave it.
- **The `.plan-skeleton` and `.status` animations both use CSS keyframes** — check on Safari 15 iOS whether `color-mix()` (used in a couple of hover states) degrades gracefully. It was added recently.

---

## 4. Code map for someone new

```
src/
├── main.ts                    ← query-string router + tab bar + shop-context resolver
├── style.css                  ← design tokens + every screen's styles (one big file, intentionally)
├── screens/
│   ├── home.ts                ← 3 choice cards + Toto mascot
│   ├── list-builder.ts        ← search + cart bar + toto-suggested "compare two?"
│   ├── plan.ts                ← the wizard: activity → shoppingFor → party (for family) OR whoFor + sizes (for self) → location → when → specifics → planner → categories → picks / swipe
│   ├── browse.ts              ← "just look around" camera with fallback UI + Toto narration
│   ├── map.ts                 ← zone-by-zone loop, next-stop pulse, arrival toast
│   ├── scan.ts                ← camera + carousel + auto-return on zone complete
│   ├── done.ts                ← in-basket / still-looking split + confetti
│   ├── compare.ts             ← price diff explainer
│   ├── repair.ts              ← repair-vs-replace lookup
│   ├── fit.ts                 ← claude vision size estimate
│   ├── connect.ts             ← start / join tiles + minimal form
│   ├── connected.ts           ← tap-to-copy code + unified stream + chat
│   ├── settings.ts            ← accessibility + sizes + Tools → Find a shop near you
│   ├── nearby.ts              ← cross-shop product search
│   ├── shop-onboarding.ts     ← shop owner signup form
│   ├── admin.ts               ← hero KPI + funnel + demand + catalog + shop settings + zone map
│   └── smoke.ts               ← bare scanner smoke test
├── lib/
│   ├── types.ts               ← Product + Screen union
│   ├── icons.ts               ← monochrome SVG icon set (~40 glyphs)
│   ├── toto.ts                ← mascot SVG generator
│   ├── companion.ts           ← the floating Toto+bubble on shopper screens; setTotoText export
│   ├── catalog.ts             ← Supabase-backed current-products cache with bundled JSON fallback
│   ├── list.ts                ← sessionStorage list + realtime broadcast hooks
│   ├── session.ts             ← Supabase Realtime wrapper
│   ├── prefs.ts               ← localStorage prefs (+ PartyMember type for multi-person shopping)
│   ├── shops.ts               ← shop CRUD + getActiveShop / setActiveShop + fetchShopsNear
│   ├── analytics.ts           ← queued event logger, stamps active shop id
│   ├── auth.ts                ← Supabase magic-link wrapper with landingScreen param
│   ├── admin.ts               ← isAdmin() — legacy OR shop_admins
│   ├── supabase.ts            ← thin client singleton
│   ├── history.ts             ← "you've gone for navy before" remarks
│   ├── colors.ts              ← named-color → hex swatch map (list + scan)
│   ├── sounds.ts              ← Web Audio Toto sound effects
│   ├── voice.ts               ← speech synth + recognition wrapper
│   ├── camera-errors.ts       ← humanized camera error messages
│   ├── product-art.ts         ← per-category SVG illustrations for swipe cards
│   ├── i18n.ts                ← EN / DE / FR / IT strings
│   └── scanner.ts             ← zxing-wasm barcode decoder
├── integrations/
│   ├── ai-planner.ts          ← Claude tool-use loop for the trip planner
│   └── weather.ts             ← Open-Meteo geocode + forecast
└── fixtures/
    └── repair-programs.ts     ← per-brand repair-program lookup

supabase/migrations/
├── 0001_profiles.sql          ← auth-linked profiles table
├── 0002_events_admin.sql      ← anonymous events + is_admin() + aggregation views
├── 0003_shops.sql             ← shops + shop_admins + is_shop_admin() + my_shop_ids() + tightened events RLS
├── 0004_products.sql          ← per-shop products + v_my_products + v_product_availability
└── 0005_shop_assets_storage.sql ← shop-assets bucket + path-prefix RLS

data/
├── products.json              ← 249-product bundled catalog (fallback + seed source)
├── sample-barcodes.pdf        ← printable demo barcodes
└── store-map.png              ← bundled zone map for the demo shop
```

### Routing

- Router is `main.ts::mount()` — a `switch` on `?screen=…`.
- Shop context resolves in `resolveShopContext()` on boot: reads `?shop=<slug>`, calls `fetchShopBySlug()`, caches via `setActiveShop()`, then primes the catalog via `primeCatalog(shopId)`.
- Tab bar is hidden on `admin` and `shop-onboarding` via `document.body.classList.add("no-tab-bar")`.

### Data flow (shopper)

```
?shop=<slug>  →  fetchShopBySlug()  →  setActiveShop(sessionStorage)  →  primeCatalog(shopId)
                                                                              │
                                                                              ├─ read sessionStorage cache (sync)
                                                                              └─ async Supabase refetch, overwrite
                                                                                 ↓
                                                                          setCurrent(list)  →  screens read via getProduct() / search()
```

### Data flow (shop owner)

```
?screen=shop-onboarding  →  magic-link  →  createShop() inserts shops + shop_admins
?screen=admin            →  isAdmin() (legacy OR shop_admins)
                          →  fetch(v_headline_counters, v_funnel_daily, ..., v_my_products) — all shop-scoped by RLS
                          →  catalog row tap → mountCatalogEditor() → PATCH products
                          →  shop settings zone-map upload → Supabase Storage + PATCH shops.zone_map_url
```

---

## 5. Running locally

```bash
git clone --recurse-submodules https://github.com/shiwani42/toto.git
cd toto
cp .env.example .env       # set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ANTHROPIC_API_KEY
npm install
npm run dev                # http://localhost:5173
npm run build              # dist/ — the Render Static Site publishes this
```

**Typecheck** — `npx tsc --noEmit`.

**No lint or formatter configured.** The code uses double quotes for strings, no semicolons enforcement, 2-space indent (matches VSCode's default). If you add a linter, don't run it as a pre-commit hook without asking — a stretch of one-shot commits during the platform build was written without that expectation.

**Verifying a change** — the human's usual loop is: type-check → build → git push → wait for Render → screenshot with `node _screenshots.mjs` (Playwright script at repo root). See the `_audit/` directory for the current screenshot set (fullpage iPhone 11 Pro Max viewport). `_state_shots.mjs` covers the mid-flow states that the plain screenshot pass can't reach (plan wizard steps, connect after-tap, admin sign-in).

---

## 6. Working agreements (the human's stated preferences)

Recorded here so a coding agent doesn't drift. Some are in memory; putting them here too so they survive session resets.

- **No em dashes.** Use commas, colons, periods. Applies to UI copy, prose, comments, chat.
- **Commits do not mention Claude or Anthropic.** No `Co-Authored-By` trailers, no "Generated with Claude Code" footers.
- **Minimalism is the design bar.** Every element earns its place — samples, previews, decorative icons that don't communicate get cut. Line icons for chrome, emojis kept for the wizard's expressive category cards.
- **The two users are named**: the *shopper* (mobile web, in store or planning at home) and the *shop owner* (retail, on the admin dashboard). Every design decision names which user it serves.
- **Don't add features the user hasn't asked for**, but when the user says "go ahead with all", take that as license to be ambitious and only surface the ambiguities that matter.
- **Verification without user intervention is expected**: type-check + build + Playwright screenshots stand in for user testing.

---

## 7. Known caveats + gotchas

- **The `party-sheet` component is used for both party-member and catalog-row editing.** They share styles because the shape is the same (slide-up sheet with pill rows). Fine, just don't be surprised.
- **`sr-only` class** is defined once in `style.css` for the swipe deck's screen-reader progress node — reuse the same class if you need screen-reader-only text elsewhere.
- **`app-enter` animation** is stamped once on `#app` at each route change. If you find yourself adding a second animation on top, layer via a wrapper element.
- **Search query stopwords** in `catalog.ts` are English-only. Multilingual search matches on brand / SKU / size string primarily, which works well enough — but the stopword strip won't help for a French / German query with connective words.
- **Web Audio** in `lib/sounds.ts` needs a user gesture on iOS. All calls happen after tap events, so this is fine — just don't move the wire-up to a mount-time effect.
- **`_debug_*` files at repo root** (e.g. `_debug_when.mjs`) are one-off Playwright investigations. Delete freely when you spot them.

---

## 8. Deferred and never-shipped ideas

From the ideas bank / earlier scoping — parked, not dead:

- **Shelf Lens** (filter-based scanning: "show me waterproof shells under 400g") — was v1's original second feature, then dropped in favor of the list-first flow. Could reappear as a Browse-screen mode.
- **Twin Shopper voting flow** — the partner-at-home mode of Connect currently has presence + chat but no explicit "vote yes / maybe / no" affordance on each product. Was scoped in `AGENTS.md` and never built.
- **Body Measurements submodule** — `body-measurements/` is a Python package for real body-measurement estimation from a photo. The `fit` screen uses Claude Vision instead (which works in the browser). Someday: server-side body-measurements as the accurate path.

---

*Written 2026-06-23, current as of commit `4412e75`. If you edit this, add your name and date so we can see who last touched it.*
