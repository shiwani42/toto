import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND } from "../storyboard";

export const SceneBackground: React.FC<{ mood?: "tension" | "warm" | "lift" }> = () => {
  return <AbsoluteFill style={{ background: BRAND.linen }} />;
};

export const TitleCard: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
}> = ({ title, subtitle, eyebrow = "Toto" }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 160px",
      }}
    >
      <Interactive.Div
        name="Eyebrow"
        style={{
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
          color: BRAND.ember,
          fontSize: 22,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 28,
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
        }}
      >
        {eyebrow}
      </Interactive.Div>
      <Interactive.Div
        name="Title"
        style={{
          opacity: interpolate(frame, [8, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
          translate: interpolate(frame, [8, 30], ["0px 24px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
          color: BRAND.ink,
          fontSize: 88,
          lineHeight: 1.06,
          maxWidth: 1380,
          fontFamily: "Fraunces, Georgia, serif",
          fontWeight: 600,
          letterSpacing: "-0.03em",
        }}
      >
        {title}
      </Interactive.Div>
      {subtitle ? (
        <Interactive.Div
          name="Subtitle"
          style={{
            opacity: interpolate(frame, [22, 44], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            }),
            color: BRAND.inkSoft,
            fontSize: 36,
            lineHeight: 1.4,
            marginTop: 28,
            maxWidth: 920,
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 500,
          }}
        >
          {subtitle}
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
