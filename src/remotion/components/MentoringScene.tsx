import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const chatMessages = [
  { role: "user" as const, text: "仕事のストレスが溜まって、やる気が出ません..." },
  { role: "ai" as const, text: "それはつらいですね。まず、今の気持ちを大切にしましょう。\n小さな一歩から始めてみませんか？" },
  { role: "user" as const, text: "小さな一歩って、例えば？" },
  { role: "ai" as const, text: "今日の「できたこと」を3つ書き出してみましょう。\nどんな小さなことでもOKです 😊" },
];

const features = [
  "ポジティブ心理学ベース",
  "音声入力対応",
  "読み上げ機能",
  "安全なローカル保存",
];

export const MentoringScene: React.FC<{ sceneDuration: number }> = ({
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
        background: "linear-gradient(135deg, #0f172a, #1e1338, #0f172a)",
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
            "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)",
          top: "5%",
          right: "5%",
        }}
      />

      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 48 }}>
        <p
          style={{
            fontSize: 24,
            color: "#ec4899",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Mentoring AI
        </p>
        <h2
          style={{
            fontSize: 52,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          AIメンタルコーチング
        </h2>
      </div>

      <div style={{ display: "flex", gap: 48, flex: 1 }}>
        {/* Chat demo */}
        <div
          style={{
            flex: 3,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 20,
            border: "1px solid rgba(236,72,153,0.15)",
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflow: "hidden",
          }}
        >
          {chatMessages.map((msg, i) => {
            const delay = 25 + i * 25;
            const msgOpacity = interpolate(
              frame,
              [delay, delay + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const msgY = interpolate(frame, [delay, delay + 15], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isAi = msg.role === "ai";

            return (
              <div
                key={i}
                style={{
                  opacity: msgOpacity,
                  transform: `translateY(${msgY}px)`,
                  display: "flex",
                  justifyContent: isAi ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    background: isAi
                      ? "rgba(236,72,153,0.12)"
                      : "rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    padding: "16px 24px",
                    border: `1px solid ${isAi ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {isAi && (
                    <p
                      style={{
                        fontSize: 14,
                        color: "#ec4899",
                        margin: "0 0 6px",
                        fontWeight: 600,
                      }}
                    >
                      🤖 メンタリングAI
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 22,
                      color: isAi ? "#f9a8d4" : "#cbd5e1",
                      margin: 0,
                      lineHeight: 1.6,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature list */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {features.map((feat, i) => {
            const delay = 60 + i * 12;
            const featScale = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 80 },
            });
            return (
              <div
                key={i}
                style={{
                  transform: `scale(${featScale})`,
                  background: "rgba(236,72,153,0.08)",
                  border: "1px solid rgba(236,72,153,0.15)",
                  borderRadius: 12,
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ec4899",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 20, color: "#e2e8f0" }}>{feat}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
