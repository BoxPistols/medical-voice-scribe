import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const features = [
  {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.2)",
    label: "S",
    title: "Subjective",
    desc: "患者の主訴・症状・既往歴を自動分類",
    items: ["主訴", "現病歴", "重症度", "服薬情報"],
  },
  {
    color: "#2563eb",
    bg: "rgba(37,99,235,0.1)",
    border: "rgba(37,99,235,0.2)",
    label: "O",
    title: "Objective",
    desc: "客観的所見をリアルタイムで構造化",
    items: ["バイタル", "身体所見", "検査結果", "画像所見"],
  },
  {
    color: "#ec4899",
    bg: "rgba(236,72,153,0.1)",
    border: "rgba(236,72,153,0.2)",
    label: "A",
    title: "Assessment",
    desc: "AI支援による診断と鑑別診断",
    items: ["診断名", "ICD-10", "鑑別診断", "根拠"],
  },
  {
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.2)",
    label: "P",
    title: "Plan",
    desc: "治療計画を体系的に生成",
    items: ["治療方針", "処方", "検査指示", "フォローアップ"],
  },
];

export const FeaturesScene: React.FC<{ sceneDuration: number }> = ({
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
        background: "linear-gradient(180deg, #0f172a, #0c1222)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
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
          SOAP Format
        </p>
        <h2
          style={{
            fontSize: 56,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          構造化された電子カルテを自動生成
        </h2>
      </div>

      {/* Feature Cards */}
      <div
        style={{
          display: "flex",
          gap: 24,
          flex: 1,
          alignItems: "stretch",
        }}
      >
        {features.map((feature, i) => {
          const delay = 20 + i * 12;
          const cardY = interpolate(frame, [delay, delay + 20], [60, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const cardOpacity = interpolate(
            frame,
            [delay, delay + 20],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          const labelScale = spring({
            frame: frame - delay - 5,
            fps,
            config: { damping: 10, stiffness: 100 },
          });

          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: feature.bg,
                borderRadius: 16,
                padding: 32,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                border: `1px solid ${feature.border}`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Label Badge */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: feature.color,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                  transform: `scale(${labelScale})`,
                  boxShadow: `0 8px 24px ${feature.color}40`,
                }}
              >
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "white",
                  }}
                >
                  {feature.label}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: 26,
                  color: feature.color,
                  fontWeight: 600,
                  margin: "0 0 10px",
                }}
              >
                {feature.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontSize: 18,
                  color: "#94a3b8",
                  margin: "0 0 24px",
                  lineHeight: 1.5,
                }}
              >
                {feature.desc}
              </p>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feature.items.map((item, j) => {
                  const itemDelay = delay + 15 + j * 5;
                  const itemOpacity = interpolate(
                    frame,
                    [itemDelay, itemDelay + 10],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }
                  );
                  return (
                    <div
                      key={j}
                      style={{
                        opacity: itemOpacity,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: feature.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 20,
                          color: "#cbd5e1",
                        }}
                      >
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
