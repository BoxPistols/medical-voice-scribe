"use client";

import {
  ClockIcon,
  MicrophoneIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export type AppMode = "medical" | "clock" | "voice";

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
    id: "clock",
    label: "時計",
    shortLabel: "時計",
    icon: ClockIcon,
    description: "フルスクリーン時計",
  },
  {
    id: "voice",
    label: "音声メモ",
    shortLabel: "音声",
    icon: MicrophoneIcon,
    description: "録音・整理・要約",
  },
];

export default function ModeSwitcher({
  currentMode,
  onModeChange,
}: ModeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1 bg-theme-surface rounded-xl p-0.5 sm:p-1 border border-theme-border">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`
              flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200
              w-9 h-9 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 text-xs
              ${
                isActive
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-theme-tertiary hover:text-theme-secondary hover:bg-theme-card"
              }
            `}
            title={mode.description}
            aria-label={`${mode.label}モードに切替`}
            aria-pressed={isActive}
          >
            <Icon className="w-5 h-5 sm:w-3.5 sm:h-3.5" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
