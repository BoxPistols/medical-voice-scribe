"use client";

import {
  ClockIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  FaceSmileIcon,
  CloudIcon,
  ShieldExclamationIcon,
  HeartIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

export type AppMode =
  | "medical"
  | "symptom"
  | "coach"
  | "mood"
  | "breathe"
  | "move"
  | "voice"
  | "clock";

interface ModeSwitcherProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string; shortLabel: string; icon: typeof ClockIcon; description: string }[] = [
  {
    id: "medical",
    label: "医療カルテ",
    shortLabel: "医療",
    icon: DocumentTextIcon,
    description: "AI問診・SOAP自動生成",
  },
  {
    id: "symptom",
    label: "症状チェッカー",
    shortLabel: "症状",
    icon: ShieldExclamationIcon,
    description: "AI症状トリアージ・受診の目安（参考情報）",
  },
  {
    id: "coach",
    label: "ヘルスコーチ",
    shortLabel: "コーチ",
    icon: HeartIcon,
    description: "からだ・こころ・生活習慣を横断するAIコーチ",
  },
  {
    id: "mood",
    label: "気分ジャーナル",
    shortLabel: "気分",
    icon: FaceSmileIcon,
    description: "気分・活力の記録とAIふりかえり",
  },
  {
    id: "breathe",
    label: "呼吸・瞑想",
    shortLabel: "呼吸",
    icon: CloudIcon,
    description: "ガイド付き呼吸・瞑想（デスクワーク中も可）",
  },
  {
    id: "move",
    label: "体を動かす",
    shortLabel: "運動",
    icon: BoltIcon,
    description: "カメラ姿勢トラッキングでストレッチ・運動",
  },
  {
    id: "voice",
    label: "音声メモ",
    shortLabel: "音声",
    icon: MicrophoneIcon,
    description: "録音・整理・要約",
  },
  {
    id: "clock",
    label: "時計",
    shortLabel: "時計",
    icon: ClockIcon,
    description: "フルスクリーン時計",
  },
];

export default function ModeSwitcher({
  currentMode,
  onModeChange,
}: ModeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 bg-theme-surface rounded-xl p-0.5 border border-theme-light flex-shrink min-w-0 max-w-full overflow-x-auto scrollbar-none">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`
              flex items-center justify-center gap-1 rounded-lg font-medium transition-all duration-200 flex-shrink-0
              w-9 h-9 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 text-xs whitespace-nowrap
              ${
                isActive
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-theme-tertiary hover:text-theme-secondary hover:bg-theme-card"
              }
            `}
            title={`${mode.label} — ${mode.description}`}
            aria-label={`${mode.label}モードに切替`}
            aria-pressed={isActive}
          >
            <Icon className="w-5 h-5 lg:w-3.5 lg:h-3.5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="hidden lg:inline">{mode.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
