import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneBackground } from "../components/TitleCard";
import { PhoneFrame, PhoneOnRight } from "../components/Evidence";

export const MeetToto: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const zoom = interpolate(frame, [0, 1.2 * fps, 4.6 * fps], [0.82, 0.82, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  return (
    <AbsoluteFill>
      <SceneBackground mood="warm" />
      <PhoneOnRight>
        <PhoneFrame zoom={zoom}>
          <Img
            src={staticFile("home.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
            }}
          />
        </PhoneFrame>
      </PhoneOnRight>
    </AbsoluteFill>
  );
};
