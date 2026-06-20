# AGENTS.md — Toto project brief

> Live document. Any coding agent (Claude Code, Codex, Cursor, Copilot, etc.) opening this repo should read this file first. Updated whenever direction shifts. Latest entries at the bottom of the [Changelog](#changelog).

## Project

**Toto** — in-store AI concierge for a Swiss outdoor retailer, built on Scandit scanning + AR. The shopper stands in front of a wall of jackets / boots / tents and our app helps them collapse 250+ SKUs into the 2-3 right ones for their needs — without talking to staff.

**Hard constraint we keep in mind:** *don't reinvent the wheel.* Scandit already ships the hard parts (multi-barcode tracking, AR overlay framework, pre-built BarcodeFindView). We compose, we don't rebuild.

## Versioning strategy

We ship in versions. **v1 = lean on Scandit's existing capabilities** (don't reinvent). **v2+ = our own creative additions** on top. Always finish v1 before opening v2.

### v1 — the base flow (what we're building right now)

The shopper **knows what they want**. They enter the store with a clear list. We help them find it.

1. **Entry QR → web app.** Shopper scans a QR at the store entrance. Web app opens — no install.
2. **Enter requirements.** Shopper enters or picks the items they want (e.g. "the Stormpeak 3L hardshell in M", "Trailrunner Pro size 42"). Could be typed names, picked from a search, or pasted from a shopping list.
3. **Navigate to location.** Using `zone` + `aisle` from `products.json`, the app shows which zones to visit (A–G) overlaid on `store-map.png`. "Your gear is in Zone A (Jackets & Shells) and Zone B (Footwear)."
4. **At the shelf, scan.** Shopper hits "I'm here" → app activates **Scandit BarcodeFind** with the shopper's list pre-loaded as `BarcodeFindItem[]`. Scandit's **pre-built BarcodeFindView** handles the rest:
   - Camera preview
   - Coloured dots over each matched barcode (one camera frame can highlight several at once)
   - Sound + haptic feedback on match
   - A carousel showing items still to find, ticking each one off as it's scanned
5. **Done.** When everything in the zone is ticked off, move to the next zone (or end if only one).

**v1 = mostly Scandit out-of-the-box, glued together with a tiny navigation UI.** No AI, no clever filtering, no recommendation logic.

### v2 — when the shopper doesn't have a list (deferred)

The shopper has an **end goal** ("3-day winter hike in the Swiss Alps, starts March 14") but no shopping list. The app turns the goal into a list, then drops them into the v1 flow.

- LLM-generated checklist from a trip plan (Claude or similar; small prompt → catalog filter → curated list).
- Optional: filter-based discovery on top of MatrixScan AR ("show only waterproof shells under 400g") — the original *Shelf Lens* idea, repurposed for "browse, don't search."

### v3 — small lenses that add real value on top of v1 (deferred)

The constraint: **no new heavy tech.** Each addition is a small UI / data layer on top of the same barcode scanner. Each solves a real shopper pain. Each is demoable in 15 seconds.

