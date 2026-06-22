// Map common color words to hex so we can render a swatch on cards.
// Falls back to a warm neutral tan when the word isn't recognized.
const SWATCH_MAP: Record<string, string> = {
  black: "#1f1f1f",
  white: "#f5f5f5",
  grey: "#888888",
  gray: "#888888",
  charcoal: "#3a3a3a",
  navy: "#1c2e4a",
  blue: "#3b6db5",
  teal: "#2a9d8f",
  green: "#4a8a3e",
  forest: "#2c6e34",
  red: "#c0392b",
  orange: "#d97928",
  yellow: "#e5b73b",
  purple: "#7a4e9b",
  brown: "#7a5230",
  tan: "#c8a878",
  beige: "#dccba0",
  pink: "#e58aa6",
};

export function colorSwatch(color: string): string {
  const key = color.toLowerCase().split(/[\s/]/)[0] ?? "";
  return SWATCH_MAP[key] ?? "#a89274";
}
