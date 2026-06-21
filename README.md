<div align="center">

# Toto

### In-store AI concierge for a Swiss outdoor retailer
#### Open-source camera + AR scanner · No install · Open from a QR code

</div>

---

## The problem

A customer walks into an outdoor gear store. They see a wall of 250+ jackets. Every jacket has a number on the tag. None of the numbers mean anything without a degree in textile engineering.

**Today, there are two outcomes:**
1. They find a sales associate — if one is free
2. They walk out

The harder moment isn't "which jacket is best" — it's the second before they pick one up, when the wall of choice is so overwhelming they don't even start. **That moment is currently unsolved.**

---

## Our solution

**Toto** collapses 250 SKUs into the 2–3 right ones for a specific shopper — no sales associate needed, no app to install, no account to create.

**The shopper's flow, start to finish:**

```
Scan QR at store entrance
        ↓
Enter what you're looking for  (name, size, or paste a list)
        ↓
App shows which zones to visit  (A–G on the store map)
        ↓
Point camera at the shelf
        ↓
Items on your list glow green  (camera AR overlay)
        ↓
Done — tap Finish, see summary
```

Zero friction. Works in Safari and Chrome. Opens from a QR code in under 3 seconds.

---

## Demo

> **Video walkthrough:** `video.mp4` at repo root *(to be recorded)*

**To try it yourself:**

```
http://localhost:5173   (after running npm run dev — see Getting Started below)
```

Print `data/sample-barcodes.pdf` (or open it on a second screen) and point the camera at it. The catalog has 249 real EAN-13, QR, and Code128 barcodes.

---

## Features built

### Find what you came for

| Screen | What it does | Tech |
|---|---|---|
| **List builder** | Search 249 SKUs by name, brand, or size — click to add. Shows stock status (in-store / in back / out of stock). Demo list auto-fills 8 items guaranteed in the sample PDF. | Client-side fuzzy search over `products.json` |
| **Zone navigator** | Resolves your list to zones A–G with pulsing pins on the floor plan, sorted by the store's recommended walking order. Per-zone item cards below the map. | `zone` field from catalog + `store-map.png` overlay |
| **Camera scanner with AR** | Live camera viewport with dots over every barcode in the frame simultaneously, green = on your list, white = not. Carousel auto-ticks items as found; Web Audio beep + vibrate on each hit; camera-switch button. | Built on `zxing-wasm` (Apache 2.0) with a custom canvas overlay and carousel |
| **Done screen** | Found vs still-missing summary with product details. | — |

**Symbologies:** EAN-13, EAN-8, UPC-E, QR, Code 128, Code 39, Data Matrix.

### Trip planner

Describe a trip in plain text — *"3-day winter hike near Zermatt, starts Saturday"*. The app fetches a live weather forecast (Open-Meteo, no key needed), passes it to Claude Haiku as a tool result, and returns 4–8 catalog items matched to actual conditions, each with a one-sentence reason referencing the forecast. Degrades gracefully to a keyword heuristic when no Anthropic key is configured.

### Price Decoder

Scan two products into slot A and slot B. A deterministic diff over catalog fields — material, waterproof rating, temperature rating, weight, extra features — shows exactly where the price gap goes, with a brand-premium residual for the unexplained remainder.

### Repair vs Replace

Scan any product. The app looks up the brand's repair programme and compares estimated repair cost bands against the new price. Returns a **Repair / Replace / Either** recommendation with reasoning.

### Twin Shopper (Connect)

Real-time multi-user sessions over Supabase Realtime:

- **Family mode** (FAM-XXXX) — multiple shoppers in-store sharing a list and seeing each other's scan finds live.
- **Partner-at-home mode** (PAR-XXXX) — one person in-store, one remote; the remote partner sees the live cart and can vote on items.

Both modes include presence (name, emoji, zone), a live activity feed, chat, and a pull-based list snapshot so a joiner immediately sees the existing cart on join.

### Fit Check

Take a photo (opt-in, processed once, never stored). Claude Vision estimates top size, bottom size, and EU shoe size from visual cues with a short reasoning note. Sizes are saved to Settings and pre-fill size filters on the list screen.

### Settings & Accessibility

High contrast, larger text (+25%), reduce motion, speak-scan-results (TTS on finish), and manual size entry (top / bottom / EU shoe) as an alternative to Fit Check.

---

## Scanning stack

| Capability | How it works |
|---|---|
| **Multi-barcode AR overlay** | Each animation frame is drawn to a canvas and handed to `zxing-wasm`. Decoded barcodes come back with corner-polygon positions; we paint a coloured dot per match on an overlay canvas. Up to 12 codes per frame. |
| **Find-list state** | Codes on the shopper's list draw green; everything else draws white. Once a list item is found, a check ring is added. The carousel below the viewport ticks the item off. |
| **Feedback** | Web Audio sine beep (works on iOS Safari, where `navigator.vibrate` is silently ignored). Android Chrome also vibrates. |
| **Symbologies** | EAN-13, EAN-8, UPC-A, UPC-E, QR, Code 128, Code 39, Data Matrix. |
| **License** | None. `zxing-wasm` is Apache 2.0. No allow-list, no per-domain registration. Runs anywhere. |

---

## Technical architecture

