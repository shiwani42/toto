// Default zone pin layout for the bundled store-map.png, plus helpers
 // to merge a shop's saved zone_positions over those defaults.

import type { ZonePoint, ZonePositions } from "./shops";

/** Pin positions on the bundled store-map.png, as % of width/height.
 *  Map layout (3 columns):
 *    left:   C (top) - B (mid) - A (bot)
 *    center: F (upper-mid) - G (lower-mid)
 *    right:  D (top) - E (mid) - Checkout (bot) */
export const DEFAULT_ZONE_POS: Record<string, ZonePoint> = {
  C: { x: 21, y: 38 },
  B: { x: 21, y: 60 },
  A: { x: 21, y: 82 },
  F: { x: 52, y: 42 },
  G: { x: 52, y: 75 },
  D: { x: 82, y: 38 },
  E: { x: 82, y: 60 },
};

export const DEFAULT_ENTRY: ZonePoint = { x: 50, y: 95 };
export const DEFAULT_CHECKOUT: ZonePoint = { x: 82, y: 92 };

export const ZONE_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export function defaultZonePositions(): ZonePositions {
  return {
    zones: { ...DEFAULT_ZONE_POS },
    entry: { ...DEFAULT_ENTRY },
    checkout: { ...DEFAULT_CHECKOUT },
  };
}

/** Merge shop-saved pins over the bundled defaults. Missing zones keep
 *  the default so a partial edit still navigates sensibly. */
export function resolveZonePositions(custom: ZonePositions | null | undefined): ZonePositions {
  const base = defaultZonePositions();
  if (!custom) return base;
  return {
    zones: { ...base.zones, ...(custom.zones ?? {}) },
    entry: custom.entry ?? base.entry,
    checkout: custom.checkout ?? base.checkout,
  };
}
