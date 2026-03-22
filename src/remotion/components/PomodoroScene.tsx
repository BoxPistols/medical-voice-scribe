import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const pomodoroFeatures = [
  {
    icon: "⏱",
    title: "カスタム作業タイマー",
    desc: "作業時間・休憩時間を自由に設定",
  },
  {
    icon: "📋",
    title: "タスク管理",
    desc: "期限付きタスクリスト",
  },
  {
    icon: "🔔",
    title: "多彩な通知",
    desc: "バイブレーション・サウンド・ビジュアル通知",
  },
  {
    icon: "🎵",
    title: "ブラウンノイズ",
    desc: "集中力を高めるBGM生成",
  },
];

export const PomodoroScene: React.FC<{ sceneDuration: number }> = ({
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [sceneDuration - 15, sceneDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Timer animation
  const timerProgress = interpolate(frame, [20, sceneDuration - 30], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const minutes = Math.floor((1 - timerProgress) * 25);
  const seconds = Math.floor(((1 - timerProgress) * 25 * 60) % 60);
  const timerText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const timerScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  // Circle progress
  const circumference = 2 * Math.PI * 120;
  const strokeOffset = circumference * (1 - timerProgress);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0f172a, #1a2332, #0f172a)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Warm glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
          top: "20%",
          left: "15%",
        }}
      />

      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 48 }}>
        <p
          style={{
            fontSize: 24,
            color: "#f59e0b",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Pomodoro Timer
        </p>
        <h2
          style={{
            fontSize: 52,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          集中と休憩のリズムで生産性を最大化
        </h2>
      </div>

      <div style={{ display: "flex", gap: 64, flex: 1, alignItems: "center" }}>
        {/* Timer ring */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${timerScale})`,
          }}
        >
          <div style={{ position: "relative", width: 300, height: 300 }}>
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              style={{ transform: "rotate(-90deg)" }}
            >
              {/* Background circle */}
              <circle
                cx="150"
                cy="150"
                r="120"
                fill="none"
                stroke="rgba(245,158,11,0.1)"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="150"
                cy="150"
                r="120"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>
            {/* Timer text */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "white",
                  margin: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {timerText}
              </p>
              <p
                style={{
                  fontSize: 18,
                  color: "#f59e0b",
                  margin: "4px 0 0",
                  fontWeight: 600,
                }}
              >
                作業中
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {pomodoroFeatures.map((feat, i) => {
            const delay = 30 + i * 15;
            const cardOpacity = interpolate(
              frame,
              [delay, delay + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const cardX = interpolate(frame, [delay, delay + 15], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  opacity: cardOpacity,
                  transform: `translateX(${cardX}px)`,
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.15)",
                  borderRadius: 16,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <span style={{ fontSize: 36 }}>{feat.icon}</span>
                <div>
                  <h3
                    style={{
                      fontSize: 22,
                      color: "#fbbf24",
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {feat.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 18,
                      color: "#94a3b8",
                      margin: "4px 0 0",
                    }}
                  >
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
