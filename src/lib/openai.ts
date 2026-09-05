import OpenAI from "openai";

/** OPENAI_API_KEYが未設定のときに投げる。ルート側で503に変換する */
export class OpenAIConfigError extends Error {
  constructor() {
    super("OPENAI_API_KEY環境変数が設定されていません");
    this.name = "OpenAIConfigError";
  }
}

let client: OpenAI | null = null;

/**
 * OpenAIクライアントを遅延生成して返す。
 * モジュール読み込み時に生成すると、キー未設定の環境でルート全体が読み込み失敗になり
 * HTMLの500が返っていた。呼び出し時に生成すれば各ルートのtry/catchでJSONにできる。
 */
export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIConfigError();
  client = new OpenAI({ apiKey });
  return client;
}

/** 既存コードとの互換用。プロパティに触れた時点で初めてクライアントを生成する */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get: (_target, prop) => Reflect.get(getOpenAI(), prop),
});
