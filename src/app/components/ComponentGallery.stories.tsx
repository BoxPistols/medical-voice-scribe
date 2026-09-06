import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ModeSwitcher, { MODES } from "./ModeSwitcher";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import ErrorAlert from "./ErrorAlert";
import SummaryCard from "./SummaryCard";
import PatientInfoCard from "./PatientInfoCard";
import AnalysisProgress from "./AnalysisProgress";
import SOAPSectionWrapper, { type SOAPType } from "./SOAPSectionWrapper";

// 部品を1枚に並べて、系として揃っているかを見る。
// 個別のストーリーは1つの部品を深く見るためのもので、こちらは横並びの比較に使う。
// ツールバーのテーマを切り替えると、明色と暗色の両方を同じ並びで確認できる。

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold text-ink mb-1">{title}</h3>
      {note && <p className="text-xs text-ink-faint mb-3 leading-relaxed">{note}</p>}
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

const SOAP_SECTIONS: { type: SOAPType; badge: string; label: string }[] = [
  { type: "subjective", badge: "S", label: "Subjective／主観的情報" },
  { type: "objective", badge: "O", label: "Objective／客観的情報" },
  { type: "assessment", badge: "A", label: "Assessment／評価" },
  { type: "plan", badge: "P", label: "Plan／計画" },
];

function ComponentGallery() {
  return (
    <div className="p-6 bg-surface text-ink min-h-screen">
      <h2 className="text-lg font-bold mb-1">コンポーネント一覧</h2>
      <p className="text-xs text-ink-faint mb-8 leading-relaxed">
        色はデザイントークンだけで書く。規約はdocs/design-tokens.md、値の一覧は
        「デザイン / デザイントークン」にある。
      </p>

      <Row title="状態バッジ" note="録音中と待機中。幅が足りなくても折り返さない">
        <StatusBadge isRecording={false} />
        <StatusBadge isRecording={true} />
      </Row>

      <Row
        title="モード切替"
        note={`${MODES.length}モード。ラベルの出し分けはヘッダー行の幅で決まる`}
      >
        <ModeSwitcher currentMode="medical" onModeChange={fn()} />
      </Row>

      <Row title="エラー" note="閉じるボタンつき。dangerの薄い面と枠線">
        <div className="w-full max-w-xl">
          <ErrorAlert message="音声の解析中にエラーが発生しました。もう一度お試しください。" onClose={fn()} />
        </div>
      </Row>

      <Row title="患者情報と要約" note="左辺の色で種類を示す。infoとwarning">
        <div className="w-full max-w-md bg-surface-raised rounded-lg overflow-hidden">
          <PatientInfoCard chiefComplaint="右足親指の激痛" duration="昨夜から" />
        </div>
        <div className="w-full max-w-md bg-surface-raised rounded-lg overflow-hidden">
          <SummaryCard summary="45歳男性、昨夜からの急な右足親指の痛みと腫れ。痛風が疑われる。" />
        </div>
      </Row>

      <Row title="SOAPの4区分" note="役割色とは別の、記録の構造を表す4色">
        {SOAP_SECTIONS.map((s) => (
          <div key={s.type} className="w-full max-w-sm">
            <SOAPSectionWrapper type={s.type} badge={s.badge} label={s.label} onCopy={fn()}>
              <p className="text-sm text-ink-muted">ここに内容が入る</p>
            </SOAPSectionWrapper>
          </div>
        ))}
      </Row>

      <Row title="生成中" note="開始直後と、応答が流れている途中">
        <div className="w-full max-w-md bg-surface-raised rounded-lg">
          <AnalysisProgress isStreaming={false} streamingText="" progress={0} modelName="GPT-5.6 Luna" />
        </div>
        <div className="w-full max-w-md bg-surface-raised rounded-lg">
          <AnalysisProgress
            isStreaming={true}
            streamingText="S: 45歳男性。昨夜から右足親指に激しい痛みと腫れが出現。"
            progress={62}
            modelName="GPT-5.6 Luna"
          />
        </div>
      </Row>

      <Row title="空の状態" note="カルテがまだ無いとき">
        <div className="w-full max-w-2xl bg-surface-raised rounded-lg">
          <EmptyState />
        </div>
      </Row>
    </div>
  );
}

const meta = {
  title: "デザイン/コンポーネント一覧",
  component: ComponentGallery,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ComponentGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = { name: "一覧" };
