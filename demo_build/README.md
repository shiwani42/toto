# Toto demo film

Value film, not a feature tour. Live Toto capture inside a Remotion story.

## One sentence

When a shopper freezes in front of two hundred jackets, Toto quietly names the two that fit. The shop hears the visit that used to walk out silent.

## Commands

```bash
# From repo root, keep the app running
npm run dev -- --host 127.0.0.1 --port 5174

# In demo_build/
npm install
npx playwright install chromium
APP_URL=http://127.0.0.1:5174 npm run capture
npm run check
npm run render
```

Outputs are versioned and never overwritten: `demo-v1.mp4`, `demo-v2.mp4`, …

```bash
npm run render   # writes the next demo-vN.mp4
```

## Story

1. The freeze in the aisle
2. A friend already there
3. Shopper value: leave sure
4. Shopper value: belong on the floor
5. Owner value: hear the silent visit
6. Close: the wall gets smaller

Legacy phone recording scripts remain under `../scripts/record-e2e-video.mjs`.
