import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ModeSwitcher, { MODES } from "./ModeSwitcher";
import StatusBadge from "./StatusBadge";
import { fn } from "storybook/test";

// モードを手で並べると、増えたときにこの一覧だけ置き去りになる。定義から導出する
const MODE_IDS = MODES.map((m) => m.id);

const meta: Meta<typeof ModeSwitcher> = {
  title: "Components/ModeSwitcher",
  component: ModeSwitcher,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { onModeChange: fn() },
  argTypes: {
    currentMode: { control: "select", options: MODE_IDS },
  },
};

export default meta;
type Story = StoryObj<typeof ModeSwitcher>;

export const SelectedMedical: Story = {
  name: "選択中: 医療カルテ",
  args: { currentMode: "medical" },
};

export const SelectedSymptom: Story = {
  name: "選択中: 症状チェッカー",
  args: { currentMode: "symptom" },
};

export const SelectedClock: Story = {
  name: "選択中: 時計",
  args: { currentMode: "clock" },
};

/** 9モードすべてを選択状態で並べる。選択の見え方が全モードで揃っているかを見る */
export const AllModes: Story = {
  name: "全モードの選択状態",
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-3">
      {MODE_IDS.map((id) => (
        <div key={id} className="flex items-center gap-3">
          <code className="text-xs text-ink-faint w-20 shrink-0">{id}</code>
          <ModeSwitcher currentMode={id} onModeChange={fn()} />
        </div>
      ))}
    </div>
  ),
};

/**
 * ラベルの出し分けはビューポートではなくヘッダー行の幅で決まる。
 * 行の幅が1360px以上でラベルが付き、それ未満はアイコンだけになる。
 * アプリではヘッダーに左右16pxずつのパディングがあるので、
 * ビューポートでは1392pxが境界になる。実際のヘッダーはe2e/vrt.spec.tsが幅ごとに撮っている。
 */
export const ResponsiveLabels: Story = {
  name: "幅による出し分け",
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-6">
      {[1200, 1359, 1360, 1400].map((w) => (
        <div key={w}>
          <div className="text-xs text-ink-faint mb-1.5">
            ヘッダー行の幅{w}px　{w >= 1360 ? "ラベルあり" : "アイコンのみ"}
          </div>
          {/* コンテナクエリは内容ボックスを見る。枠線やパディングをこの要素に付けると
              判定幅がそのぶん縮むので、装飾は外側と内側に分ける */}
          <div className="border border-line rounded-lg overflow-hidden inline-block max-w-full">
            <div className="@container/header" style={{ width: w, maxWidth: "100%" }}>
              <div className="flex items-center gap-3 min-w-0 p-2">
                <ModeSwitcher currentMode="medical" onModeChange={fn()} />
                <StatusBadge isRecording={false} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  ),
};
