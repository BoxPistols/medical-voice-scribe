import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { SolutionScene } from "./SolutionScene";

const meta: Meta<typeof SolutionScene> = {
  title: "Remotion/Scenes/SolutionScene",
  component: SolutionScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof SolutionScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={SolutionScene}
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
