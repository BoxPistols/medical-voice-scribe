interface PatientInfoCardProps {
  chiefComplaint?: string;
  duration?: string;
}

export default function PatientInfoCard({
  chiefComplaint,
  duration,
}: PatientInfoCardProps) {
  if (!chiefComplaint && !duration) return null;

  return (
    <div className="p-6 rounded-lg shadow-sm border-l-4 border-blue-600 dark:border-blue-500 border border-blue-200 dark:border-blue-600/40">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
        <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wide">
          患者情報
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {chiefComplaint && (
          <>
            <div className="text-theme-secondary font-semibold">主訴:</div>
            <div className="text-theme-primary">{chiefComplaint}</div>
          </>
        )}
        {duration && (
          <>
            <div className="text-theme-secondary font-semibold">期間:</div>
            <div className="text-theme-primary">{duration}</div>
          </>
        )}
      </div>
    </div>
  );
}