- **Price Decoder** (from `Ideas_bank.txt` idea 2). Scan two similar products with a price gap → side-by-side breakdown of where the money goes ("+€80 Gore-Tex Pro vs proprietary, +€60 full-grain leather, +€60 brand premium"). The catalog already has `material`, `brand`, `tags`, `waterproof_rating_mm`, `weight_g` — the diff is a deterministic JS function over two products. Optionally a tiny LLM call for the natural-language copy ("explain why product A costs €200 more than B in one sentence"). **Tech weight: low.**
- **Repair vs Replace** (idea 6). Shopper scans an old worn item they're considering replacing. App looks up the brand's repair program (Patagonia Worn Wear, Arc'teryx ReBird — hardcoded lookup table by brand) and shows: repair cost / turnaround vs full replacement economics. Most shoppers don't know repair is an option until prompted. **Tech weight: low — a JSON lookup + a card UI.**
- **Twin Shopper** (idea 3). Shopper shares a one-shot link to a partner at home. Partner opens it and sees a thumbnail of what was last scanned, with specs and a "yes / maybe / no" set of vote buttons. Vote pings back to the shopper's phone. **Tech weight: medium** (we need a tiny realtime channel — simplest is Supabase Realtime, Pusher, or a small Render Web Service with SSE). If we deploy on Render anyway, this is one route. **Defer to last.**

These compose: a v3 demo can show *scan two boots → Price Decoder card → tap the cheaper one → Repair vs Replace card → twin partner pings approval*. That's a 90-second video addition that reads "this team built layers, not gadgets."

**Order to attempt v3** if we have time after v1 + v2 + a polished demo: Price Decoder → Repair vs Replace → Twin Shopper. The first two are JS-only; Twin Shopper needs a backend.

We won't open v2 until v1 ships and we have a demo video.

## The deliverable is a demo video

The submission is **a working app + a video walkthrough**. Treat the video as a hard constraint, not an afterthought. Every build decision should ask: *will this read on camera in 60 seconds?*

**Video constraints baked into the plan:**

- The demo must use **the Scandit-provided sample dataset** — `data/sample-barcodes.pdf` and `data/products.json`. No physical store available.
- The person on screen is the user **interacting with the app on their phone**. Web-based (no install) is a feature, not a bug — open via QR code, no friction.
- The app must work **end-to-end** in the video: pick filter → see matches light up → tap one → see detail. Or: load checklist → point camera → watch items check off → finish.
- Don't ship anything that requires camera angles we can't fake on a desk.

**Demo-asset prep — read before Phase 5:**

- The bundled `sample-barcodes.pdf` covers 22 demo-book SKUs (9 shoes with QR codes, 10 socks + 3 tops with Code128). It does **not** cover the EAN-13 jacket / tent / sleeping-bag catalog.
- For Shelf Lens to look impressive, we need a "shelf" of 8-12 visible barcodes representing different products. Two options:
  1. **Use the PDF alone** — lay the 3 demo-book pages flat (shoes + socks + tops). Filter is something like *"trail shoes in size 42"*. Works without extra prep.
  2. **Generate extra EAN-13 barcodes** from `products.json` (e.g. with Python `python-barcode` or `bwip-js` in the browser). Print one A4 sheet of ~12 jackets/boots arranged like a shelf. Filter is *"waterproof shells under 400g"* — much closer to the brief's example.
- **Recommendation:** do option 2. It matches the headline filter ("waterproof shells under 400g") and demos better. A 30-line script generates the print sheet from products.json.

**Demo storyboard draft (refine as we build):**

1. **0:00–0:10** — Phone shows the store entrance QR code. Tap. App loads with mode chooser ("Shelf Lens", "Find My Product").
2. **0:10–0:35** — *Shelf Lens.* User selects filter chips: `waterproof` + max weight 400g. Camera frames a printed "shelf" of jackets. 3 jackets light up green; 7 stay dim. User taps one — popover with name, price, stock.
3. **0:35–0:55** — *Find My Product.* User switches mode. Shows a 5-item checklist on the screen. Points camera at the same shelf. Dots appear over each match; carousel ticks off items one by one. Finish button.
4. **0:55–1:00** — Brief tag line / next steps.

> Target ≤ 2 min total (under GitHub's 100 MB threshold), single take where possible. **`video.mp4` goes at repo root** per the challenge README.

## Repo layout

The Vite app lives at repo root — no `app/` wrapper.

```
Toto/
├── AGENTS.md                 ← you are here
├── README.md                 ← user-facing repo overview
├── render.yaml               ← Render Static Site blueprint
├── index.html                ← Vite entry
├── package.json, tsconfig.json, vite.config.ts
├── .env                      ← VITE_SCANDIT_LICENSE_KEY (+ optional VITE_ANTHROPIC_API_KEY, VITE_SUPABASE_*) — gitignored
├── .env.example              ← template
├── public/                   ← favicon, icons (copied as-is)
├── src/
│   ├── main.ts               ← query-string router + tab bar
│   ├── style.css             ← design tokens + component CSS
│   ├── screens/              ← one module per ?screen=… route
│   ├── lib/                  ← domain primitives (catalog, list, session, prefs, types)
│   ├── integrations/         ← external API wrappers (ai-planner → Anthropic, weather → Open-Meteo)
│   └── fixtures/             ← static data tables (repair-programs)
├── data/                     ← catalog + demo assets
│   ├── README.md             ← full dataset schema + zone map (READ THIS)
│   ├── products.json         ← 249 product variants — imported by src/lib/catalog.ts
│   ├── sample-barcodes.pdf   ← 3 demo-book pages, scannable
│   └── store-map.png         ← floor plan, zones A–G — imported by src/screens/map.ts
├── docs/
│   ├── scandit-web-sdk.md    ← indexed reference for the Scandit Web SDK (covers 7.6.14; we use 8.4.0)
│   └── ideas-bank.md         ← original direction-setting writeups (read for context)
├── body-measurements/        ← submodule (farazBhatti/Human-Body-Measurements-…). Parked; could feed a Fit-Translator extension.
└── frontend-reference/       ← design reference (React/Tailwind prototype) — read-only, do not run
```

### Where to put new code

| Adding… | Goes in |
|---|---|
| A new screen (`?screen=foo`) | `src/screens/foo.ts` + register in `src/main.ts` |
| A new external API wrapper | `src/integrations/<name>.ts` |
| A new fixture / lookup table | `src/fixtures/<name>.ts` |
| A new domain primitive (storage, types, shared state) | `src/lib/<name>.ts` |

## Scandit primitives we lean on (v1)

Anchors point into `docs/scandit-web-sdk.md`. Note: the docs cover **7.6.14**, but we installed **8.4.0** — see [Scandit 8.x API delta](#scandit-8x-api-delta-vs-our-docs) below.

### The big one: BarcodeFind (`MatrixScan Find`)

This is v1's workhorse. Scandit ships a **pre-built UI** that does *exactly* what step 4 of the v1 flow needs.

- **`BarcodeFind`** — the capture mode. (§10 of the docs.)
- **`BarcodeFindView` + `BarcodeFindViewSettings`** — pre-built UI: camera preview, visual dots over matches, sound + haptic feedback, and the carousel of items-still-to-find with auto-tick. **We do not draw any of this ourselves.**
- **`BarcodeFindItem` + `BarcodeFindItemSearchOptions(barcodeString)` + `BarcodeFindItemContent(name, subtitle, image)`** — one model object per item the shopper is looking for. We build the array from their list.
- **`barcodeFind.setItemList(items)` + `barcodeFindView.startSearching()`** — the whole wire-up.
- **`didTapFinishButton(foundItems)` listener** — fires when shopper hits Finish; we route to the done screen.

### Symbologies enabled

EAN-13 + QR + Code128 — required to cover the catalog (EAN-13 main, QR for demo-book shoes, Code128 for demo-book socks/tops). One symbol set, used everywhere.

### Shared SDK plumbing

- **`DataCaptureContext.forLicenseKey(key, opts)`** — 8.x replacement for `configure() + create()`. Single async call returns a context.
- **`DataCaptureView`** — DOM mount.
- **`Camera.pickBestGuess()`** + `FrameSourceState.On` — camera plumbing.
- COOP/COEP headers if we end up needing MatrixScan multithreading. **BarcodeFind doesn't strictly require it** but it's cheap to add.

### Scandit 8.x API delta (vs our docs)

`docs/scandit-web-sdk.md` covers 7.6.14. We're on 8.4.0. Only two relevant renames:

| 7.6.14 (in our docs) | 8.4.0 (what we use) |
|---|---|
| `await configure({ licenseKey, libraryLocation, moduleLoaders }); await DataCaptureContext.create();` | `const context = await DataCaptureContext.forLicenseKey(licenseKey, { libraryLocation, moduleLoaders });` |
| `Camera.default` | `Camera.pickBestGuess()` |

Everything else (BarcodeFind, Symbology, listeners, view) is the same names and shapes.

### What this saves us from building (v1)

- Camera permission flow + video preview
- Multi-barcode tracking
- Visual dot overlays on matches
- Sound + haptic feedback on hit
- The "carousel of items to find" UI with auto-tick
- Symbology decoding (EAN-13, QR, Code128)
- Loading progress UI

What we still build: the **list-builder UI**, the **navigation screen** (zone resolver + map overlay), and the **screen wiring** between them. That's it.

## Dataset reference (key fields only)

Full schema in `data/README.md`. 249 variants. Filterable attributes:

| Field | Used by | Notes |
|---|---|---|
| `product_code` | both | the barcode — primary key |
| `product_id` | both | groups variants of same product |
| `name`, `brand`, `description` | both | display |
| `category` | Shelf Lens | hardshell, boots, sleeping-bag, … |
| `tags` (array) | Shelf Lens | `waterproof`, `lightweight`, `vegan`, … (full vocab in dataset README) |
| `weight_g`, `waterproof_rating_mm`, `temp_rating_c` | Shelf Lens | numeric filter ranges |
| `price_chf`, `discount_pct` | Shelf Lens | numeric filter |
| `size`, `color` | both | size 42, etc. |
| `material` | Shelf Lens | "Gore-Tex 3L", "Merino wool" |
| `stock_total`, `stock_front` | both | grey out if `stock_total === 0`; show "in back" if `stock_front === 0` |
| `zone` (A-G), `aisle` | future "guide me there" feature | not on the critical path for v1 |

> Recommended in-memory shape: `Map<product_code, Product>` for O(1) lookup keyed on the scanned barcode. Build it once at app start from `products.json` (~600 KB — fine to ship to the browser).

## Architecture

### Stack (proposed — change here if we deviate)

- **Vite + TypeScript** — minimal, fast HMR, easy to deploy as a Render Static Site.
- **No framework**, vanilla DOM + small handwritten components. JSX/React only if we feel friction.
- **No backend** — `products.json` ships with the bundle; filter logic runs client-side; license key is supplied via build-time env var (`VITE_SCANDIT_LICENSE_KEY`).
- **Deploy** — Render Static Site (subdomain TBD; service is named `toto` in `render.yaml`). HTTPS free; add COOP/COEP via `_headers`.
- **AI layer (optional)** — natural-language → filter JSON via Claude API. Only needed when we go beyond chip-based filtering. If we add it, route through a tiny Render Web Service so the API key stays server-side.

### Data flow — Shelf Lens

```
boot
  └─ load products.json → Map<barcode, Product> (in catalog.ts)
  └─ configure Scandit, create DataCaptureContext, BarcodeBatch with [EAN13, QR, Code128]
  └─ mount DataCaptureView in #shelf-lens-view
  └─ render FilterChips component, default = "all"

user picks filter "waterproof + weight_g < 400"
  └─ predicate = (p) => p.tags.includes('waterproof') && p.weight_g < 400

each frame
  └─ Scandit callback: brushForTrackedBarcode(overlay, tb)
        ↓
     product = catalog.get(tb.barcode.data)
        ↓
     predicate(product) ? greenBrush : Brush.transparent

user taps tracked barcode
  └─ didTapTrackedBarcode → open product detail popover (name, price, stock, "in back" warning)
```

### Data flow — Find My Product

```
boot
  └─ load products.json → catalog
  └─ load checklist from URL query / localStorage / hardcoded demo
        (e.g. ["7610000000011", "7610000000088", ...])
  └─ items = checklist.map(code => {
        const p = catalog.get(code)
        return new BarcodeFindItem(
          new BarcodeFindItemSearchOptions(code),
          new BarcodeFindItemContent(p.name, `${p.brand} · ${p.size}`, null))
      })

configure Scandit
  └─ BarcodeFindSettings + enableSymbologies([EAN13, QR, Code128])
  └─ BarcodeFind.forSettings(settings)
  └─ BarcodeFindView.createWithSettings(view, context, find, viewSettings)
  └─ barcodeFind.setItemList(items)

user taps "Start"
  └─ barcodeFindView.startSearching()
  └─ Scandit's pre-built UI handles: camera, dots, sound, carousel, check marks

user taps Finish button
  └─ didTapFinishButton(foundItems) → results screen
```

## Build phases

We work in vertical slices — each phase is demoable. **v1 phases come first.** v2 / v3 are sketched at the bottom; don't open them until v1 ships + demo video is recorded.

### v1 phases

- [x] **Phase 0 — Scaffold + smoke test (done).** Vite + TS project (initially under `app/`, later flattened to repo root). Installed `@scandit/web-datacapture-core` + `@scandit/web-datacapture-barcode` v8.4.0. License key wired from `.env` via `VITE_SCANDIT_LICENSE_KEY`. Single-page barcode scanner that decodes EAN-13 / QR / Code128 and prints the result. `npm run build` green. Next: open dev server on the phone and confirm we can scan a barcode from `data/sample-barcodes.pdf`.
- [ ] **Phase 1 — Catalog + list builder (≈1.5 h).** Load `products.json` into a `Map<barcode, Product>` (also a name-search index). UI: search box → click to add → editable list → "Continue" button. Stash list in `sessionStorage` so it survives the route change. No Scandit needed.
- [ ] **Phase 2 — Navigation screen (≈1 h).** Given the list, compute the unique zones (`A`–`G`). Show `store-map.png` and overlay a marker on each needed zone. Order them shortest-first if we feel ambitious. Button: "I'm at this zone — start scanning."
- [ ] **Phase 3 — BarcodeFind integration (≈2 h).** Build `BarcodeFindItem[]` from the list (one item per `product_code`). Configure `BarcodeFind` + `BarcodeFindView` with sound + haptics on. Wire `didTapFinishButton` → "Done!" screen showing what was found / what's still missing.
- [ ] **Phase 4 — Flow glue + entry QR (≈1 h).** Landing page with a big "Start" button (simulates the QR-scanned entry). Connect screens: Landing → List → Map → Scan → Done. Back navigation. Loading states.
- [ ] **Phase 5 — Demo assets + polish (≈1.5 h).** **Print-shelf prep:** `scripts/make-demo-shelf.ts` that takes ~12 product codes from `products.json` and renders an A4 PDF of EAN-13 barcodes arranged like a shelf (one per cell, with product name underneath). Use `bwip-js` (small, browser/node-compatible barcode lib). Print once, tape to wall — same physical asset used for both the navigation demo (zone selector) and the scan-the-shelf demo. Plus: branding, app icon, mobile chrome.
- [ ] **Phase 6 — Deploy on Render + record demo video (≈1.5 h).** Static Site on Render at `<service>.onrender.com`. Use that subdomain for the Scandit bundle ID. Generate the entry QR pointing at the deploy URL. Record `video.mp4` per the storyboard above. Push `video.mp4` to repo root.

**v1 rough total:** ~8 hours. Once Phase 6 is done, **v1 is submittable** — anything in v2 / v3 is bonus.

### v2 phases (deferred)

- [ ] **Phase v2.1 — Trip plan → list (≈1 h).** Textarea on the landing page: "Tell us your trip." Tiny prompt to Claude/OpenAI returns a `{ items: [{name, qty}] }` JSON. Resolve names against the catalog. Drop straight into Phase 1's list screen with the items pre-populated.

### v3 phases (deferred — small lenses)

- [ ] **Phase v3.1 — Price Decoder (≈1.5 h).** New scan mode: "Compare two products." Scan A, scan B. Card shows price gap and bullet-pointed reasons from the catalog diff. Optional 1-sentence LLM copy on top.
- [ ] **Phase v3.2 — Repair vs Replace (≈1 h).** Hardcoded `brand → repairProgram` table. Scan worn item → card with repair cost estimate vs new price.
- [ ] **Phase v3.3 — Twin Shopper (≈2 h).** Shopper hits "Share" on a scanned product → generates a session URL. Partner opens it → sees the product card + vote buttons. Realtime back-channel via Supabase Realtime or a small Render Web Service with SSE. **Last to attempt** — only Render-side piece in the whole project.

## Decisions made

| Decision | Choice | Why |
|---|---|---|
| Stack | Vite + TypeScript, vanilla DOM | Lightest path; ESM-native; trivial Render deploy |
| Framework | none for v1 | React adds zero value for two pages with imperative camera UI |
| Backend | none for v1 | products.json is small; filter is client-side; license key via Vite env |
| Hosting | Render Static Site | Already chosen by user; free HTTPS |
| Repo layout | vendor in subfolder, user files at root | User preference (see memory note) |
| Submodule strategy | body-measurements as submodule, not vendored copy | Stays current with upstream; not used by these two features |
| Symbologies | EAN-13, QR, Code128 | Required to cover catalog incl. demo-book SKUs |

## Open questions

- **Bundle ID for the license key** — needs to match the new Render subdomain (TBD) + `localhost.localdomain`. Update the Scandit license whenever the deploy hostname is finalized.
- **Multi-context or one-context?** Scandit modes are exclusive — Shelf Lens (BarcodeBatch) and Find My Product (BarcodeFind) can share a `DataCaptureContext` but only one is active at a time. Plan: keep one context, swap modes on route change.
- **NL filter — needed for v1?** Chips + sliders cover the brief. NL is a stretch demo wow-factor. Defer unless time allows.
- **Out-of-stock handling in Shelf Lens** — grey brush, transparent brush, or hide entirely? Tentative: orange brush with a "out of stock" badge on tap.
- **Store map / "guide me there"** — not on the critical path for these two features. Hold for a v2.

## Working agreements

- **Secrets** — `SCANDIT_LICENSE_KEY` lives in `.env` at repo root (gitignored). Never paste into chat, commit, or share via screenshots. The original key copy lives at `../licencse.txt` outside the repo and is also gitignored as a belt-and-suspenders measure.
- **Commits** — small, descriptive. Co-author trailer not required.
- **`data/` holds the catalog and demo assets** — products.json, sample-barcodes.pdf, store-map.png. Treat as fixtures; the app imports them directly.
- **`body-measurements/` is a submodule** — don't edit files inside it. If we want to use it, vendor only the function we need into `src/`.
- **`docs/scandit-web-sdk.md` is the reference** — when in doubt about a Scandit API, search there first; only fetch live docs if you need something not covered.

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
