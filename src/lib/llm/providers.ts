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
    // 無料枠は「1日20回」で、しかもモデルごとに別勘定。
    // (429の詳細がGenerateRequestsPerDayPerProjectPerModel-FreeTier、value 20を返す)
    // したがって2モデル登録すると、無料で使える回数はそのぶん増える。
    //
    // 3.8は2026-09-03にGAとして発表された最新のFlash(日本語ブログとlatest-modelページに掲載)。
    // 3.6も同額($0.75/$3.75)で、3.8の枠を使い切った日でも別枠として残るため併記する。
    //
    // モデルIDは公式ドキュメントで確認する。ただしdocs/modelsの日本語版は翻訳が遅れており、
    // 3.7と3.8が未掲載になっている。docs/latest-modelの日本語版には載っている。
    models: ["gemini-3.8-flash", "gemini-3.6-flash"],
    // 503(high demand)は一時的だとGoogleが案内しているので、数回だけ待って再試行する。
    // 429(枠の使い切り)はその日のうちには回復しないので、再試行しても意味は無い。
    // SDKは両方を再試行するため、回数は控えめにしておく。
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
  const raw = process.env[config.envKey];
  if (!raw) {
    throw new ProviderConfigError(
      provider,
      `サーバーに${config.label}のAPIキーが設定されていません。.env.localに${config.envKey}を設定してください`,
    );
  }

  // 前後の空白と改行を落とす。環境変数の画面に貼るときに混ざりやすい
  const apiKey = raw.trim();

  // APIキーはAuthorizationヘッダーに載るので、ASCII以外が混ざると
  // fetchが "Cannot convert argument to a ByteString" で落ちる。
  // そのままだと原因の分からない500になるので、ここで理由を出して止める。
  const bad = [...apiKey].find((ch) => ch.charCodeAt(0) > 0x7e || ch.charCodeAt(0) < 0x21);
  if (bad !== undefined) {
    throw new ProviderConfigError(
      provider,
      `${config.envKey}に使えない文字(U+${bad.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")})が含まれています。` +
        `全角文字や不可視文字が混ざっていないか確認し、貼り直してください`,
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

/**
 * 保存されているキーの形だけを返す。値そのものは返さない。
 *
 * Vercelのsensitiveな環境変数は保存後に画面で読めないため、
 * 「貼り間違えたのか、まだ反映されていないのか」を切り分ける手段が無かった。
 * 長さと先頭4文字(Geminiは必ずAIza)と、使えない文字の位置だけを出す。
 */
export function describeKey(provider: ProviderKey): {
  present: boolean;
  length: number;
  prefix: string;
  invalidAt: number | null;
  invalidChar: string | null;
} {
  const raw = process.env[PROVIDERS[provider].envKey];
  if (!raw) return { present: false, length: 0, prefix: "", invalidAt: null, invalidChar: null };
  const key = raw.trim();
  const chars = [...key];
  const at = chars.findIndex((ch) => ch.charCodeAt(0) > 0x7e || ch.charCodeAt(0) < 0x21);
  return {
    present: true,
    length: chars.length,
    prefix: chars.slice(0, 4).join(""),
    invalidAt: at < 0 ? null : at,
    invalidChar:
      at < 0 ? null : `U+${chars[at].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
  };
}

/** テスト用。環境変数を差し替えた後にキャッシュを捨てる */
export function resetClientCache(): void {
  clients.clear();
}
