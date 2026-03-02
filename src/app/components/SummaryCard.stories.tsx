import type { Meta, StoryObj } from "@storybook/react";
import SummaryCard from "./SummaryCard";

const meta: Meta<typeof SummaryCard> = {
  title: "Components/SummaryCard",
  component: SummaryCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SummaryCard>;

export const Default: Story = {
  args: {
    summary:
      "45歳男性、昨夜からの急な右足親指の痛みと腫れ。痛風が疑われる。",
  },
};

export const LongSummary: Story = {
  args: {
    summary:
      "62歳女性、3日前からの持続的な頭痛と軽度のめまいを主訴に来院。既往歴に高血圧症あり、降圧薬を内服中。血圧は来院時160/95mmHgとやや高値。神経学的所見に異常なし。高血圧性頭痛が疑われるが、頭部CT検査にて器質的疾患の除外が必要。降圧薬の調整と経過観察を行う方針。",
  },
};
