import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EvidenceShot } from "../components/Evidence";
import { FeatureBeat } from "./FeatureBeat";
import { WALK } from "../storyboard";

export const TripPlan: React.FC = () => {
  const { fps } = useVideoConfig();
  const questions = Math.round(11 * fps);

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={questions} layout="none">
        <FeatureBeat
          line="Tell me the trip. I'll ask the questions, then shrink two hundred jackets to the two that fit Saturday."
          clipStart={WALK.plan.start}
          clipEnd={WALK.plan.end}
        />
      </Sequence>
      <Sequence from={questions} layout="none">
        <EvidenceShot
          file="plan-swipe.png"
          caption="The list, from the trip you named."
        />
      </Sequence>
    </AbsoluteFill>
  );
};
