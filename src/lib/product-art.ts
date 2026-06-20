// Product imagery for the swipe deck. Uses Microsoft Fluent Emoji 3D PNGs
// (MIT licensed) served via the jsDelivr CDN.
// Source: https://github.com/microsoft/fluentui-emoji
//
// Each category maps to a Fluent Emoji asset path. PNGs are 3D-rendered
// objects, ~30-60KB each, cached on the CDN. The first time a category
// loads it pulls over the network; subsequent loads come from cache.
//
// If an asset doesn't exist at the expected path, the <img onerror=...>
// quietly swaps to a known-good fallback so users never see a broken image.

const CDN = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

function url(folder: string, file: string): string {
  return `${CDN}/${encodeURIComponent(folder)}/3D/${file}_3d.png`;
}

// Backpack is universally present in Fluent Emoji; use it as the fallback so
// broken URLs degrade to a generic outdoor product image, not a blank box.
const FALLBACK = url("Backpack", "backpack");

const CATEGORY_MAP: Record<string, string> = {
  // Jackets — use Coat (🧥)
  "rain-jacket":      url("Coat", "coat"),
  "insulated-jacket": url("Coat", "coat"),
  "hardshell":        url("Coat", "coat"),

  // Footwear
  "boots":          url("Hiking boot", "hiking_boot"),
  "trail-shoes":    url("Running shoe", "running_shoe"),
  "approach-shoes": url("Hiking boot", "hiking_boot"),

  // Shelter
  "tent":  url("Tent", "tent"),
  "tarp":  url("Tent", "tent"),

  // Sleep — Bed is a safer fallback than "Person in bed"
  "sleeping-bag": url("Bed", "bed"),
  "sleeping-mat": url("Bed", "bed"),

  // Bags
  "backpack": url("Backpack", "backpack"),

  // Layers
  "base-layer": url("T-shirt", "t-shirt"),
  "fleece":     url("Coat", "coat"),
  "trousers":   url("Jeans", "jeans"),

  // Accessories
  "headlamp":       url("Flashlight", "flashlight"),
  "water-bottle":   url("Cup with straw", "cup_with_straw"),
  "trekking-poles": url("White cane", "white_cane"),
  "gloves":         url("Gloves", "gloves"),
  "socks":          url("Socks", "socks"),
  "hat":            url("Billed cap", "billed_cap"),
  "stove":          url("Cooking", "cooking"),
};

export function illustrationForCategory(category: string): string {
  const src = CATEGORY_MAP[category] ?? FALLBACK;
  // The onerror handler silently swaps to the fallback if the primary asset
  // 404s. The handler nulls itself so we don't loop on a broken fallback.
  return `<img class="product-art" src="${src}"
               onerror="this.onerror=null; this.src='${FALLBACK}'"
               alt="" loading="lazy" draggable="false" />`;
}
