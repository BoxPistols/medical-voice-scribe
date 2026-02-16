import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { FeaturesScene } from "./FeaturesScene";

const meta: Meta<typeof FeaturesScene> = {
  title: "Remotion/Scenes/FeaturesScene",
  component: FeaturesScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof FeaturesScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={FeaturesScene}
      durationInFrames={240}
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
    sceneDuration: 240,
  },
};
