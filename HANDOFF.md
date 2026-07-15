# Toto — Agent Handoff

> **Canonical ops doc for the next agent.** Read this before coding. Product vision / history lives in [`AGENTS.md`](./AGENTS.md); user-facing overview in [`README.md`](./README.md).
>
> **Status (2026-07-16):** Multi-tenant platform track is **code-complete**, plus a polish pass (shop context banner / slug entry, Twin votes, admin CSV help). Remaining work is **human platform config** (Supabase migrations + Auth URLs + Render env + first shop bootstrap).

**Live:** https://toto-4xfl.onrender.com/ · **Repo:** https://github.com/shiwani42/toto

---

## 1. Project one-liner + stack

**Toto** is a multi-tenant in-store AI concierge for outdoor retail. Shoppers open a QR → build / plan a list → navigate zones on a floor map → scan barcodes with camera AR. Shop owners sign up, manage catalog + zone map + pin positions + entry QR, and see per-shop analytics.

| Layer | Choice |
|---|---|
| App | Vite + TypeScript, vanilla DOM (no React) |
| Scanner | `zxing-wasm` (+ optional native `BarcodeDetector`) — **not Scandit** |
| Backend | Supabase (Auth magic link, Postgres + RLS, Storage, Realtime) |
| AI | Anthropic Claude (optional; planner + Fit Check); weather via Open-Meteo |
| Host | Render Static Site (`render.yaml`) |
| Catalog fallback | Bundled `data/products.json` (~249 SKUs) when no `?shop=` |

