import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { ProblemScene } from "./ProblemScene";

const meta: Meta<typeof ProblemScene> = {
  title: "Remotion/Scenes/ProblemScene",
  component: ProblemScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ProblemScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={ProblemScene}
      durationInFrames={180}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={30}
      inputProps={args}
      controls
      autoPlay
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
      }}
    />
  ),
  args: {
    sceneDuration: 180,
  },
};
