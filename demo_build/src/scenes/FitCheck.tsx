import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EvidenceShot } from "../components/Evidence";

export const FitCheck: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={Math.round(4 * fps)} layout="none">
        <EvidenceShot
          file="fit.png"
          caption="Snap a photo. I'll guess your sizes, so the wall stops being a guessing game."
        />
      </Sequence>
      <Sequence from={Math.round(4 * fps)} layout="none">
        <EvidenceShot
          file="fit-result.png"
          caption="Here's what I'd guess. Medium. EU 42."
        />
      </Sequence>
    </AbsoluteFill>
  );
};
