import type { Meta, StoryObj } from "@storybook/react";
import ErrorAlert from "./ErrorAlert";

const meta: Meta<typeof ErrorAlert> = {
  title: "Components/ErrorAlert",
  component: ErrorAlert,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ErrorAlert>;

export const Default: Story = {
  args: {
    message: "音声の解析中にエラーが発生しました。もう一度お試しください。",
    onClose: () => {},
  },
};

export const LongMessage: Story = {
  args: {
    message:
      "APIリクエストがタイムアウトしました。ネットワーク接続を確認し、しばらく時間をおいてから再度お試しください。問題が続く場合は、サポートまでお問い合わせください。エラーコード: TIMEOUT_ERR_5001",
    onClose: () => {},
  },
};
