import { readFileSync, existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  FPS,
  NARRATION,
  SCENES,
  TOTAL_FRAMES,
  TOTAL_SECONDS,
  TRANSITION_FRAMES,
} from "../src/storyboard";

const ROOT = path.resolve(__dirname, "..");

describe("storyboard contract", () => {
  it("keeps scene ids ordered and unique", () => {
    const ids = SCENES.map((s) => s.id);
    expect(ids).toEqual([
      "cold-open",
      "meet-toto",
      "trip-plan",
      "live-floor",
      "fit-check",
      "repair",
      "twin",
      "owner-proof",
      "close",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses positive durations and a showcase-length total", () => {
    for (const scene of SCENES) {
      expect(scene.durationInFrames).toBeGreaterThan(0);
    }
    const raw = SCENES.reduce((n, s) => n + s.durationInFrames, 0);
    expect(TOTAL_FRAMES).toBe(raw - TRANSITION_FRAMES * (SCENES.length - 1));
    expect(TOTAL_SECONDS).toBeGreaterThanOrEqual(70);
    expect(TOTAL_SECONDS).toBeLessThanOrEqual(110);
    expect(FPS).toBe(30);
  });

  it("requires real capture assets", () => {
    const required = [
      "recordings/walkthrough.mp4",
      "public/outing.jpg",
      "screenshots/dashboard-owner.png",
      "screenshots/dashboard-owner-scroll.png",
      "screenshots/dashboard-platform.png",
      "screenshots/dashboard-qr.png",
      "screenshots/dashboard-catalog.png",
      "screenshots/home.png",
      "screenshots/list.png",
      "screenshots/map.png",
      "screenshots/scan.png",
      "screenshots/scan-aisle.png",
      "screenshots/plan.png",
      "screenshots/plan-swipe.png",
      "screenshots/fit.png",
      "screenshots/fit-result.png",
      "screenshots/repair.png",
      "screenshots/connect.png",
      "screenshots/connected.png",
    ];
    for (const rel of required) {
      expect(existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("keeps on-screen copy free of em and en dashes", () => {
    const banned = /[—–]/;
    for (const scene of SCENES) {
      expect(scene.title).not.toMatch(banned);
      expect(scene.subtitle).not.toMatch(banned);
    }
  });

  it("maps narration to every story beat", () => {
    const sceneIds = new Set(SCENES.map((s) => s.id));
    expect(NARRATION.length).toBeGreaterThanOrEqual(9);
    for (const clip of NARRATION) {
      expect(sceneIds.has(clip.atScene)).toBe(true);
      const wav = path.join(ROOT, "public", clip.file);
      expect(existsSync(wav), clip.file).toBe(true);
    }
  });
});

describe("interaction plan", () => {
  it("has contiguous segments and semantic expectations", () => {
    const plan = JSON.parse(
      readFileSync(path.join(ROOT, "interaction_plan.json"), "utf8"),
    );
    expect(plan.width).toBeGreaterThan(0);
    expect(plan.height).toBeGreaterThan(0);
    expect(plan.fps).toBe(30);
    const segments = Object.values(plan.segments) as Array<{
      start: number;
      end: number;
    }>;
    expect(segments.length).toBeGreaterThan(0);
    let cursor = 0;
    for (const seg of segments.sort((a, b) => a.start - b.start)) {
      expect(seg.start).toBeGreaterThanOrEqual(cursor - 0.01);
      expect(seg.end).toBeGreaterThan(seg.start);
      cursor = seg.end;
    }
    expect(plan.actions.length).toBeGreaterThan(0);
  });
});
