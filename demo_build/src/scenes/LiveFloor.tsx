import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EvidenceShot } from "../components/Evidence";

export const LiveFloor: React.FC = () => {
  const { fps } = useVideoConfig();
  const mapBeat = Math.round(3.2 * fps);

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={mapBeat} layout="none">
        <EvidenceShot
          file="map.png"
          caption="Then I walk you there. The map names the zone, not the whole wall."
        />
      </Sequence>
      <Sequence from={mapBeat} layout="none">
        <EvidenceShot
          file="scan-aisle.png"
          caption="Point me at the shelf. Green when you're right. Quiet when you're not."
        />
      </Sequence>
    </AbsoluteFill>
  );
};
