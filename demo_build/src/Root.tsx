import React from "react";
import { Composition, Folder } from "remotion";
import { Demo } from "./Demo";
import { ColdOpen } from "./scenes/ColdOpen";
import { MeetToto } from "./scenes/MeetToto";
import { TripPlan } from "./scenes/TripPlan";
import { LiveFloor } from "./scenes/LiveFloor";
import { FitCheck } from "./scenes/FitCheck";
import { RepairLens } from "./scenes/RepairLens";
import { TwinShop } from "./scenes/TwinShop";
import { OwnerProof } from "./scenes/OwnerProof";
import { Close } from "./scenes/Close";
import {
  FPS,
  HEIGHT,
  SCENES,
  TOTAL_FRAMES,
  WIDTH,
} from "./storyboard";

const duration = (id: (typeof SCENES)[number]["id"]) =>
  SCENES.find((s) => s.id === id)!.durationInFrames;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Folder name="Scenes">
        <Composition id="ColdOpen" component={ColdOpen} durationInFrames={duration("cold-open")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="MeetToto" component={MeetToto} durationInFrames={duration("meet-toto")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="TripPlan" component={TripPlan} durationInFrames={duration("trip-plan")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="LiveFloor" component={LiveFloor} durationInFrames={duration("live-floor")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="FitCheck" component={FitCheck} durationInFrames={duration("fit-check")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="RepairLens" component={RepairLens} durationInFrames={duration("repair")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="TwinShop" component={TwinShop} durationInFrames={duration("twin")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="OwnerProof" component={OwnerProof} durationInFrames={duration("owner-proof")} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Close" component={Close} durationInFrames={duration("close")} fps={FPS} width={WIDTH} height={HEIGHT} />
      </Folder>
    </>
  );
};
