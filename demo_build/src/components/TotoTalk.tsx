import React from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND } from "../storyboard";
import { TotoMascot } from "./TotoMascot";

const Bubble: React.FC<{ line: string; width?: number }> = ({
  line,
  width = 400,
}) => (
  <div
    style={{
      position: "relative",
      width,
      background: BRAND.paper,
      border: "2px solid rgba(49, 70, 60, 0.16)",
      borderRadius: 32,
      padding: "22px 26px",
      boxShadow: "0 16px 36px rgba(44, 36, 28, 0.12)",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: -14,
        bottom: 36,
        width: 26,
        height: 26,
        background: BRAND.paper,
        borderLeft: "2px solid rgba(49, 70, 60, 0.16)",
        borderBottom: "2px solid rgba(49, 70, 60, 0.16)",
        rotate: "48deg",
      }}
    />
    <div
      style={{
        color: BRAND.ink,
        fontSize: 26,
        lineHeight: 1.38,
        fontFamily: "DM Sans, sans-serif",
        fontWeight: 500,
      }}
    >
      {line}
    </div>
  </div>
);

export const TotoTalk: React.FC<{
  line: string;
  mascotSize?: number;
  placement?: "side" | "center";
}> = ({ line, mascotSize = 800, placement = "side" }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const centered = placement === "center";

  return (
    <Interactive.Div
      name="TotoTalk"
      style={{
        position: "absolute",
        left: centered ? 0 : 0,
        right: centered ? 0 : undefined,
        top: centered ? 0 : 20,
        bottom: centered ? 0 : -40,
        width: centered ? undefined : 1100,
        display: "flex",
        alignItems: centered ? "center" : "flex-start",
        justifyContent: centered ? "center" : "flex-start",
        gap: centered ? 12 : 0,
        opacity: interpolate(frame, [0, 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(
          frame,
          [0, 18],
          centered ? ["0px 28px", "0px 0px"] : ["-12px 0px", "0px 0px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          },
        ),
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <TotoMascot size={mascotSize} />
        {centered ? null : (
          <div
            style={{
              position: "absolute",
              left: "76%",
              top: "4%",
              zIndex: 2,
            }}
          >
            <Bubble line={line} width={360} />
          </div>
        )}
      </div>
      {centered ? <Bubble line={line} width={420} /> : null}
    </Interactive.Div>
  );
};
