import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

const CenterReveal: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationDirection, presentationProgress }) => {
  const entering = presentationDirection === "entering";
  const p = presentationProgress;

  return (
    <AbsoluteFill
      style={{
        opacity: entering ? p : 1 - p,
        scale: entering ? 0.88 + 0.12 * p : 1 + 0.08 * p,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const centerReveal = (): TransitionPresentation<
  Record<string, never>
> => ({
  component: CenterReveal,
  props: {},
});
