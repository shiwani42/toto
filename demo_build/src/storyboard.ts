export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TRANSITION_FRAMES = 24;

export const BRAND = {
  linen: "#F6F3EE",
  linenDeep: "#F6F3EE",
  ink: "#1C241F",
  inkSoft: "rgba(28, 36, 31, 0.62)",
  pine: "#31463C",
  ember: "#B85A2A",
  paper: "#FAF6EE",
  bezel: "#2C2925",
  text: "#1C241F",
  muted: "rgba(28, 36, 31, 0.62)",
  glow: "#B85A2A",
  accent: "#31463C",
  accentSoft: "#6A7F72",
  bg: "#F6F3EE",
  bgSoft: "#F6F3EE",
  phoneBezel: "#2C2925",
} as const;

/** Seconds into recordings/walkthrough.mp4 */
export const WALK = {
  home: { start: 0.4, end: 6.6 },
  plan: { start: 6.6, end: 23.0 },
  map: { start: 23.0, end: 26.3 },
  scan: { start: 26.3, end: 34.6 },
  fit: { start: 34.6, end: 40.0 },
  repair: { start: 40.3, end: 43.4 },
  twin: { start: 43.4, end: 52.7 },
  owner: { start: 52.7, end: 67.9 },
  ops: { start: 67.9, end: 76.4 },
} as const;

export const STORY =
  "Toto asks about the trip, names the kit, walks you there, guesses your size, and shops with your person. The shop finally hears the visit.";

export const NARRATION = [
  { id: "m4-01-cold", file: "voice/m4-01-cold.wav", atScene: "cold-open" },
  { id: "m4-02-meet", file: "voice/m4-02-meet.wav", atScene: "meet-toto" },
  { id: "m4-03-trip", file: "voice/m4-03-trip.wav", atScene: "trip-plan" },
  { id: "m4-04-floor", file: "voice/m4-04-floor.wav", atScene: "live-floor" },
  { id: "m4-05-fit", file: "voice/m4-05-fit.wav", atScene: "fit-check" },
  { id: "m4-06-repair", file: "voice/m4-06-repair.wav", atScene: "repair" },
  { id: "m4-07-twin", file: "voice/m4-07-twin.wav", atScene: "twin" },
  { id: "m4-08-owner", file: "voice/m4-08-owner.wav", atScene: "owner-proof", offset: 0.35 },
  { id: "m4-08b-ops", file: "voice/m4-08b-ops.wav", atScene: "owner-proof", offset: 7.4 },
  { id: "m4-09-close", file: "voice/m4-09-close.wav", atScene: "close" },
] as const;

/** Brand stings. Dog voice on the payoff, never on the owner dashboard. */
export const BARKS = [
  { file: "sfx/bark-hello.wav", atScene: "meet-toto", offset: 6.4 },
  { file: "sfx/bark-yes.wav", atScene: "trip-plan", offset: 14.0 },
  { file: "sfx/bark-yes.wav", atScene: "fit-check", offset: 7.2 },
  { file: "sfx/bark-good.wav", atScene: "close", offset: 6.5 },
] as const;

export const SCENES = [
  {
    id: "cold-open",
    durationInFrames: 180,
    title: "Don't look lost",
    subtitle: "You know the mountain. The wall does not.",
  },
  {
    id: "meet-toto",
    durationInFrames: 270,
    title: "Hey. I'm Toto.",
    subtitle: "Stick with me.",
  },
  {
    id: "trip-plan",
    durationInFrames: 510,
    title: "Tell me the trip",
    subtitle: "Questions in. Two jackets out.",
  },
  {
    id: "live-floor",
    durationInFrames: 300,
    title: "I'll walk you there",
    subtitle: "Green when you're right.",
  },
  {
    id: "fit-check",
    durationInFrames: 300,
    title: "Snap a photo",
    subtitle: "I'll guess the sizes.",
  },
  {
    id: "repair",
    durationInFrames: 270,
    title: "Repair or replace",
    subtitle: "Keep it if the math says so.",
  },
  {
    id: "twin",
    durationInFrames: 300,
    title: "Shop with someone",
    subtitle: "One code. One list. No telephone.",
  },
  {
    id: "owner-proof",
    durationInFrames: 600,
    title: "Hear what walked out",
    subtitle: "Demand, gaps, the door QR, your catalog.",
  },
  {
    id: "close",
    durationInFrames: 240,
    title: "That's Toto",
    subtitle: "You leave sure. They finally hear you.",
  },
] as const;

const sceneFrames = SCENES.reduce(
  (total, scene) => total + scene.durationInFrames,
  0,
);

export const TOTAL_FRAMES =
  sceneFrames - TRANSITION_FRAMES * (SCENES.length - 1);

export const TOTAL_SECONDS = TOTAL_FRAMES / FPS;
