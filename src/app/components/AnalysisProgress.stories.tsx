import type { Meta, StoryObj } from "@storybook/react";
import AnalysisProgress from "./AnalysisProgress";

const meta: Meta<typeof AnalysisProgress> = {
  title: "Components/AnalysisProgress",
  component: AnalysisProgress,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AnalysisProgress>;

export const Preparing: Story = {
  args: {
    isStreaming: false,
    streamingText: "",
    progress: 15,
    modelName: "GPT-4.1 Mini",
  },
};

export const Streaming: Story = {
  args: {
    isStreaming: true,
    streamingText:
      '{"summary":"45歳男性、昨夜からの急な右足親指の痛みと腫れ。","patientInfo":{"chiefComplaint":"右足親指の激痛"...',
    progress: 52,
    modelName: "GPT-4.1 Mini",
  },
};

export const AlmostDone: Story = {
  args: {
    isStreaming: true,
    streamingText:
      '{"summary":"45歳男性、昨夜からの急な右足親指の痛みと腫れ。痛風が疑われる。","patientInfo":{"chiefComplaint":"右足親指の激痛","duration":"昨夜から"},"soap":{"subjective":{"presentIllness":"昨夜の宴会後、深夜に右足第一趾中足趾節関節の激痛で目が覚めた。","symptoms":["激痛","腫脹","発赤","熱感"],"severity":"重度 (10/10)"}}}',
    progress: 89,
    modelName: "GPT-5 Mini",
  },
};