```
Browser (Vite + TypeScript, vanilla DOM)
├── src/
│   ├── lib/catalog.ts        → products.json → Map<barcode, Product>  (O(1) lookup)
│   ├── lib/list.ts           → sessionStorage list + realtime broadcast
│   ├── lib/session.ts        → Supabase Realtime wrapper
│   ├── integrations/         → ai-planner.ts (Claude) + weather.ts (Open-Meteo)
│   ├── fixtures/             → repair-programs.ts (per-brand lookup)
│   ├── screens/
│   │   ├── list-builder.ts   → search + build checklist → sessionStorage
│   │   ├── map.ts            → zone resolver + store-map.png overlay
│   │   ├── scan.ts           → list-based scanner with AR + carousel (THE CORE FEATURE)
│   │   ├── done.ts           → found / still-missing summary
│   │   └── plan.ts           → v2 trip plan input → Claude API
│   └── style.css             → Inter font, forest-green design tokens, mobile-first

No backend for v1 — products.json (~600 KB) ships with the bundle.
v2 LLM calls go directly from the browser; the Anthropic key is supplied
client-side via VITE_ANTHROPIC_API_KEY. Move to a server-side proxy before
shipping to real users.
```

**Stack choices:**

| Choice | Reason |
|---|---|
| Vite + TypeScript | Minimal setup, ESM-native, trivial Render Static Site deploy |
| No framework (vanilla DOM) | React adds zero value for screens that are mostly imperative camera UI |
| No backend (v1) | 249 products fit comfortably in the browser; client-side filter is instant |
| Render Static Site | Free HTTPS; correct WASM MIME type; easy redeploy on push |

---

## Catalog

249 product variants across 7 store zones — one scannable barcode per variant.

| Zone | Name | Categories |
|---|---|---|
| A | Jackets & Shells | rain-jacket, insulated-jacket, hardshell |
| B | Footwear | boots, trail-shoes, approach-shoes |
| C | Tents & Shelter | tent, tarp |
| D | Sleep | sleeping-bag, sleeping-mat |
| E | Backpacks | backpack |
| F | Base Layers & Clothing | base-layer, fleece, trousers |
| G | Accessories | headlamp, water-bottle, trekking-poles, gloves, socks, hat, stove |

**Key product fields used by the app:**

`product_code` (barcode) · `name` · `brand` · `category` · `zone` + `aisle` (navigation) · `size` · `color` · `price_chf` · `weight_g` · `waterproof_rating_mm` · `temp_rating_c` · `material` · `tags` · `stock_total` · `stock_front`

---

## Getting started

```bash
git clone --recurse-submodules <repo-url>
cd Toto
cp .env.example .env       # optional: only needed for Supabase / Anthropic
npm install
npm run dev
```

Open **http://localhost:5173** (or the network URL shown in the terminal, for phone testing on the same WiFi). The scanner needs HTTPS for camera access; `localhost` is allowed without HTTPS.

> If you cloned without `--recurse-submodules`: `git submodule update --init --recursive`

**Test scanning without a physical store:**
Print `data/sample-barcodes.pdf` or open it on a second screen. Scan from the phone camera — every barcode returns real product data from the catalog.

---

## Repo layout

```
Toto/
├── README.md                    ← you are here
├── AGENTS.md                    ← full technical brief for coding agents
├── render.yaml                  ← Render Static Site blueprint
├── index.html                   ← Vite entry
├── package.json, tsconfig.json, vite.config.ts
├── .env.example                 ← optional env vars (Supabase, Anthropic)
├── public/                      ← static assets (favicon, icons)
├── src/
│   ├── main.ts                  ← query-string router + tab bar
│   ├── style.css                ← design tokens + component styles
│   ├── screens/                 ← one file per ?screen=… route
│   │   ├── list-builder.ts      ← Phase 1: search + checklist
│   │   ├── map.ts               ← Phase 2: zone resolver + floor plan
│   │   ├── scan.ts              ← Phase 3: BarcodeFind (core feature)
│   │   ├── done.ts              ← Phase 4: results
│   │   ├── plan.ts              ← v2: trip plan → AI checklist
│   │   ├── compare.ts           ← v3: Price Decoder
│   │   ├── repair.ts            ← v3: Repair vs Replace
│   │   ├── connect.ts           ← v3: Twin Shopper — lobby
│   │   ├── connected.ts         ← v3: Twin Shopper — active session
│   │   ├── fit.ts               ← Fit Check (Claude Vision)
│   │   ├── settings.ts          ← accessibility + size prefs
│   │   └── smoke.ts             ← bare scanner smoke test
│   ├── lib/                     ← domain primitives
│   │   ├── catalog.ts           ← products.json → Map<barcode, Product>
│   │   ├── list.ts              ← sessionStorage list + broadcast hooks
│   │   ├── session.ts           ← Supabase Realtime wrapper
│   │   ├── prefs.ts             ← localStorage prefs + TTS announcer
│   │   └── types.ts             ← Product, Screen, etc.
│   ├── integrations/            ← external API wrappers
│   │   ├── ai-planner.ts        ← Claude tool-use loop for trip planning
│   │   └── weather.ts           ← Open-Meteo geocode + forecast
│   └── fixtures/                ← static data tables baked into the app
│       └── repair-programs.ts   ← per-brand repair-program lookup
├── data/                        ← catalog + demo assets
│   ├── README.md                ← dataset schema + zone map
│   ├── products.json            ← 249 product variants
│   ├── sample-barcodes.pdf      ← 3 scannable demo-book pages
│   └── store-map.png            ← store floor plan, zones A–G
├── docs/
│   ├── barcode-sdk-alternatives.md ← research notes on the open-source switch
│   └── ideas-bank.md            ← original direction-setting writeups
├── body-measurements/           ← submodule for future Fit Translator feature
└── frontend-reference/          ← design reference (React/Tailwind prototype)
```
