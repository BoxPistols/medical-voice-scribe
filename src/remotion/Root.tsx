import React from "react";
import { Composition } from "remotion";
import { ProductVideo, TOTAL_DURATION } from "./ProductVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductVideo"
        component={ProductVideo}
        durationInFrames={TOTAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
