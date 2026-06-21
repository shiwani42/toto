import { allProducts, compactCatalog, getProduct } from "../lib/catalog";
import { forecast, type ForecastSummary } from "./weather";

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as
  | string
  | undefined;

const MODEL = "claude-haiku-4-5-20251001";

export type PlanPick = {
  code: string;
  why: string;
};

export type PlanCategory = {
  key: string;        // catalog category id (e.g. "rain-jacket")
  label: string;      // user-facing label (e.g. "Rain jacket")
  why: string;        // one-line reasoning for why this category matters
  products: PlanPick[]; // 1-3 product candidates from the catalog
};

export type PlanResult = {
  categories: PlanCategory[];
  source: "llm" | "heuristic";
  reasoning?: string;
  weather?: ForecastSummary;
};

export type PlanProgress = (msg: string, weather?: ForecastSummary) => void;

export type PlannerProfile = {
  gender: "man" | "woman" | "other" | null;
  age: "u20" | "20-30" | "30-45" | "45-60" | "60+" | null;
  experience: "new" | "comfortable" | "enthusiast" | "pro" | null;
  shoppingFor: "self" | "someone" | "family" | null;
  topSize: "XS" | "S" | "M" | "L" | "XL" | null;
  bottomSize: "XS" | "S" | "M" | "L" | "XL" | null;
  shoeSizeEU: number | null;
};

const EMPTY_PROFILE: PlannerProfile = {
  gender: null,
  age: null,
  experience: null,
  shoppingFor: null,
  topSize: null,
  bottomSize: null,
  shoeSizeEU: null,
};

export async function planTrip(
  tripText: string,
  profile: PlannerProfile = EMPTY_PROFILE,
  onProgress?: PlanProgress,
): Promise<PlanResult> {
  if (ANTHROPIC_API_KEY) {
    try {
      return await planWithLLM(tripText, profile, onProgress);
    } catch (err) {
      console.warn("LLM planner failed, falling back to heuristic:", err);
      // Silent fallback. The shopper doesn't need to know which engine ran.
      return planHeuristic(tripText);
    }
  }
  return planHeuristic(tripText);
}

function profileBlock(p: PlannerProfile): string {
  const lines: string[] = [];
  if (p.shoppingFor) {
    const who = p.shoppingFor === "self" ? "themselves"
              : p.shoppingFor === "someone" ? "a specific other person"
              : "their family / multiple people";
    lines.push(`- Shopping for: ${who}.`);
  }
  if (p.gender) {
    const cut = p.gender === "man" ? "men's cuts (prefer tags 'mens' or 'unisex')"
              : p.gender === "woman" ? "women's cuts (prefer tags 'womens' or 'unisex')"
              : "unisex when both options exist";
    lines.push(`- Wearer is a ${p.gender}. Pick ${cut} when there's a choice.`);
  }
  if (p.age) {
    const ageHint = p.age === "u20" || p.age === "20-30"
      ? "Younger shopper, performance and lighter weight are fine."
      : p.age === "30-45"
        ? "Mid-range. Versatile, durable picks."
        : p.age === "45-60"
          ? "Comfort matters alongside performance. Easy-to-use designs."
          : "Comfort-first, easy-handling gear. Avoid the most technical items.";
    lines.push(`- Age: ${p.age}. ${ageHint}`);
  }
  if (p.experience) {
    const hint = p.experience === "new"
      ? "Pick beginner-friendly, well-known, easy-to-use gear. Avoid highly technical specialist items. Prefer products tagged 'beginner' or 'casual' when available."
      : p.experience === "comfortable"
        ? "Balanced picks. Quality but not specialist-grade unless the trip demands it."
        : p.experience === "enthusiast"
          ? "Performance-oriented picks are welcome. They know what they're doing. Prefer 'technical' or 'lightweight' tags."
          : "Pick technical, high-performance gear. Don't simplify. Prefer 'technical', 'ultralight', or 'pro' tags.";
    lines.push(`- Experience level: ${p.experience}. ${hint}`);
  }
  if (p.topSize)    lines.push(`- Top size: ${p.topSize}. Only pick this size for clothing.`);
  if (p.bottomSize) lines.push(`- Bottom size: ${p.bottomSize}. Only pick this size for trousers.`);
  if (p.shoeSizeEU) lines.push(`- Shoe size EU ${p.shoeSizeEU}. Only pick this size for footwear.`);
  if (lines.length === 0) return "";
  return `\n\nCustomer profile (treat as soft constraints):\n${lines.join("\n")}`;
}

