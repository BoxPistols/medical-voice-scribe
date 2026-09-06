"use client";

import React from "react";
import Link from "next/link";
import { Player } from "@remotion/player";
import { ProductVideo, TOTAL_DURATION } from "../../remotion/ProductVideo";

const RENDER_COMMAND =
  "npx remotion render src/remotion/index.ts ProductVideo public/video.mp4";

// 色はデザイントークンで書く。Remotionのシーン本体は動画側なので実値のままだが、
// このページはアプリの一部なので他の画面と揃える。
export const VideoPlayer: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="text-center mb-8 max-w-full">
        {/* 幅に応じて字を詰める。固定のfontSizeだと狭い画面で見出しが切れていた */}
        <h1 className="text-ink font-bold m-0 mb-2 text-[clamp(1.25rem,6vw,2rem)] leading-tight">
          製品紹介動画プレビュー
        </h1>
        <p className="text-ink-muted m-0 text-sm sm:text-base">
          Vital Flow — 医療・こころ・からだのAIスーパーアプリ
        </p>
      </div>

      {/* Player */}
      <div className="w-full max-w-[960px] rounded-2xl overflow-hidden border border-line shadow-2xl">
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

      {/* Info: 狭い画面では折り返す */}
      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-ink-faint text-xs sm:text-sm">
        <span>1920 x 1080 / 30fps</span>
        <span aria-hidden="true">|</span>
        <span>{Math.round(TOTAL_DURATION / 30)}秒</span>
        <span aria-hidden="true">|</span>
        <span>10シーン</span>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-5 sm:p-6 bg-surface-raised rounded-xl border border-line max-w-[640px] w-full">
        <h2 className="text-base text-ink m-0 mb-3 font-bold">
          MP4としてレンダリング
        </h2>
        {/* 長い1行なので、折り返さず横スクロールさせる。折り返すとコマンドが読みにくい */}
        <pre className="m-0 bg-surface rounded-lg p-4 overflow-x-auto">
          <code className="text-brand-fg text-xs sm:text-sm leading-relaxed whitespace-pre">
            {RENDER_COMMAND}
          </code>
        </pre>
      </div>

      <Link
        href="/"
        className="mt-6 text-brand-fg no-underline text-sm hover:text-brand"
      >
        ← アプリに戻る
      </Link>
    </div>
  );
};
