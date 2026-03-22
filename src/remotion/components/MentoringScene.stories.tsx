import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { MentoringScene } from "./MentoringScene";

const meta: Meta<typeof MentoringScene> = {
  title: "Remotion/Scenes/MentoringScene",
  component: MentoringScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof MentoringScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={MentoringScene}
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
