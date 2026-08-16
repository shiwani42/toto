import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EvidenceShot } from "../components/Evidence";

export const TwinShop: React.FC = () => {
  const { fps } = useVideoConfig();
  const lobby = Math.round(4 * fps);

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={lobby} layout="none">
        <EvidenceShot
          file="connect.png"
          caption="Shopping with someone? Share a code."
          mood="lift"
        />
      </Sequence>
      <Sequence from={lobby} layout="none">
        <EvidenceShot
          file="connected.png"
          caption="You both see the list."
          mood="lift"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
