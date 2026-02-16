import { ReactNode } from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";

export type SOAPType = "subjective" | "objective" | "assessment" | "plan";

interface SOAPSectionWrapperProps {
  type: SOAPType;
  badge: string;
  label: string;
  onCopy: () => void;
  children: ReactNode;
}

const soapColorVar: Record<SOAPType, string> = {
  subjective: "var(--soap-s)",
  objective: "var(--soap-o)",
  assessment: "var(--soap-a)",
  plan: "var(--soap-p)",
};

export default function SOAPSectionWrapper({
  type,
  badge,
  label,
  onCopy,
  children,
}: SOAPSectionWrapperProps) {
  return (
    <div className={`soap-section ${type}`}>
      <div className="soap-label">
        <div className="flex items-center gap-2">
          <div
            className="soap-badge"
            style={{ background: soapColorVar[type] }}
          >
            {badge}
          </div>
          {label}
        </div>
        <button
          onClick={onCopy}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label={`${badge}セクションをコピー`}
          data-tooltip="コピー"
        >
          <ClipboardDocumentIcon className="w-4 h-4 opacity-60 hover:opacity-100" />
        </button>
      </div>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}
