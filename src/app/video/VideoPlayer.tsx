"use client";

import React from "react";
import Link from "next/link";
import { Player } from "@remotion/player";
import { ProductVideo, TOTAL_DURATION } from "../../remotion/ProductVideo";

export const VideoPlayer: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "white",
            margin: "0 0 8px",
          }}
        >
          製品紹介動画プレビュー
        </h1>
        <p style={{ fontSize: 16, color: "#94a3b8", margin: 0 }}>
          Medical Scribe Flow — AI医療書記自動生成システム
        </p>
      </div>

      {/* Player Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Player
          component={ProductVideo}
          compositionWidth={1920}
          compositionHeight={1080}
          durationInFrames={TOTAL_DURATION}
          fps={30}
          style={{ width: "100%" }}
          controls
          autoPlay={false}
          loop
        />
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 24,
          color: "#64748b",
          fontSize: 14,
        }}
      >
        <span>1920 x 1080 | 30fps</span>
        <span>|</span>
        <span>{Math.round(TOTAL_DURATION / 30)}秒</span>
        <span>|</span>
        <span>6シーン</span>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          maxWidth: 640,
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: 16, color: "#e2e8f0", margin: "0 0 12px" }}>
          MP4としてレンダリング
        </h3>
        <code
          style={{
            display: "block",
            background: "rgba(0,0,0,0.3)",
            padding: 16,
            borderRadius: 8,
            color: "#14b8a6",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          npx remotion render src/remotion/index.ts ProductVideo public/video.mp4
        </code>
      </div>

      {/* Back Link */}
      <Link
        href="/"
        style={{
          marginTop: 24,
          color: "#14b8a6",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        ← アプリに戻る
      </Link>
    </div>
  );
};
