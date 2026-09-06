// 既存コードとの互換層。実体はsrc/lib/llm/providers.tsのレジストリが持つ。
//
// 埋め込み(medical-terms-embedded.json)はtext-embedding-3-smallの256次元で
// 事前生成してあるので、問い合わせ側もOpenAIに固定する。別プロバイダーの埋め込みは
// ベクトル空間が違い、類似度検索が意味のない結果を返す。

import type OpenAI from "openai";
import {
  clientFor,
  clientForModel,
  ProviderConfigError,
  PROVIDERS,
} from "./llm/providers";

export { ProviderConfigError, clientForModel };

/**
 * キー未設定時にAPIが返す文言の既定値。
 * 実際にはプロバイダーごとの文言(ProviderConfigError.message)を優先して返すので、
 * どの環境変数を設定すべきかが利用者に伝わる。
 */
export const OPENAI_CONFIG_ERROR_MESSAGE =
  `サーバーにAPIキーが設定されていません。.env.localに${PROVIDERS.openai.envKey}` +
  `(またはGeminiを使う場合は${PROVIDERS.gemini.envKey})を設定してください`;

/**
 * OpenAIクライアントを遅延生成して返す。
 * 埋め込みのように、プロバイダーをOpenAIに固定したい箇所から使う。
 */
export function getOpenAI(): OpenAI {
  return clientFor("openai");
}

/** 既存コードとの互換用。プロパティに触れた時点で初めてクライアントを生成する */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get: (_target, prop) => Reflect.get(getOpenAI(), prop),
});
