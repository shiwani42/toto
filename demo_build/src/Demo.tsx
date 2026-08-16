import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { centerReveal } from "./components/CenterReveal";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadDmSans } from "@remotion/google-fonts/DMSans";
import {
  BARKS,
  BRAND,
  FPS,
  NARRATION,
  SCENES,
  TOTAL_FRAMES,
  TRANSITION_FRAMES,
} from "./storyboard";
import { ColdOpen } from "./scenes/ColdOpen";
import { MeetToto } from "./scenes/MeetToto";
import { TripPlan } from "./scenes/TripPlan";
import { LiveFloor } from "./scenes/LiveFloor";
import { FitCheck } from "./scenes/FitCheck";
import { RepairLens } from "./scenes/RepairLens";
import { TwinShop } from "./scenes/TwinShop";
import { OwnerProof } from "./scenes/OwnerProof";
import { Close } from "./scenes/Close";

loadFraunces("normal", {
  weights: ["600"],
  subsets: ["latin"],
});
loadDmSans("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

const sceneMap = {
  "cold-open": ColdOpen,
  "meet-toto": MeetToto,
  "trip-plan": TripPlan,
  "live-floor": LiveFloor,
  "fit-check": FitCheck,
  repair: RepairLens,
  twin: TwinShop,
  "owner-proof": OwnerProof,
  close: Close,
} as const;

function sceneStarts(): Record<string, number> {
  const starts: Record<string, number> = {};
  let cursor = 0;
  SCENES.forEach((scene, index) => {
    starts[scene.id] = cursor;
    cursor += scene.durationInFrames;
    if (index < SCENES.length - 1) cursor -= TRANSITION_FRAMES;
  });
  return starts;
}

export const Demo: React.FC = () => {
  const starts = sceneStarts();

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.linen }}>
      <Audio
        src={staticFile("score.wav")}
        volume={(f) => {
          const fadeIn = Math.min(1, f / (FPS * 0.8));
          const fadeOut = Math.min(1, (TOTAL_FRAMES - f) / (FPS * 2.0));
          const nearBark = BARKS.some((bark) => {
            const start = starts[bark.atScene] + Math.round(bark.offset * FPS);
            return f >= start - 2 && f <= start + Math.round(0.9 * FPS);
          });
          const duck = nearBark ? 0.08 : f < 6 * FPS ? 0.55 : 0.34;
          return duck * Math.min(fadeIn, fadeOut);
        }}
      />
      {NARRATION.map((clip) => (
        <Sequence
          key={clip.id}
          from={
            starts[clip.atScene] +
            Math.round((("offset" in clip ? clip.offset : 0.35) as number) * FPS)
          }
          layout="none"
        >
          <Audio src={staticFile(clip.file)} volume={1} />
        </Sequence>
      ))}
      {BARKS.map((bark) => (
        <Sequence
          key={`${bark.atScene}-${bark.file}-${bark.offset}`}
          from={starts[bark.atScene] + Math.round(bark.offset * FPS)}
          durationInFrames={Math.round(1.0 * FPS)}
        >
          <Audio src={staticFile(bark.file)} volume={0.55} />
        </Sequence>
      ))}
      <TransitionSeries>
        {SCENES.flatMap((scene, index) => {
          const Component = sceneMap[scene.id];
          const nodes = [
            <TransitionSeries.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              name={scene.id}
            >
              <Component />
            </TransitionSeries.Sequence>,
          ];
          if (index < SCENES.length - 1) {
            nodes.push(
              <TransitionSeries.Transition
                key={`${scene.id}-fade`}
                presentation={centerReveal()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }
          return nodes;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
