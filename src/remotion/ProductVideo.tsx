import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TitleScene } from "./components/TitleScene";
import { ProblemScene } from "./components/ProblemScene";
import { SolutionScene } from "./components/SolutionScene";
import { FeaturesScene } from "./components/FeaturesScene";
import { HowItWorksScene } from "./components/HowItWorksScene";
import { CtaScene } from "./components/CtaScene";
import { FONT_FAMILY } from "./fonts";

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

const scenes = [
  { Component: TitleScene, duration: TITLE_DURATION },
  { Component: ProblemScene, duration: PROBLEM_DURATION },
  { Component: SolutionScene, duration: SOLUTION_DURATION },
  { Component: FeaturesScene, duration: FEATURES_DURATION },
  { Component: HowItWorksScene, duration: HOWITWORKS_DURATION },
  { Component: CtaScene, duration: CTA_DURATION },
];

const scenesWithOffsets = scenes.reduce<
  (typeof scenes[number] & { from: number })[]
>((acc, scene) => {
  const prev = acc[acc.length - 1];
  const from = prev ? prev.from + prev.duration : 0;
  return [...acc, { ...scene, from }];
}, []);

export const ProductVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // BGM volume: fade in over first 1s, fade out over last 2s
  const fadeInEnd = 30;
  const fadeOutStart = TOTAL_DURATION - 60;
  const bgmVolume = interpolate(
    frame,
    [0, fadeInEnd, fadeOutStart, TOTAL_DURATION],
    [0, 0.25, 0.25, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: "#0f172a", fontFamily: FONT_FAMILY }}>
      <Audio src={staticFile("bgm.mp3")} volume={bgmVolume} />
      {scenesWithOffsets.map(({ Component, duration, from }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <Component sceneDuration={duration} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
