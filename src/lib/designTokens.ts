// デザイントークンの定義。ここが唯一の出典。
//
// 実際の色は src/app/globals.css の CSS 変数が持ち、このファイルは
// 「どの役割にどの段があるか」という構造だけを持つ。両者がずれていないことは
// src/app/__tests__/design-tokens.test.ts が双方向に検査する。
//
// 参照する側:
//   - Storybook の「デザイントークン」カタログ (トークンを一覧表示する)
//   - コントラストの検査 (src/app/__tests__/color-contrast.test.ts)
//   - 生パレット混入の検査 (src/app/__tests__/no-raw-palette.test.ts)
//   - 書き方の規約 (docs/design-tokens.md)

/** 意味を持つ色の役割。用途が重ならないように5つに絞っている */
export const ROLES = ["brand", "danger", "warning", "info", "success"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_MEANING: Record<Role, string> = {
  brand: "主操作・選択状態・フォーカス",
  danger: "削除・エラー・録音の停止",
  warning: "注意・未処理",
  info: "補助情報・AIの提案",
  success: "完了・処理済み",
};

/** 各役割が持つ段。接尾辞なしが塗り */
export const STEPS = ["", "-strong", "-fg", "-soft", "-soft-strong", "-line"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_MEANING: Record<Step, string> = {
  "": "塗り。ボタンの背景など",
  "-strong": "塗りのhover",
  "-fg": "面の上に置く文字とアイコン",
  "-soft": "薄い面。札やバナーの背景",
  "-soft-strong": "薄い面のhover",
  "-line": "枠線",
};

/** 色みを持たない土台。面と文字と罫線 */
export const NEUTRALS = [
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "ink-faint",
  "line",
] as const;
export type Neutral = (typeof NEUTRALS)[number];

export const NEUTRAL_MEANING: Record<Neutral, string> = {
  surface: "画面の地",
  "surface-raised": "地より一段持ち上げた面",
  ink: "本文",
  "ink-muted": "補足",
  "ink-faint": "時刻やヒントなど、読めれば足りる文字",
  line: "罫線",
};

/** SOAPカルテの4区分。医療記録の構造そのものなので、役割色とは別に持つ */
export const SOAP_KEYS = ["soap-s", "soap-o", "soap-a", "soap-p"] as const;
export type SoapKey = (typeof SOAP_KEYS)[number];

export const SOAP_MEANING: Record<SoapKey, string> = {
  "soap-s": "Subjective 主観的情報",
  "soap-o": "Objective 客観的情報",
  "soap-a": "Assessment 評価",
  "soap-p": "Plan 計画",
};

/** 使ってよいTailwindの色クラス名(接尾辞まで含む完全な一覧) */
export function allColorTokens(): string[] {
  const roleTokens = ROLES.flatMap((r) => STEPS.map((s) => `${r}${s}`));
  const soapTokens = SOAP_KEYS.flatMap((k) => [k, `${k}-soft`]);
  return [...roleTokens, ...NEUTRALS, ...soapTokens];
}

/**
 * 使わないTailwindのパレット名。
 * 近い役割のトークンに寄せる。ここに無い色も、数字付きの生パレットは使わない。
 */
export const FORBIDDEN_PALETTES: Record<string, string> = {
  purple: "info",
  violet: "info",
  indigo: "info",
  blue: "info",
  sky: "info",
  cyan: "info",
  teal: "brand",
  emerald: "success",
  green: "success",
  lime: "success",
  amber: "warning",
  yellow: "warning",
  orange: "warning",
  red: "danger",
  rose: "danger",
  pink: "danger",
  fuchsia: "danger",
  gray: "ink / surface / line",
  zinc: "ink / surface / line",
  slate: "ink / surface / line",
  neutral: "ink / surface / line",
  stone: "ink / surface / line",
};

/** フォントサイズの下限。これ未満は使わない */
export const MIN_FONT_SIZE_PX = 12;

/** 文字と面のコントラスト比の下限 (WCAG AA、通常サイズ) */
export const MIN_CONTRAST_RATIO = 4.5;
