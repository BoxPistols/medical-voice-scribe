import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { TitleScene } from "./TitleScene";

const meta: Meta<typeof TitleScene> = {
  title: "Remotion/Scenes/TitleScene",
  component: TitleScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TitleScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={TitleScene}
      durationInFrames={120}
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
    sceneDuration: 120,
  },
};
