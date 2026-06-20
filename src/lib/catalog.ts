import type { Product } from "./types";
import productsRaw from "../../data/products.json";

const products = productsRaw as Product[];

const byBarcode = new Map<string, Product>(
  products.map((p) => [p.product_code, p]),
);

// Pre-computed lower-cased haystack per product for substring search.
// `size <s>` is included as a phrase so natural queries like "boots size 42" work.
const haystack = new Map<string, string>(
  products.map((p) => [
    p.product_code,
    [
      p.name,
      p.brand,
      p.category,
      p.color,
      p.size,
      `size ${p.size}`,
      p.material,
      p.zone_name,
      ...p.tags,
    ]
      .join(" ")
      .toLowerCase(),
  ]),
);

// Light stopword strip so "X for Y" / "X in size Y" still match.
const STOPWORDS = new Set([
  "for", "of", "the", "a", "an", "with", "my", "and", "or", "in", "to",
]);

export function getProduct(barcode: string): Product | undefined {
  return byBarcode.get(barcode);
}

export function allProducts(): Product[] {
  return products;
}

// Compact projection of the catalog for LLM prompts — small enough that the
// full catalog fits comfortably in a single Claude message.
export function compactCatalog() {
  return products.map((p) => ({
    code: p.product_code,
    name: p.name,
    category: p.category,
    tags: p.tags,
    size: p.size,
    color: p.color,
    weight_g: p.weight_g,
    waterproof_rating_mm: p.waterproof_rating_mm,
    temp_rating_c: p.temp_rating_c,
    price_chf: p.price_chf,
  }));
}

export function search(query: string, limit = 12): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const out: Product[] = [];
  for (const p of products) {
    const hs = haystack.get(p.product_code) ?? "";
    if (tokens.every((t) => hs.includes(t))) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function zonesForCodes(codes: string[]): {
  zone: string;
  zone_name: string;
  count: number;
}[] {
  const counts = new Map<string, { zone_name: string; count: number }>();
  for (const code of codes) {
    const p = byBarcode.get(code);
    if (!p) continue;
    const prev = counts.get(p.zone);
    if (prev) prev.count += 1;
    else counts.set(p.zone, { zone_name: p.zone_name, count: 1 });
  }
  return Array.from(counts, ([zone, { zone_name, count }]) => ({
    zone,
    zone_name,
    count,
  })).sort((a, b) => a.zone.localeCompare(b.zone));
}
