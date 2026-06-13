import type { Meta, StoryObj } from "@storybook/react";
import { Player } from "@remotion/player";
import { VoiceRecorderScene } from "./VoiceRecorderScene";

const meta: Meta<typeof VoiceRecorderScene> = {
  title: "Remotion/Scenes/VoiceRecorderScene",
  component: VoiceRecorderScene,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof VoiceRecorderScene>;

export const Default: Story = {
  render: (args) => (
    <Player
      component={VoiceRecorderScene}
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
