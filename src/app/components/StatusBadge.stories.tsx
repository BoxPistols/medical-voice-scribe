import type { Meta, StoryObj } from "@storybook/react";
import StatusBadge from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Idle: Story = {
  args: { isRecording: false },
};

export const Recording: Story = {
  args: { isRecording: true },
};
