import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TitleScene } from "./components/TitleScene";
import { ProblemScene } from "./components/ProblemScene";
import { SolutionScene } from "./components/SolutionScene";
import { FeaturesScene } from "./components/FeaturesScene";
import { HowItWorksScene } from "./components/HowItWorksScene";
import { CtaScene } from "./components/CtaScene";

// 30fps, total ~40 seconds (1200 frames)
// Scene durations in frames:
const TITLE_DURATION = 150; // 5s
const PROBLEM_DURATION = 210; // 7s
const SOLUTION_DURATION = 210; // 7s
const FEATURES_DURATION = 240; // 8s
const HOWITWORKS_DURATION = 210; // 7s
const CTA_DURATION = 180; // 6s

export const TOTAL_DURATION =
  TITLE_DURATION +
  PROBLEM_DURATION +
  SOLUTION_DURATION +
  FEATURES_DURATION +
  HOWITWORKS_DURATION +
  CTA_DURATION;

export const ProductVideo: React.FC = () => {
  let offset = 0;

  const scenes = [
    { Component: TitleScene, duration: TITLE_DURATION },
    { Component: ProblemScene, duration: PROBLEM_DURATION },
    { Component: SolutionScene, duration: SOLUTION_DURATION },
    { Component: FeaturesScene, duration: FEATURES_DURATION },
    { Component: HowItWorksScene, duration: HOWITWORKS_DURATION },
    { Component: CtaScene, duration: CTA_DURATION },
  ];

  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {scenes.map(({ Component, duration }, i) => {
        const from = offset;
        offset += duration;
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
