import type { Meta, StoryObj } from "@storybook/react";
import SessionDrawer from "./SessionDrawer";
import { fn } from "storybook/test";
import type { RecordStore } from "@/lib/recordStore";

const mockStore: RecordStore = {
  version: 1,
  activeSessionId: "session-1",
  sessions: [
    {
      id: "session-1",
      label: "田中太郎 腰痛",
      patientTag: "患者A",
      category: "medical",
      createdAt: new Date("2025-01-15T09:00:00").toISOString(),
      updatedAt: new Date("2025-01-15T09:30:00").toISOString(),
      transcript: "患者は頭痛を訴えて来院...",
      soapNote: null,
      chatHistory: [],
      tokenUsage: null,
    },
    {
      id: "session-2",
      label: "鈴木花子 血圧経過",
      patientTag: "患者B",
      category: "medical",
      createdAt: new Date("2025-01-14T14:00:00").toISOString(),
      updatedAt: new Date("2025-01-14T14:45:00").toISOString(),
      transcript: "血圧の経過観察...",
      soapNote: null,
      chatHistory: [],
      tokenUsage: null,
    },
    {
      id: "session-3",
      label: "買い物メモ",
      patientTag: "",
      category: "daily",
      createdAt: new Date("2025-01-13T18:00:00").toISOString(),
      updatedAt: new Date("2025-01-13T18:05:00").toISOString(),
      transcript: "牛乳、卵、パン...",
      soapNote: null,
      chatHistory: [],
      tokenUsage: null,
    },
    {
      id: "session-4",
      label: "学会メモ",
      patientTag: "",
      category: "memo",
      createdAt: new Date("2025-01-12T10:00:00").toISOString(),
      updatedAt: new Date("2025-01-12T11:30:00").toISOString(),
      transcript: "新しい治療法について...",
      soapNote: null,
      chatHistory: [],
      tokenUsage: null,
    },
  ],
};

const meta: Meta<typeof SessionDrawer> = {
  title: "Components/SessionDrawer",
  component: SessionDrawer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SessionDrawer>;

export const Open: Story = {
  args: {
    open: true,
    onClose: fn(),
    store: mockStore,
    onStoreChange: fn(),
  },
};

export const Empty: Story = {
  args: {
    open: true,
    onClose: fn(),
    store: { version: 1, activeSessionId: null, sessions: [] },
    onStoreChange: fn(),
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: fn(),
    store: mockStore,
    onStoreChange: fn(),
  },
};
