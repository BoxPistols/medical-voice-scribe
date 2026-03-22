import type { Meta, StoryObj } from "@storybook/react";
import ModeSwitcher from "./ModeSwitcher";
import { fn } from "@storybook/test";

const meta: Meta<typeof ModeSwitcher> = {
  title: "Components/ModeSwitcher",
  component: ModeSwitcher,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    currentMode: {
      control: "select",
      options: ["medical", "clock", "voice", "mentoring"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ModeSwitcher>;

export const Medical: Story = {
  args: {
    currentMode: "medical",
    onModeChange: fn(),
  },
};

export const Clock: Story = {
  args: {
    currentMode: "clock",
    onModeChange: fn(),
  },
};

export const Voice: Story = {
  args: {
    currentMode: "voice",
    onModeChange: fn(),
  },
};

export const Mentoring: Story = {
  args: {
    currentMode: "mentoring",
    onModeChange: fn(),
  },
};
