import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { HowItWorksScene } from "./HowItWorksScene";

const meta: Meta<typeof HowItWorksScene> = {
  title: "Remotion/Scenes/HowItWorksScene",
  component: HowItWorksScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof HowItWorksScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={HowItWorksScene}
      durationInFrames={210}
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
    sceneDuration: 210,
  },
};
