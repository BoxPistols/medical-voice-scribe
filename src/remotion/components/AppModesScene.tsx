import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const modes = [
  {
    icon: "📋",
    label: "医療カルテ",
    desc: "音声認識×AI\nSOAP自動生成",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.1)",
    border: "rgba(20,184,166,0.25)",
  },
  {
    icon: "⏱",
    label: "ポモドーロ",
    desc: "タスク管理×タイマー\n集中力を最大化",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
  },
  {
    icon: "🎙",
    label: "音声メモ",
    desc: "録音→AI整形\nSlack連携フォーマット",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.1)",
    border: "rgba(37,99,235,0.25)",
  },
  {
    icon: "💬",
    label: "メンタリング",
    desc: "ポジティブ心理学\nAIコーチング",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.1)",
    border: "rgba(236,72,153,0.25)",
  },
];

export const AppModesScene: React.FC<{ sceneDuration: number }> = ({
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

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0f172a, #1a1f3a, #0f172a)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 56 }}>
        <p
          style={{
            fontSize: 24,
            color: "#14b8a6",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 600,
            margin: 0,
          }}
        >
          4 Modes
        </p>
        <h2
          style={{
            fontSize: 52,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          ひとつのアプリで、4つの働き方を支援
        </h2>
      </div>

      {/* Mode cards */}
      <div
        style={{
          display: "flex",
          gap: 28,
          flex: 1,
          alignItems: "stretch",
        }}
      >
        {modes.map((mode, i) => {
          const delay = 20 + i * 15;
          const cardScale = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 80 },
          });
          const cardOpacity = interpolate(
            frame,
            [delay, delay + 15],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: mode.bg,
                borderRadius: 20,
                padding: 36,
                opacity: cardOpacity,
                transform: `scale(${cardScale})`,
                border: `1px solid ${mode.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  lineHeight: 1,
                }}
              >
                {mode.icon}
              </div>
              <h3
                style={{
                  fontSize: 28,
                  color: mode.color,
                  fontWeight: 700,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {mode.label}
              </h3>
              <p
                style={{
                  fontSize: 20,
                  color: "#94a3b8",
                  margin: 0,
                  textAlign: "center",
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}
              >
                {mode.desc}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
