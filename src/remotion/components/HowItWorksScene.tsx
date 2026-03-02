import React from "react";
import {
  CheckCircleIcon,
  CpuChipIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/solid";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const steps = [
  {
    num: "01",
    title: "診察を開始",
    desc: "ワンクリックで音声認識を開始。患者との自然な会話をリアルタイムでテキスト化",
    Icon: MicrophoneIcon,
  },
  {
    num: "02",
    title: "AIが自動分析",
    desc: "会話内容をGPT-4/5が解析し、医学的に重要な情報を抽出・構造化",
    Icon: CpuChipIcon,
  },
  {
    num: "03",
    title: "SOAPカルテ完成",
    desc: "構造化されたSOAP形式の電子カルテが自動生成。エクスポートも簡単",
    Icon: CheckCircleIcon,
  },
];

export const HowItWorksScene: React.FC<{ sceneDuration: number }> = ({
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
        background: "linear-gradient(180deg, #0f172a, #1a1a2e)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 60 }}>
        <p
          style={{
            fontSize: 24,
            color: "#10b981",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 600,
            margin: 0,
          }}
        >
          How It Works
        </p>
        <h2
          style={{
            fontSize: 56,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          3ステップで完了
        </h2>
      </div>

      {/* Steps */}
      <div
        style={{
          display: "flex",
          gap: 40,
          flex: 1,
          alignItems: "center",
        }}
      >
        {steps.map((step, i) => {
          const delay = 25 + i * 20;

          const stepScale = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, stiffness: 80 },
          });

          const stepOpacity = interpolate(
            frame,
            [delay, delay + 15],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          // Connector line between steps
          const lineProgress =
            i < steps.length - 1
              ? interpolate(frame, [delay + 15, delay + 35], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;

          return (
            <React.Fragment key={i}>
              <div
                style={{
                  flex: 1,
                  opacity: stepOpacity,
                  transform: `scale(${stepScale})`,
                  textAlign: "center",
                }}
              >
                {/* Icon Circle */}
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(20,184,166,0.05))",
                    border: "2px solid rgba(20,184,166,0.3)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "0 auto 24px",
                    position: "relative",
                  }}
                >
                  <step.Icon
                    style={{ width: 56, height: 56, color: "#14b8a6" }}
                  />
                  {/* Step Number */}
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#14b8a6",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "white",
                      }}
                    >
                      {step.num}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 30,
                    color: "white",
                    fontWeight: 600,
                    margin: "0 0 16px",
                  }}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: 20,
                    color: "#94a3b8",
                    margin: 0,
                    lineHeight: 1.6,
                    maxWidth: 340,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  {step.desc}
                </p>
              </div>

              {/* Connector Arrow */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    width: 60,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: -80,
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 3,
                      background: `linear-gradient(90deg, #14b8a6 ${lineProgress * 100}%, rgba(20,184,166,0.2) ${lineProgress * 100}%)`,
                      borderRadius: 2,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        right: -6,
                        top: -5,
                        width: 0,
                        height: 0,
                        borderLeft: "10px solid #14b8a6",
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                        opacity: lineProgress,
                      }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