// ---------- Agentic loop with weather tool ----------

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

const WEATHER_TOOL = {
  name: "get_weather_forecast",
  description:
    "Fetches a daily weather forecast for a location and date window. Use this to ground gear suggestions in real conditions (temperature, precipitation, snow, wind, daylight). Always call this BEFORE selecting gear if the trip text mentions any location and timing.",
  input_schema: {
    type: "object" as const,
    properties: {
      location: {
        type: "string",
        description:
          "City, region, or landmark (e.g. 'Zermatt', 'Swiss Alps', 'Mont Blanc'). Use the most specific name from the trip text.",
      },
      start_date: {
        type: "string",
        description:
          "Trip start date in YYYY-MM-DD. If trip text gives a relative date ('next Saturday'), resolve it. If no date, omit.",
      },
      days: {
        type: "integer",
        description: "Number of days the trip lasts (1-16).",
      },
    },
    required: ["location", "days"],
  },
};

async function planWithLLM(
  tripText: string,
  profile: PlannerProfile,
  onProgress?: PlanProgress,
): Promise<PlanResult> {
  const catalog = compactCatalog();

  const systemPrompt = `You are a gear advisor for a Swiss outdoor retailer.

Goal: build a complete shopping list for the customer's trip, grouped by gear category, so they can decide what they actually want.

Strict workflow:
1. Call get_weather_forecast with the location and number of days from the trip text. If a date is given resolve it (e.g. "March 14" -> "YYYY-03-14" using the next March 14). If no location is given, pick the most plausible (default "Swiss Alps").
2. After the tool returns, decide which gear CATEGORIES are relevant. Pick 6-12 categories covering layers, footwear, shelter, sleep, navigation, hydration, etc. Lean comprehensive — the customer will uncheck what they don't need.
3. For EACH category, pick 2-3 specific catalog products. Pick ONE variant per product_id within a category, but include 2-3 DIFFERENT products to give the shopper choice (different brands, price tiers, or technical levels).
4. Default to size M for clothing and 42 for footwear, but obey the customer profile if it gives specific sizes.
5. Respond with ONLY a JSON object (no markdown, no commentary), shape:
   {
     "summary": "<= 140 chars about the trip overall (one line, references the live forecast)",
     "categories": [
       {
         "key": "<catalog category id, e.g. 'rain-jacket'>",
         "label": "<short human label, e.g. 'Rain jacket'>",
         "why": "<= 80 chars on why this category matters for THIS trip (e.g. 'Rain on Saturday')",
         "products": [
           {"code": "<product_code>", "why": "<= 70 chars on what makes THIS product right"}
         ]
       }
     ]
   }
   Voice: warm, friendly, no jargon, like a knowledgeable shop companion talking to the shopper.${profileBlock(profile)}

Catalog (one variant per row, ~250 rows):
${JSON.stringify(catalog)}`;

  const messages: AnthropicMessage[] = [
    { role: "user", content: `Trip: ${tripText}` },
  ];

  let weather: ForecastSummary | undefined;
  let safetyTurns = 4;

  while (safetyTurns-- > 0) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools: [WEATHER_TOOL],
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Planner API failed (${res.status}):`, text.slice(0, 250));
      throw new Error("planner_unreachable");
    }

    const json = await res.json();
    const blocks = json.content as AnthropicContentBlock[];
    messages.push({ role: "assistant", content: blocks });

    const toolUse = blocks.find(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        b.type === "tool_use",
    );

    if (toolUse) {
      onProgress?.(`Checking the forecast for ${toolUse.input.location}…`);
      let toolResult: string;
      try {
        if (toolUse.name === "get_weather_forecast") {
          const args = toolUse.input as {
            location: string;
            start_date?: string;
            days: number;
          };
          const w = await forecast(args.location, args.start_date, args.days);
          if (!w) {
            toolResult = JSON.stringify({
              error: `Could not find a forecast for "${args.location}".`,
            });
          } else {
            weather = w;
            onProgress?.(
              `Forecast: ${w.summary.min_c}°C to ${w.summary.max_c}°C, ${w.summary.has_snow ? "snow" : w.summary.has_rain ? "rain" : "dry"}.`,
              w,
            );
            toolResult = JSON.stringify({
              location: w.location,
              summary: w.summary,
              daily: w.daily,
            });
          }
        } else {
          toolResult = JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
        }
      } catch (err) {
        toolResult = JSON.stringify({
          error: `Tool failed: ${(err as Error).message}`,
        });
      }

      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: toolResult,
          },
        ],
      });
      continue;
    }

    // No tool call -> final answer.
    const textBlock = blocks.find(
      (b): b is Extract<AnthropicContentBlock, { type: "text" }> =>
        b.type === "text",
    );
    if (!textBlock) throw new Error("No text in final response");
    onProgress?.("Picking your gear…");
    return { ...parseFinalAnswer(textBlock.text), source: "llm", weather };
  }

  throw new Error("Agent loop exceeded safety budget");
}

function parseFinalAnswer(text: string): { categories: PlanCategory[]; reasoning?: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain JSON");

  const parsed = JSON.parse(match[0]) as {
    categories?: unknown;
    picks?: unknown;
    summary?: unknown;
    reasoning?: unknown;
  };

  let categories: PlanCategory[] = [];

  if (Array.isArray(parsed.categories)) {
    // New shape: categories with products inside
    categories = parsed.categories
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c): PlanCategory => {
        const products: PlanPick[] = Array.isArray(c.products)
          ? (c.products as unknown[])
              .filter(
                (p): p is { code: unknown; why: unknown } =>
                  typeof p === "object" && p !== null && "code" in (p as object),
              )
              .map((p) => ({
                code: typeof p.code === "string" ? p.code : "",
                why: typeof p.why === "string" ? p.why : "",
              }))
              .filter((p) => p.code && Boolean(getProduct(p.code)))
          : [];
        return {
          key: typeof c.key === "string" ? c.key : "",
          label: typeof c.label === "string" ? c.label : "Items",
          why: typeof c.why === "string" ? c.why : "",
          products,
        };
      })
      .filter((c) => c.products.length > 0);
  } else if (Array.isArray(parsed.picks)) {
    // Backwards-compat: flat picks → group by product.category locally
    const flat = (parsed.picks as unknown[])
      .filter(
        (p): p is { code: unknown; why: unknown } =>
          typeof p === "object" && p !== null && "code" in (p as object),
      )
      .map((p) => ({
        code: typeof p.code === "string" ? p.code : "",
        why: typeof p.why === "string" ? p.why : "",
      }))
      .filter((p) => p.code && Boolean(getProduct(p.code)));
    categories = groupByCategory(flat);
  } else {
    throw new Error("LLM response is missing `categories`");
  }

  if (categories.length === 0) throw new Error("LLM returned no valid categories");

  const summary =
    typeof parsed.summary === "string"
      ? parsed.summary
      : typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : undefined;

  return { categories, reasoning: summary };
}

function groupByCategory(picks: PlanPick[]): PlanCategory[] {
  const buckets = new Map<string, PlanPick[]>();
  for (const pick of picks) {
    const p = getProduct(pick.code);
    if (!p) continue;
    const arr = buckets.get(p.category) ?? [];
    arr.push(pick);
    buckets.set(p.category, arr);
  }
  return Array.from(buckets, ([key, products]) => ({
    key,
    label: key.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    why: "",
    products,
  }));
}

// ---------- Heuristic fallback (no API key) ----------

function planHeuristic(tripText: string): PlanResult {
  const text = tripText.toLowerCase();

  type Mapping = { categories?: string[]; tags?: string[]; coldHint?: boolean };
  const KEYWORDS: Record<string, Mapping> = {
    winter: { tags: ["winter", "insulated", "4-season", "down"], coldHint: true },
    cold: { tags: ["winter", "insulated", "down"], coldHint: true },
    snow: { tags: ["winter", "4-season"], coldHint: true },
    alpine: { tags: ["4-season", "technical"], coldHint: true },
    alps: { tags: ["4-season", "technical"], coldHint: true },
    summer: { tags: ["summer", "lightweight", "breathable", "3-season"] },
    warm: { tags: ["lightweight", "breathable"] },
    rain: { tags: ["waterproof", "gore-tex"] },
    wet: { tags: ["waterproof", "gore-tex"] },
    hike: {
      categories: ["boots", "trail-shoes", "hardshell", "fleece", "base-layer", "backpack"],
    },
    hiking: {
      categories: ["boots", "trail-shoes", "hardshell", "fleece", "base-layer", "backpack"],
    },
    trail: { categories: ["trail-shoes", "backpack", "base-layer"] },
    trek: { categories: ["boots", "backpack", "trekking-poles", "hardshell"] },
    backpacking: {
      categories: ["backpack", "tent", "sleeping-bag", "sleeping-mat", "stove"],
    },
    camp: { categories: ["tent", "sleeping-bag", "sleeping-mat", "stove"] },
    camping: { categories: ["tent", "sleeping-bag", "sleeping-mat", "stove"] },
    multi: { categories: ["tent", "sleeping-bag", "sleeping-mat", "backpack"] },
    overnight: { categories: ["tent", "sleeping-bag", "sleeping-mat"] },
    "3-day": { categories: ["tent", "sleeping-bag", "sleeping-mat", "backpack"] },
    "4-day": { categories: ["tent", "sleeping-bag", "sleeping-mat", "backpack"] },
    "5-day": { categories: ["tent", "sleeping-bag", "sleeping-mat", "backpack"] },
    week: { categories: ["tent", "sleeping-bag", "sleeping-mat", "backpack"] },
    night: { categories: ["headlamp"] },
  };

  const wantedTags = new Set<string>();
  const wantedCategories = new Set<string>();
  let coldHint = false;
  for (const [kw, m] of Object.entries(KEYWORDS)) {
    if (text.includes(kw)) {
      m.tags?.forEach((t) => wantedTags.add(t));
      m.categories?.forEach((c) => wantedCategories.add(c));
      if (m.coldHint) coldHint = true;
    }
  }
  if (wantedCategories.size === 0 && wantedTags.size === 0) {
    ["backpack", "hardshell", "boots"].forEach((c) => wantedCategories.add(c));
  }

  const products = allProducts();
  const scored = products.map((p) => {
    let score = 0;
    if (wantedCategories.has(p.category)) score += 3;
    for (const tag of p.tags) if (wantedTags.has(tag)) score += 1;
    if (coldHint && p.temp_rating_c != null && p.temp_rating_c > 5) score -= 1;
    if (!coldHint && p.temp_rating_c != null && p.temp_rating_c < -10) score -= 1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Group up to 3 products per category, max ~10 categories.
  const byCat = new Map<string, PlanPick[]>();
  for (const { p, score } of scored) {
    if (score <= 0) break;
    const arr = byCat.get(p.category) ?? [];
    if (arr.length >= 3) continue;
    arr.push({ code: p.product_code, why: buildHeuristicReason(p, wantedTags) });
    byCat.set(p.category, arr);
    if (byCat.size >= 10 && arr.length >= 3) break;
  }

  const categories: PlanCategory[] = Array.from(byCat, ([key, products]) => ({
    key,
    label: key.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    why: "",
    products,
  }));

  return {
    categories,
    source: "heuristic",
  };
}

function buildHeuristicReason(
  p: { material: string; tags: string[]; temp_rating_c: number | null },
  wantedTags: Set<string>,
): string {
  const hit = p.tags.filter((t) => wantedTags.has(t)).slice(0, 2);
  if (hit.length > 0) {
    return `Picked for the ${hit.join(" + ")} match.`;
  }
  if (p.temp_rating_c != null) {
    return `Rated comfortable to ${p.temp_rating_c}°C.`;
  }
  if (p.material) {
    return `Built from ${p.material}.`;
  }
  return "A solid all-rounder from the catalog.";
}
