import React from "react";
import { CpuChipIcon } from "@heroicons/react/24/solid";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const SolutionScene: React.FC<{ sceneDuration: number }> = ({
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const circleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 60 },
  });

  const arrowProgress = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const resultOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const resultScale = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const fadeOut = interpolate(
    frame,
    [sceneDuration - 15, sceneDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Pulse animation for the center AI circle
  const pulse = Math.sin(frame * 0.1) * 0.05 + 1;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0f172a, #0c1222)",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 40 }}>
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
          The Solution
        </p>
        <h2
          style={{
            fontSize: 56,
            color: "white",
            fontWeight: 700,
            margin: "12px 0 0",
          }}
        >
          AIが診察をアシスト
        </h2>
      </div>

      {/* Flow Diagram */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          gap: 40,
        }}
      >
        {/* Input: Voice */}
        <div
          style={{
            opacity: headerOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "rgba(245,158,11,0.1)",
              border: "2px solid rgba(245,158,11,0.3)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${circleScale})`,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <p
              style={{
                color: "#f59e0b",
                fontSize: 20,
                margin: "8px 0 0",
                fontWeight: 600,
              }}
            >
              音声入力
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            width: 80,
            height: 4,
            background: `linear-gradient(90deg, #f59e0b ${arrowProgress * 100}%, transparent ${arrowProgress * 100}%)`,
            borderRadius: 2,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -8,
              top: -6,
              width: 0,
              height: 0,
              borderLeft: "12px solid #f59e0b",
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              opacity: arrowProgress,
            }}
          />
        </div>

        {/* Center: AI Processing */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(20,184,166,0.2), rgba(20,184,166,0.05))",
              border: "2px solid rgba(20,184,166,0.4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${circleScale * pulse})`,
              boxShadow: "0 0 60px rgba(20,184,166,0.15)",
            }}
          >
            <CpuChipIcon style={{ width: 52, height: 52, color: "#14b8a6" }} />
            <p
              style={{
                color: "#14b8a6",
                fontSize: 22,
                margin: "8px 0 0",
                fontWeight: 700,
              }}
            >
              AI分析
            </p>
            <p
              style={{
                color: "#5eead4",
                fontSize: 16,
                margin: "4px 0 0",
              }}
            >
              GPT-4 / GPT-5
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            width: 80,
            height: 4,
            background: `linear-gradient(90deg, #14b8a6 ${arrowProgress * 100}%, transparent ${arrowProgress * 100}%)`,
            borderRadius: 2,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -8,
              top: -6,
              width: 0,
              height: 0,
              borderLeft: "12px solid #14b8a6",
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              opacity: arrowProgress,
            }}
          />
        </div>

        {/* Output: SOAP Note */}
        <div
          style={{
            opacity: resultOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "rgba(16,185,129,0.1)",
              border: "2px solid rgba(16,185,129,0.3)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${resultScale})`,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <p
              style={{
                color: "#10b981",
                fontSize: 20,
                margin: "8px 0 0",
                fontWeight: 600,
              }}
            >
              SOAPカルテ
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
