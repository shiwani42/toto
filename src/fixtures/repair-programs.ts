// Repair-program lookup by brand. These programs are *fictional* — the
// brands in products.json are made up. We model the data shape after real
// programs (Patagonia Worn Wear, Arc'teryx ReBird) so the UX rings true.

export type RepairProgram = {
  brand: string;
  programName: string;
  url: string;
  turnaroundDays: string;
  repairCostBands: {
    minor: number; // small tear / re-stitch
    medium: number; // zipper, lining
    major: number; // membrane replacement
  };
  acceptedCategories: string[]; // catalog categories they repair
  perk?: string; // e.g. "free shipping" or "discount on next purchase"
  pitch: string; // one-liner
};

const PROGRAMS: Record<string, RepairProgram> = {
  Nordfjell: {
    brand: "Nordfjell",
    programName: "Nordfjell ReFit",
    url: "https://example.com/nordfjell-refit",
    turnaroundDays: "10-14",
    repairCostBands: { minor: 25, medium: 60, major: 140 },
    acceptedCategories: ["hardshell", "rain-jacket", "insulated-jacket", "trousers", "tent"],
    perk: "Free return shipping inside CH",
    pitch:
      "Tape-seam refresh, zipper + membrane work in-house. Lifetime guarantee on workmanship.",
  },
  Pinewild: {
    brand: "Pinewild",
    programName: "Pinewild Mended",
    url: "https://example.com/pinewild-mended",
    turnaroundDays: "7-10",
    repairCostBands: { minor: 18, medium: 45, major: 110 },
    acceptedCategories: [
      "base-layer",
      "fleece",
      "trousers",
      "rain-jacket",
      "insulated-jacket",
      "hardshell",
    ],
    perk: "CHF 15 store credit if it's beyond repair",
    pitch:
      "Sustainable repairs from recycled threads. Includes a free wash + re-DWR.",
  },
  Glaronia: {
    brand: "Glaronia",
    programName: "Glaronia Loop",
    url: "https://example.com/glaronia-loop",
    turnaroundDays: "5-7",
    repairCostBands: { minor: 22, medium: 55, major: 130 },
    acceptedCategories: [
      "trail-shoes",
      "approach-shoes",
      "boots",
      "fleece",
      "base-layer",
      "tent",
    ],
    perk: "Earn loyalty points equal to repair cost",
    pitch:
      "Resole, re-glue, panel replacement. Send-back via any retail location.",
  },
  Steinbock: {
    brand: "Steinbock",
    programName: "Steinbock Bench",
    url: "https://example.com/steinbock-bench",
    turnaroundDays: "14-21",
    repairCostBands: { minor: 30, medium: 75, major: 180 },
    acceptedCategories: ["boots", "trail-shoes", "approach-shoes", "backpack"],
    perk: "Free assessment, you pay only if you accept the quote",
    pitch:
      "Hand-stitched leather work. Full resole, eyelet replacement, sole-to-upper rebond.",
  },
  Alpitec: {
    brand: "Alpitec",
    programName: "Alpitec Tune",
    url: "https://example.com/alpitec-tune",
    turnaroundDays: "8-12",
    repairCostBands: { minor: 28, medium: 65, major: 150 },
    acceptedCategories: ["trail-shoes", "boots", "hardshell", "backpack"],
    perk: "20% off a new product if your gear is beyond repair",
    pitch:
      "Performance gear restoration: mesh patching, midsole tuning, full waterproof refresh.",
  },
  wearit: {
    brand: "wearit",
    programName: "wearit Cycle",
    url: "https://example.com/wearit-cycle",
    turnaroundDays: "3-5",
    repairCostBands: { minor: 8, medium: 18, major: 35 },
    acceptedCategories: ["socks", "hat", "base-layer"],
    perk: "Free with any new wearit purchase",
    pitch:
      "Mend, darn, re-tip. Drop off in any wearit-stocked store, pick up next week.",
  },
};

export function repairProgramFor(brand: string): RepairProgram | undefined {
  return PROGRAMS[brand];
}

export function bandForPrice(newPrice: number, severity: "minor" | "medium" | "major"): {
  estimate: number;
  payoff: string;
} {
  // Estimate is from the program; payoff is a quick decision aid.
  return {
    estimate: 0, // caller fills in from program.repairCostBands
    payoff: severity === "major" && newPrice < 80 ? "Replace" : "Repair",
  };
}

export function listSupportedBrands(): string[] {
  return Object.keys(PROGRAMS);
}
