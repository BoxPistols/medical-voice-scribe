import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { PomodoroScene } from "./PomodoroScene";

const meta: Meta<typeof PomodoroScene> = {
  title: "Remotion/Scenes/PomodoroScene",
  component: PomodoroScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof PomodoroScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={PomodoroScene}
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
