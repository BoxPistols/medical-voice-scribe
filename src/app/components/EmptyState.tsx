import { DocumentTextIcon } from "@heroicons/react/24/outline";

const steps = [
  { num: 1, color: "bg-orange-100 text-orange-600", title: "録音", desc: "「録音」ボタンを押して会話を開始" },
  { num: 2, color: "bg-gray-100 text-gray-600", title: "停止", desc: "会話が終わったら録音を停止" },
  { num: 3, color: "bg-teal-100 text-teal-600", title: "生成", desc: "「カルテ生成」でAIが分析開始" },
  { num: 4, color: "bg-blue-100 text-blue-600", title: "読み上げ", desc: "生成カルテを音声で読み上げ確認" },
  { num: 5, color: "bg-violet-100 text-violet-600", title: "保存・出力", desc: "JSON・CSVでカルテをエクスポート" },
  { num: 6, color: "bg-rose-100 text-rose-600", title: "カスタマイズ", desc: "テーマ・ショートカットを自由に設定" },
] as const;

export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="w-20 h-20 mb-6 rounded-full bg-theme-tertiary flex items-center justify-center">
        <DocumentTextIcon
          className="w-10 h-10 text-theme-secondary opacity-50"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-bold text-theme-primary mb-2">
        SOAPカルテ生成へようこそ
      </h3>
      <p className="text-sm text-theme-secondary mb-8 max-w-sm mx-auto leading-relaxed">
        AIが医師と患者の会話を分析し、
        <br className="hidden sm:block" />
        標準的な医療記録形式（SOAP）でカルテを作成します。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg text-left">
        {steps.map((step) => (
          <div
            key={step.num}
            className="p-4 rounded-lg border border-theme-light bg-theme-card hover:shadow-md transition-shadow"
          >
            <div
              className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center text-sm font-bold mb-3`}
            >
              {step.num}
            </div>
            <div className="font-bold text-sm text-theme-primary mb-1">
              {step.title}
            </div>
            <div className="text-xs text-theme-secondary">{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
