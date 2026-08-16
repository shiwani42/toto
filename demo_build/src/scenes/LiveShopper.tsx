import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneBackground } from "../components/TitleCard";
import { SideCopy, WalkthroughClip } from "../components/Evidence";
import { FPS } from "../storyboard";

export const LiveShopper: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  const zoom = interpolate(frame, [0, 2.4 * fps, 5.2 * fps], [0.7, 0.7, 0.98], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  const beat =
    frame < 8 * fps
      ? "See the whole companion first"
      : frame < 13 * fps
        ? "Name Saturday"
        : "Leave with two, not twenty";

  return (
    <AbsoluteFill>
      <SceneBackground mood="warm" />
      <SideCopy
        kicker="You"
        title="Tell me the trip"
        body="I'll shrink the wall to the two that fit. Not twenty. Not a lecture. Two."
        beat={beat}
      />
      <AbsoluteFill style={{ left: 240 }}>
        <WalkthroughClip
          startFrom={Math.round(2.5 * FPS)}
          endAt={Math.round(29 * FPS)}
          zoom={zoom}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
