import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { AppModesScene } from "./AppModesScene";

const meta: Meta<typeof AppModesScene> = {
  title: "Remotion/Scenes/AppModesScene",
  component: AppModesScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof AppModesScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={AppModesScene}
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
