// プロバイダーレジストリ。新しいプロバイダーの追加を1エントリに集約する。
//
// GeminiはOpenAI互換エンドポイントを提供しているので、ベースURLとキーを差し替えるだけで
// 既存のopenai.chat.completions.createがそのまま使える。
// 9箇所の呼び出しとSSEのストリーミングを書き換えずに済むので、この形にしている。
// 参照: https://ai.google.dev/gemini-api/docs/openai

import OpenAI from "openai";

export type ProviderKey = "openai" | "gemini";

interface ProviderConfig {
  label: string;
  /** APIキーを読む環境変数名 */
  envKey: string;
  /** OpenAI互換エンドポイントのベースURL。OpenAI本体は既定なので持たない */
  baseURL?: string;
  /** このプロバイダーが提供するモデルID(公式ドキュメントで確認したものだけ) */
  models: string[];
  /** 一時エラー(429/5xx)の再試行回数。SDKが指数バックオフで待つ */
  maxRetries?: number;
}

export const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-5.6-luna"],
  },
  gemini: {
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    // 3.8-flashが現行の最新安定版。3.5-flashは公式ドキュメントでlegacy扱いのうえ
    // 価格も3.8の2倍以上なので入れない。
    // モデルIDは集計サイトではなくai.google.dev/gemini-api/docs/modelsで確認すること。
    // 別プロジェクトで集計サイト由来のIDが本番で404になった例がある。
    // 3.6と3.8の両方を置く理由は、無料枠がモデルごとに別勘定だから。
    // 実測(2026-09-06): 3.8が429(quota exceeded, limit 20)で落ちている最中に、
    // 3.6は同じキーで200を返した。片方が詰まってももう片方で続けられる。
    // 価格は同額($0.75/$3.75)なので、3.6を選んでも損はしない。
    // 品質は3.8が上なので、通常は3.8、混んだら3.6という使い分けになる。
    models: ["gemini-3.6-flash", "gemini-3.8-flash"],
    // 無料枠は1分あたり20回で、モデルごとに別枠(実測のエラー本文で確認)。
    // 再試行を増やすと1リクエストで枠を何度も消費して429を招くので、控えめにする。
    // 503(high demand)は一時的とGoogleが案内しているので、数回だけ待って再試行する。
    maxRetries: 3,
  },
};

export const PROVIDER_ORDER: ProviderKey[] = ["openai", "gemini"];

/** モデルIDからプロバイダーを引く。未知のモデルはnull */
export function providerOf(modelId: string): ProviderKey | null {
  for (const key of PROVIDER_ORDER) {
    if (PROVIDERS[key].models.includes(modelId)) return key;
  }
  return null;
}

/** そのプロバイダーのキーが設定されているか */
export function isProviderConfigured(provider: ProviderKey): boolean {
  return !!process.env[PROVIDERS[provider].envKey];
}

/** キーが設定済みのプロバイダーのモデルだけを返す。UIの選択肢に使う */
export function availableModelIds(): string[] {
  return PROVIDER_ORDER.filter(isProviderConfigured).flatMap((p) => PROVIDERS[p].models);
}

/** キー未設定時に投げる。ルート側で503に変換する */
export class ProviderConfigError extends Error {
  constructor(
    readonly provider: ProviderKey,
    message: string,
  ) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

const clients = new Map<ProviderKey, OpenAI>();

/**
 * プロバイダーに対応するOpenAI互換クライアントを返す。
 * 生成は呼び出し時に行う。モジュール読み込み時に投げると、キー未設定の環境で
 * ルートごと読み込み失敗になりHTMLの500が返る(実際に起きた)。
 */
export function clientFor(provider: ProviderKey): OpenAI {
  const cached = clients.get(provider);
  if (cached) return cached;

  const config = PROVIDERS[provider];
  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new ProviderConfigError(
      provider,
      `サーバーに${config.label}のAPIキーが設定されていません。.env.localに${config.envKey}を設定してください`,
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseURL,
    maxRetries: config.maxRetries ?? 2,
  });
  clients.set(provider, client);
  return client;
}

/** モデルIDから、それを呼べるクライアントを返す */
export function clientForModel(modelId: string): OpenAI {
  const provider = providerOf(modelId);
  if (!provider) {
    throw new ProviderConfigError("openai", `未知のモデルIDです: ${modelId}`);
  }
  return clientFor(provider);
}

/** テスト用。環境変数を差し替えた後にキャッシュを捨てる */
export function resetClientCache(): void {
  clients.clear();
}
