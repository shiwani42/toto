import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneBackground } from "../components/TitleCard";
import { PhoneOnRight, WalkthroughClip } from "../components/Evidence";
import { FPS } from "../storyboard";

export const FeatureBeat: React.FC<{
  line: string;
  clipStart: number;
  clipEnd: number;
  mood?: "warm" | "lift" | "tension";
  wideThenZoom?: boolean;
}> = ({
  clipStart,
  clipEnd,
  mood = "warm",
  wideThenZoom = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const zoom = wideThenZoom
    ? interpolate(frame, [0, 1.2 * fps, 4.6 * fps], [0.82, 0.82, 1.14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      })
    : 0.96;

  return (
    <AbsoluteFill>
      <SceneBackground mood={mood} />
      <PhoneOnRight>
        <WalkthroughClip
          startFrom={Math.round(clipStart * FPS)}
          endAt={Math.round(clipEnd * FPS)}
          zoom={zoom}
        />
      </PhoneOnRight>
    </AbsoluteFill>
  );
};