Env (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANTHROPIC_API_KEY`. All optional for local shopper demos with the bundled catalog.

---

## 2. What is shipped (current capabilities)

### Shopper

| Screen | Capability |
|---|---|
| `home` | Entry chooser; **nearby card** when list nonempty and no active shop; **shop banner** when in a shop; **enter-by-slug** when Supabase is configured |
| `list` | Search / add / demo list; sessionStorage cart |
| `plan` | 8-step trip wizard → weather + Claude (or heuristic) → swipe deck with product photos |
| `browse` | Catalog browse with Toto companion |
| `map` | Zone pins from shop `zone_positions` (or defaults) on shop `zone_map_url` (or bundled map); zone-by-zone → scan loop |
| `scan` / `done` | Multi-barcode camera overlay; found vs missing; **broadcasts `scan:found`** into live sessions |
| `compare` / `repair` / `fit` | Price Decoder, Repair vs Replace, Fit Check (Claude Vision) |
| `connect` / `connected` | Family / partner Realtime sessions (presence, list sync, chat, **Yes/Maybe/No votes**) |
| `settings` / `nearby` | Prefs + accessibility; cross-shop product search by distance |

Shopper context: `/?shop=<slug>` loads that shop's products into the in-memory catalog cache. Without a shop, bundled JSON is used.

### Shop owner

| Screen | Capability |
|---|---|
| `shop-onboarding` | Magic-link signup → create shop (no sign-in flicker via `waitForAuthUser`) |
| `admin` | **Shop switcher** (multi-shop owners); KPIs / funnel; catalog seed + CSV (chunked 500, **column guide + sample download**) + row edit; **zone map upload + pin editor** (A–G / entry / checkout); **entry QR** (download PNG / print A4); **product photo** upload (`image_url`); clearer setup checklist when Supabase is missing |

### Platform / data

- Migrations `0001`–`0007` in repo (human must apply — see §4).
- Analytics events stamped with active shop UUID; views expose `shop_id` after `0006`.
- Storage bucket `shop-assets` for zone maps + product images (`0005`).
- Detail UI: `.detail-sheet*` is canonical; `.party-sheet*` kept as CSS aliases.

---

## 3. Architecture pointers

### Layout

```
src/main.ts              query-string router; resolves ?shop=<slug> → primeCatalog
src/style.css            design tokens + screens
src/screens/             one module per ?screen=…
src/lib/                 domain: catalog, shops, auth, scanner, analytics, …
src/integrations/        ai-planner, weather
src/fixtures/            repair-programs
data/                    products.json, store-map.png, sample-barcodes.pdf
supabase/migrations/     0001 … 0007 (apply in order)
```

### Shops

- `src/lib/shops.ts` — `Shop` type (`zone_map_url`, `zone_positions`, lat/lng, …), `getActiveShop` / `setActiveShop`, `fetchShopBySlug`, `fetchMyShops`, `createShop`, `resolveAdminShop` / `setAdminShopId` (`toto.adminShopId` in sessionStorage).
- Anon can read shops (discovery / nearby). Writes require `shop_admins` membership (RLS).

### Catalog

- `src/lib/catalog.ts` — mutable in-memory `Map`; **sync API** for screens: `getProduct`, `search`, `allProducts`, `zonesForCodes`.
- Boot: `main.ts` calls `fetchShopBySlug` + `primeCatalog(shopId)` when `?shop=` present; otherwise bundled JSON.
- `resetCatalog()` restores bundled data when leaving a shop context.
- Admin upserts hit Supabase `products` (scoped by selected admin shop).

### Auth / admin

- `src/lib/auth.ts` — magic link via `signInWithEmail(email, landingScreen)`; `waitForAuthUser()` / `hasAuthCallback()` kill the post-redirect flicker.
- `src/lib/admin.ts` — `isAdmin()` = legacy `admins` table **or** any `shop_admins` row.
- Admin UI scopes catalog + analytics to `resolveAdminShop(myShops)`.

### Map pins + product art

- `src/lib/zone-positions.ts` — `DEFAULT_ZONE_POS`, `resolveZonePositions(custom)` merges shop JSONB with defaults.
- Shape: `{ zones: { A: {x,y}, … }, entry?: {x,y}, checkout?: {x,y} }` (percent of map image).
- `src/lib/product-art.ts` — `illustrationForProduct` prefers `image_url`, else category art.
- `src/screens/map.ts` — shop map URL + resolved pins.
- `src/screens/admin.ts` — pin placer + QR (lazy `import("qrcode")`) + photo upload.

### Scanner / analytics

- `src/lib/scanner.ts` — zxing-wasm wrapper used by `scan`, `compare`, `repair`, etc.
- `src/lib/analytics.ts` — stamps `shop_id` from active shop (or `'default'`).

### Migrations (what each does)

| File | Purpose |
|---|---|
| `0001_profiles.sql` | Profiles |
| `0002_events_admin.sql` | Events + legacy admin + early analytics views |
| `0003_shops.sql` | `shops`, `shop_admins`, RLS |
| `0004_products.sql` | Per-shop `products` + `v_my_products` |
| `0005_shop_assets_storage.sql` | Public `shop-assets` bucket + policies |
| `0006_shop_scoped_analytics.sql` | Views gain `shop_id`; harden anon `events` insert |
| `0007_zone_positions_image_url.sql` | `shops.zone_positions`, `products.image_url` |

Without `0006`/`0007`: admin still loads (analytics falls back client-side); pin save and `image_url` updates fail until columns exist.

---

## 4. What the human still must do

Code cannot apply these to the remote Supabase / Render project from a typical agent environment.

### Checklist

1. **SQL migrations** (Supabase → SQL Editor), in order if not already applied:
   - [ ] `supabase/migrations/0001_profiles.sql`
   - [ ] `supabase/migrations/0002_events_admin.sql`
   - [ ] `supabase/migrations/0003_shops.sql`
   - [ ] `supabase/migrations/0004_products.sql`
   - [ ] `supabase/migrations/0005_shop_assets_storage.sql`
   - [ ] `supabase/migrations/0006_shop_scoped_analytics.sql`
   - [ ] `supabase/migrations/0007_zone_positions_image_url.sql`

2. **Auth redirect URLs** (Authentication → URL Configuration):
   - [ ] Site URL = `https://toto-4xfl.onrender.com`
   - [ ] Redirect URLs include `https://toto-4xfl.onrender.com/**`
   - [ ] For local magic-link testing: also allow `http://localhost:5173/**`

3. **Storage** — [ ] `shop-assets` bucket exists and is **Public** (re-run `0005` if missing).

4. **Render env vars** — [ ] `VITE_SUPABASE_URL` [ ] `VITE_SUPABASE_ANON_KEY` [ ] `VITE_ANTHROPIC_API_KEY`  
   After changing env: Manual Deploy → Clear build cache & deploy.

5. **Bootstrap a shop** — [ ] `/?screen=shop-onboarding` → magic link → create shop → land in admin.

6. **Smoke walkthrough** — [ ] Seed catalog [ ] Upload zone map [ ] Place zone pins + Save [ ] Entry QR download/print [ ] Edit a product photo [ ] Open `/?shop=<slug>` and walk list → map → scan (use `data/sample-barcodes.pdf`).

---

## 5. Intentionally deferred / parked

Do **not** reopen these unless the human asks:

| Item | Notes |
|---|---|
| **Shelf Lens** | Filter-based MatrixScan-style browse; parked since v1 pivot to list → find |
| **Twin Shopper vote UI** | Shipped thin version: Yes / Maybe / No on Connected when partner sees `scan:found` / `list:added` |
| **`body-measurements/` submodule** | Parked; Fit Check uses Claude Vision in-browser |
| **Scandit** | Fully replaced by zxing-wasm; ignore Scandit-era notes in older AGENTS sections unless updating docs |
| **Bundled `products.json`** | Still ships as fallback (~600 KB) — intentional |

Historical v1–v3 staging and demo-video constraints: see [`AGENTS.md`](./AGENTS.md).

---

## 6. Known gaps / nice-to-haves

No required backlog. Optional polish only:

- Shop directory / browse-all-shops list (beyond slug entry + nearby).
- Demo video (`video.mp4` at repo root) still to be recorded per AGENTS storyboard.
- AGENTS.md still has some Scandit-era wording in early sections; HANDOFF + 2026-06-23+ changelog are authoritative for scanning/stack.

### Shipped 2026-07-16 (polish pass)

- **Active shop banner** on Home (name + Leave shop → reset catalog / clear `?shop=`).
- **Enter shop by slug** on Home when Supabase is configured (complements nearby card + entry QR).
- **Twin Shopper votes** — scan finds broadcast `scan:found`; Connected shows Yes / Maybe / No cards for the partner.
- **Admin CSV guide** — expandable column docs + sample CSV download; stronger unconfigured checklist on admin + shop-onboarding.

Prefer small UX polish or a parked idea in §5 over re-touching the multi-tenant path.

---

## 7. How to verify

```bash
npm install
npm run build          # tsc + vite → dist/  (must be green)
npm run dev            # http://localhost:5173
```

**Key screens (local, no shop):** `/?screen=home` → list (Load demo list) → map → scan with `data/sample-barcodes.pdf`.

**With Supabase configured:**

| Check | URL / action |
|---|---|
| Onboarding | `/?screen=shop-onboarding` |
| Admin | `/?screen=admin` (after magic link) |
| Shopper shop context | `/?shop=<slug>` then list → map → scan |
| Nearby | Settings → Tools → Nearby, or Home nearby card |
| Plan / AI | `/?screen=plan` (needs Anthropic for full path; heuristic works without) |

---

## 8. Start here (next agent)

1. Skim this file + the latest changelog entries in [`AGENTS.md`](./AGENTS.md).
2. Confirm with the human whether migrations `0001`–`0007` and Render env are applied (§4). If not, **do not** invent workarounds that assume columns exist — point them at the checklist.
3. Run `npm run build` before any PR-sized change.
4. If opening new work: ask what they want next. Default bias = small polish or a parked item from §5, not platform refactors.
5. Working agreements: no em dashes in prose we own; no Claude/Anthropic in commit messages; Never add AI as Co-authored-by / committer; don't commit secrets; name actors (shopper vs shop owner); only commit when asked.

### Key files if you touch recent finalize work

```
src/lib/zone-positions.ts
src/lib/product-art.ts
src/lib/auth.ts
src/lib/shops.ts
src/lib/catalog.ts
src/screens/admin.ts
src/screens/map.ts
src/screens/plan.ts
src/screens/home.ts
src/screens/shop-onboarding.ts
supabase/migrations/0006_shop_scoped_analytics.sql
supabase/migrations/0007_zone_positions_image_url.sql
```

---

*Originally written 2026-06-23 · updated 2026-07-16 (finalize + rewrite for future agents). Add your name/date if you edit.*
