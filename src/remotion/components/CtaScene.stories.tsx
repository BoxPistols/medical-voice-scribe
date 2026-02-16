import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { CtaScene } from "./CtaScene";

const meta: Meta<typeof CtaScene> = {
  title: "Remotion/Scenes/CtaScene",
  component: CtaScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof CtaScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={CtaScene}
      durationInFrames={150}
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
    sceneDuration: 150,
  },
};
