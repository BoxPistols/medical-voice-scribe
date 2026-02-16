interface SummaryCardProps {
  summary: string;
}

export default function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <div className="p-6 rounded-lg shadow-sm border-l-4 border-amber-600 dark:border-amber-500 border border-amber-200 dark:border-amber-600/40">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-5 h-5 text-amber-600 dark:text-amber-500"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wide">
          要約
        </h3>
      </div>
      <p className="text-sm text-theme-primary leading-relaxed">{summary}</p>
    </div>
  );
}
