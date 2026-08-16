import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";

/** Cream-washed Toto loop. Never cover-crop. */
export const TOTO_LOOP_W = 620;
export const TOTO_LOOP_H = 552;
const FRAME_COUNT = 24;
const SRC_FPS = 12;

export const TotoMascot: React.FC<{
  size?: number;
}> = ({ size = 800 }) => {
  const frame = useCurrentFrame();
  const height = Math.round((size * TOTO_LOOP_H) / TOTO_LOOP_W);
  const idx = (Math.floor((frame * SRC_FPS) / 30) % FRAME_COUNT) + 1;
  const src = staticFile(`toto/loop/c${String(idx).padStart(3, "0")}.png`);

  return (
    <div
      style={{
        width: size,
        height,
        position: "relative",
        overflow: "visible",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
    </div>
  );
};
