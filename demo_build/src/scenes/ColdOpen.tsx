import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { BRAND } from "../storyboard";

const LINE = "You know the mountain. You just don't want to look lost.";
const TYPE_START = 16;
const FRAMES_PER_CHAR = 2.15;
const PAUSE_AFTER = LINE.indexOf(".") + 1;
const PAUSE_FRAMES = 10;

function typedLength(frame: number): number {
  const t = frame - TYPE_START;
  if (t <= 0) return 0;
  const firstCost = PAUSE_AFTER * FRAMES_PER_CHAR;
  if (t <= firstCost) {
    return Math.min(PAUSE_AFTER, Math.floor(t / FRAMES_PER_CHAR));
  }
  const afterPause = t - firstCost - PAUSE_FRAMES;
  if (afterPause <= 0) return PAUSE_AFTER;
  return Math.min(
    LINE.length,
    PAUSE_AFTER + Math.floor(afterPause / FRAMES_PER_CHAR),
  );
}

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const ken = interpolate(frame, [0, 180], [1.06, 1.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shift = interpolate(frame, [0, 180], ["42% 62%", "52% 70%"], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const count = typedLength(frame);
  const shown = LINE.slice(0, count);
  const typing = count < LINE.length;
  const caret = typing && frame % 14 < 9;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1A1E1C" }}>
      <AbsoluteFill
        style={{
          overflow: "hidden",
          opacity: interpolate(frame, [0, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            scale: ken,
          }}
        >
          <Img
            src={staticFile("outing.jpg")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: shift,
            }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(18, 20, 18, 0.78) 0%, rgba(18, 20, 18, 0.52) 42%, rgba(18, 20, 18, 0.12) 72%, rgba(18, 20, 18, 0.28) 100%)",
        }}
      />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
        <Interactive.Div
          name="Title"
          style={{
            color: BRAND.paper,
            fontSize: 84,
            lineHeight: 1.12,
            maxWidth: 980,
            minHeight: 280,
            fontFamily: "Fraunces, Georgia, serif",
            fontWeight: 600,
            textShadow: "0 12px 40px rgba(0,0,0,0.35)",
            opacity: interpolate(frame, [10, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            }),
          }}
        >
          {shown}
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 72,
              marginLeft: 6,
              marginBottom: -8,
              backgroundColor: caret ? BRAND.paper : "transparent",
              verticalAlign: "middle",
            }}
          />
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
