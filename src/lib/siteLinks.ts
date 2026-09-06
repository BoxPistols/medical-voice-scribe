// アプリとStorybookは別のVercelプロジェクトとしてデプロイしている。
// 互いのURLはここに集約する。ハードコードを散らすと片方だけ古くなる。
//
// デプロイ先を変えるときは環境変数で上書きできるようにしてある。
// Storybook側(.storybook/manager.ts)はビルド時にNEXT_PUBLIC_を読めないので、
// STORYBOOK_APP_URLを使う。

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://medical-voice-scribe.vercel.app";

export const STORYBOOK_URL =
  process.env.NEXT_PUBLIC_STORYBOOK_URL ??
  "https://medical-voice-scribe-docs.vercel.app";
