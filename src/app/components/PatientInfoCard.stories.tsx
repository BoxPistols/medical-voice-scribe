import type { Meta, StoryObj } from "@storybook/react";
import PatientInfoCard from "./PatientInfoCard";

const meta: Meta<typeof PatientInfoCard> = {
  title: "Components/PatientInfoCard",
  component: PatientInfoCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PatientInfoCard>;

export const Full: Story = {
  args: {
    chiefComplaint: "右足親指の激痛",
    duration: "昨夜から",
  },
};

export const OnlyComplaint: Story = {
  args: {
    chiefComplaint: "持続的な頭痛とめまい",
  },
};

export const OnlyDuration: Story = {
  args: {
    duration: "3日前から",
  },
};
