import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { SceneBackground } from "./TitleCard";
import { BRAND } from "../storyboard";

const PHONE_W = 390;
const PHONE_H = 844;
const BEZEL = 12;
const OUTER_RADIUS = 56;
const INNER_RADIUS = 44;
const OUTER_W = PHONE_W + BEZEL * 2;
const OUTER_H = PHONE_H + BEZEL * 2;

export const PhoneOnRight: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

export const PhoneFrame: React.FC<{
  children: React.ReactNode;
  zoom?: number;
}> = ({ children, zoom = 0.96 }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const z = zoom;

  return (
    <div
      style={{
        opacity: interpolate(frame, [0, 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(frame, [0, 18], ["0px 22px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        position: "relative",
        width: OUTER_W * z,
        height: OUTER_H * z,
        borderRadius: OUTER_RADIUS * z,
        background:
          "linear-gradient(180deg, #3A3A3C 0%, #1C1C1E 42%, #0E0E10 100%)",
        boxShadow:
          "0 28px 50px rgba(14, 14, 16, 0.32), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 1px 0 rgba(255,255,255,0.28) inset",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -3 * z,
          top: 168 * z,
          width: 4 * z,
          height: 36 * z,
          borderRadius: 2 * z,
          background: "#2C2C2E",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3 * z,
          top: 214 * z,
          width: 4 * z,
          height: 62 * z,
          borderRadius: 2 * z,
          background: "#2C2C2E",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -3 * z,
          top: 228 * z,
          width: 4 * z,
          height: 78 * z,
          borderRadius: 2 * z,
          background: "#2C2C2E",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: BEZEL * z,
          left: BEZEL * z,
          width: PHONE_W * z,
          height: PHONE_H * z,
          borderRadius: INNER_RADIUS * z,
          overflow: "hidden",
          background: BRAND.paper,
        }}
      >
        {children}
        <div
          style={{
            position: "absolute",
            bottom: 10 * z,
            left: "50%",
            width: 128 * z,
            height: 5 * z,
            marginLeft: -64 * z,
            borderRadius: 100,
            background: "rgba(255,255,255,0.42)",
          }}
        />
      </div>
    </div>
  );
};

export const WalkthroughClip: React.FC<{
  startFrom: number;
  endAt: number;
  zoom?: number;
}> = ({ startFrom, endAt, zoom }) => {
  return (
    <PhoneFrame zoom={zoom}>
      <Video
        src={staticFile("walkthrough.mp4")}
        trimBefore={startFrom}
        trimAfter={endAt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: BRAND.paper,
        }}
        volume={0}
      />
    </PhoneFrame>
  );
};

export const EvidenceShot: React.FC<{
  file: string;
  caption: string;
  objectPosition?: string;
  mood?: "warm" | "lift" | "tension";
}> = ({ file, objectPosition = "top", mood = "warm" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const zoom = interpolate(frame, [0, 1.1 * fps, 4.4 * fps], [0.82, 0.82, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  return (
    <AbsoluteFill>
      <SceneBackground mood={mood} />
      <PhoneOnRight>
        <PhoneFrame zoom={zoom}>
          <Img
            src={staticFile(file)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition,
            }}
          />
        </PhoneFrame>
      </PhoneOnRight>
    </AbsoluteFill>
  );
};

export const SideCopy: React.FC<{
  kicker: string;
  title: string;
  body: string;
  beat?: string;
}> = ({ kicker, title, body, beat }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <>
      <Interactive.Div
        name="SideCopy"
        style={{
          position: "absolute",
          left: 108,
          top: 168,
          maxWidth: 500,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
        }}
      >
        <div
          style={{
            color: BRAND.ember,
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            color: BRAND.ink,
            fontSize: 52,
            lineHeight: 1.08,
            fontFamily: "Fraunces, Georgia, serif",
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: BRAND.inkSoft,
            fontSize: 26,
            lineHeight: 1.45,
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          {body}
        </div>
      </Interactive.Div>
      {beat ? (
        <Interactive.Div
          name="Beat"
          style={{
            position: "absolute",
            left: 108,
            bottom: 110,
            color: BRAND.pine,
            fontFamily: "DM Sans, sans-serif",
            fontSize: 22,
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [16, 32], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {beat}
        </Interactive.Div>
      ) : null}
    </>
  );
};
