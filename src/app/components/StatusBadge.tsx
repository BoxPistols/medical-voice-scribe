interface StatusBadgeProps {
  isRecording: boolean;
}

export default function StatusBadge({ isRecording }: StatusBadgeProps) {
  return (
    <div className={`status-badge ${isRecording ? "recording" : "idle"}`}>
      <div
        className={`status-indicator ${
          isRecording ? "recording" : "idle"
        } ${isRecording ? "recording-pulse" : ""}`}
      />
      {isRecording ? "録音中" : "待機中"}
    </div>
  );
}
