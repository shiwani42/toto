import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EvidenceShot } from "../components/Evidence";

export const OwnerProof: React.FC = () => {
  const { fps } = useVideoConfig();
  const ownerVo = Math.round(7 * fps);
  const wanted = Math.round(4 * fps);
  const qr = Math.round(4.5 * fps);

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={ownerVo} layout="none">
        <EvidenceShot
          file="dashboard-owner.png"
          caption="Those silent visits were demand. On lists. Scanned. Named."
          mood="lift"
        />
      </Sequence>
      <Sequence from={ownerVo} durationInFrames={wanted} layout="none">
        <EvidenceShot
          file="dashboard-owner-scroll.png"
          caption="Who's shopping. What they wanted. Gaps you can fill."
          mood="lift"
        />
      </Sequence>
      <Sequence from={ownerVo + wanted} durationInFrames={qr} layout="none">
        <EvidenceShot
          file="dashboard-qr.png"
          caption="The door QR. They walk in without performing."
          mood="lift"
        />
      </Sequence>
      <Sequence from={ownerVo + wanted + qr} layout="none">
        <EvidenceShot
          file="dashboard-catalog.png"
          caption="Your catalog. Print the sheet. Stock what they ask for."
          mood="lift"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
