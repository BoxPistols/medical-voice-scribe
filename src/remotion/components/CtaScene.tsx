import React from "react";
import {
  ArrowUpTrayIcon,
  ClipboardDocumentIcon,
  CommandLineIcon,
  DevicePhoneMobileIcon,
  MicrophoneIcon,
  MoonIcon,
} from "@heroicons/react/24/solid";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const highlights = [
  { label: "リアルタイム音声認識", Icon: MicrophoneIcon },
  { label: "SOAP形式カルテ自動生成", Icon: ClipboardDocumentIcon },
  { label: "JSON / CSV エクスポート", Icon: ArrowUpTrayIcon },
  { label: "ダークモード対応", Icon: MoonIcon },
  { label: "キーボードショートカット", Icon: CommandLineIcon },
  { label: "PWA対応", Icon: DevicePhoneMobileIcon },
];

export const CtaScene: React.FC<{ sceneDuration: number }> = ({
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [10, 30], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgesOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaScale = spring({
    frame: frame - 60,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const ctaGlow = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0f172a, #0c1222, #0f172a)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "linear-gradient(135deg, #14b8a6, #0d9488)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 16px 48px rgba(20,184,166,0.3)",
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "white",
              margin: 0,
            }}
          >
            Medical Scribe
            <span style={{ color: "#14b8a6" }}> Flow</span>
          </h2>
          <p
            style={{
              fontSize: 26,
              color: "#94a3b8",
              margin: "12px 0 0",
            }}
          >
            医療現場のドキュメント作成を、もっとスマートに。
          </p>
        </div>

        {/* Feature Badges */}
        <div
          style={{
            opacity: badgesOpacity,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            maxWidth: 800,
          }}
        >
          {highlights.map((h, i) => {
            const badgeDelay = 35 + i * 5;
            const badgeOpacity = interpolate(
              frame,
              [badgeDelay, badgeDelay + 10],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );
            return (
              <div
                key={i}
                style={{
                  opacity: badgeOpacity,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 100,
                  padding: "8px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <h.Icon style={{ width: 20, height: 20, color: "#e2e8f0" }} />
                <span
                  style={{
                    fontSize: 18,
                    color: "#e2e8f0",
                  }}
                >
                  {h.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA Text */}
        <div
          style={{
            transform: `scale(${ctaScale})`,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#14b8a6",
              margin: 0,
              textShadow: `0 0 ${ctaGlow * 20}px rgba(20,184,166,0.4)`,
            }}
          >
            Medical Scribe Flow をお試しください
          </p>
        </div>

        {/* Footer */}
        <p
          style={{
            fontSize: 18,
            color: "#475569",
            margin: "16px 0 0",
            opacity: interpolate(frame, [70, 85], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Open Source | Next.js + React + OpenAI
        </p>
      </div>
    </AbsoluteFill>
  );
};
