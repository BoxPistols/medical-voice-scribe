interface AnalysisProgressProps {
  isStreaming: boolean;
  streamingText: string;
  progress: number;
  modelName: string;
}

export default function AnalysisProgress({
  isStreaming,
  streamingText,
  progress,
  modelName,
}: AnalysisProgressProps) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          <div
            className="loading-spinner animate-spin"
            style={{
              width: "1.5rem",
              height: "1.5rem",
              borderWidth: "2px",
            }}
          />
        </div>
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {isStreaming ? "リアルタイム生成中..." : "解析準備中..."}
        </span>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--accent-primary)" }}
        >
          {progress}%
        </span>
        <span
          className="text-xs ml-auto"
          style={{ color: "var(--text-tertiary)" }}
        >
          {modelName}
        </span>
      </div>
      {/* Progress bar */}
      <div
        className="h-1 rounded-full mb-4 overflow-hidden"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--accent-primary)",
          }}
        />
      </div>
      {isStreaming && streamingText && (
        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-primary)",
          }}
        >
          <pre
            className="text-xs font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            {streamingText}
            <span
              className="inline-block w-2 h-4 animate-pulse ml-0.5"
              style={{
                backgroundColor: "var(--accent-primary)",
              }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}
