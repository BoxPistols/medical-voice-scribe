import type { Meta, StoryObj } from "@storybook/react";
import SOAPSectionWrapper from "./SOAPSectionWrapper";

const meta: Meta<typeof SOAPSectionWrapper> = {
  title: "Components/SOAPSectionWrapper",
  component: SOAPSectionWrapper,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SOAPSectionWrapper>;

export const Subjective: Story = {
  args: {
    type: "subjective",
    badge: "S",
    label: "主観的情報",
    onCopy: () => {},
    children: (
      <div>
        <div className="font-bold text-xs text-theme-secondary mb-1">現病歴</div>
        <div className="soap-content">
          昨夜の宴会後、深夜に右足第一趾中足趾節関節の激痛で目が覚めた。歩行困難。
        </div>
      </div>
    ),
  },
};

export const Objective: Story = {
  args: {
    type: "objective",
    badge: "O",
    label: "客観的情報",
    onCopy: () => {},
    children: (
      <div>
        <div className="font-bold text-xs text-theme-secondary mb-1">身体所見</div>
        <div className="soap-content">
          右第1MTP関節に高度の腫脹、発赤、熱感あり。触れるだけで激痛を訴える。
        </div>
      </div>
    ),
  },
};

export const Assessment: Story = {
  args: {
    type: "assessment",
    badge: "A",
    label: "評価・診断",
    onCopy: () => {},
    children: (
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-bold text-xs text-theme-secondary">診断名:</span>
        <span className="soap-content font-bold">痛風発作 (急性痛風性関節炎)</span>
        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-mono">
          M10.0
        </span>
      </div>
    ),
  },
};

export const Plan: Story = {
  args: {
    type: "plan",
    badge: "P",
    label: "治療計画",
    onCopy: () => {},
    children: (
      <div>
        <div className="font-bold text-xs text-theme-secondary mb-1">治療方針</div>
        <div className="soap-content">患部の冷却と安静。水分摂取の励行。</div>
      </div>
    ),
  },
};
