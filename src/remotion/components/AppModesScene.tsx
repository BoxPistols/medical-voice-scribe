import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// アプリのモードと一対一に対応させる。src/app/components/ModeSwitcher.tsxのMODESが原本。
// Remotionはブラウザのテーマと無関係に描画するので、CSS変数ではなく実値を書く。
// 色はアプリの役割色から取っている(brand teal / info sky / success emerald / warning amber)。
const modes = [
  { icon: "📋", label: "医療カルテ", desc: "音声認識×AI\nSOAP自動生成", color: "#14b8a6" },
  { icon: "🩺", label: "症状チェッカー", desc: "症状から\n受診の目安を整理", color: "#38bdf8" },
  { icon: "💚", label: "ヘルスコーチ", desc: "生活習慣の相談に\nAIが伴走", color: "#34d399" },
  { icon: "📔", label: "気分ジャーナル", desc: "気分と体調を記録\n傾向を振り返る", color: "#a78bfa" },
  { icon: "🌬", label: "呼吸・瞑想", desc: "ガイド付き呼吸で\nこころを整える", color: "#22d3ee" },
  { icon: "🤸", label: "体を動かす", desc: "姿勢チェックと\n休憩のストレッチ", color: "#fbbf24" },
  { icon: "🎙", label: "音声メモ", desc: "録音→AI整形\n要点とアクション抽出", color: "#60a5fa" },
  { icon: "💬", label: "メンタリング", desc: "ポジティブ心理学\nAIコーチング", color: "#f472b6" },
  { icon: "⏱", label: "時計", desc: "ポモドーロと\nタスク管理", color: "#f59e0b" },
];

const withTint = (color: string) => ({
  color,
  bg: `${color}1a`, // 10%
  border: `${color}40`, // 25%
});

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
        padding: 72,
        opacity: fadeOut,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 36 }}>
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
          {modes.length} Modes
        </p>
        <h2
          style={{
            fontSize: 48,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          ひとつのアプリで、医療とこころとからだを支援
        </h2>
      </div>

      {/* Mode cards: 3列3行 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          gap: 20,
          flex: 1,
        }}
      >
        {modes.map((mode, i) => {
          const tint = withTint(mode.color);
          // 9枚を1枚ずつ出すと尺に収まらないので、行ごとにまとめて出す
          const delay = 20 + Math.floor(i / 3) * 14;
          const cardScale = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 80 },
          });
          const cardOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={mode.label}
              style={{
                background: tint.bg,
                borderRadius: 18,
                padding: 20,
                opacity: cardOpacity,
                transform: `scale(${cardScale})`,
                border: `1px solid ${tint.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 44, lineHeight: 1 }}>{mode.icon}</div>
              <h3
                style={{
                  fontSize: 26,
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
                  fontSize: 18,
                  color: "#94a3b8",
                  margin: 0,
                  textAlign: "center",
                  lineHeight: 1.5,
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
