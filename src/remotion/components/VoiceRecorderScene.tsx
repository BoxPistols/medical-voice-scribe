import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const steps = [
  {
    num: "1",
    title: "音声で録音",
    desc: "会議やアイデアを\nワンタップで録音開始",
    color: "#3b82f6",
  },
  {
    num: "2",
    title: "AIが自動整形",
    desc: "文字起こし＋\nSlack形式にフォーマット",
    color: "#8b5cf6",
  },
  {
    num: "3",
    title: "要約 & アクション",
    desc: "要点抽出・\nアクションアイテム自動生成",
    color: "#06b6d4",
  },
];

const categories = [
  { label: "会議", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  { label: "アイデア", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  { label: "メモ", color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
  { label: "その他", color: "#64748b", bg: "rgba(100,116,139,0.15)" },
];

export const VoiceRecorderScene: React.FC<{ sceneDuration: number }> = ({
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

  // Microphone pulse animation
  const pulse = Math.sin(frame * 0.15) * 0.15 + 1;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a, #0f1a2e, #0f172a)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
          bottom: "10%",
          right: "10%",
        }}
      />

      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 48 }}>
        <p
          style={{
            fontSize: 24,
            color: "#3b82f6",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Voice Recorder
        </p>
        <h2
          style={{
            fontSize: 52,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          音声メモをAIが整理・要約
        </h2>
      </div>

      <div style={{ display: "flex", gap: 48, flex: 1 }}>
        {/* Left: Mic + categories */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Microphone icon */}
          <div
            style={{
              transform: `scale(${pulse})`,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: `0 0 ${40 + Math.sin(frame * 0.15) * 20}px rgba(59,130,246,0.3)`,
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>

          {/* Category badges */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {categories.map((cat, i) => {
              const delay = 40 + i * 10;
              const badgeScale = spring({
                frame: frame - delay,
                fps,
                config: { damping: 12, stiffness: 100 },
              });
              return (
                <div
                  key={i}
                  style={{
                    transform: `scale(${badgeScale})`,
                    background: cat.bg,
                    border: `1px solid ${cat.color}40`,
                    borderRadius: 100,
                    padding: "8px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: cat.color,
                    }}
                  />
                  <span style={{ fontSize: 18, color: cat.color, fontWeight: 600 }}>
                    {cat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: 3-step flow */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 28,
          }}
        >
          {steps.map((step, i) => {
            const delay = 25 + i * 20;
            const stepOpacity = interpolate(
              frame,
              [delay, delay + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const stepX = interpolate(frame, [delay, delay + 15], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div key={i}>
                <div
                  style={{
                    opacity: stepOpacity,
                    transform: `translateX(${stepX}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 16,
                    padding: "24px 28px",
                    border: `1px solid ${step.color}30`,
                  }}
                >
                  {/* Step number */}
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: step.color,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexShrink: 0,
                      boxShadow: `0 8px 24px ${step.color}40`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: "white",
                      }}
                    >
                      {step.num}
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: 24,
                        color: step.color,
                        fontWeight: 600,
                        margin: 0,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 18,
                        color: "#94a3b8",
                        margin: "6px 0 0",
                        lineHeight: 1.5,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>

                {/* Arrow connector */}
                {i < steps.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "4px 0",
                      opacity: stepOpacity,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14M5 12l7 7 7-7"
                        stroke="#475569"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
