import OpenAI from "openai";

/**
 * OpenAI クライアントのシングルトンインスタンスを提供します。
 * 環境変数が設定されていない場合はエラーを投げます。
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY環境変数が設定されていません");
  }
  return new OpenAI({ apiKey });
}

// モジュールスコープでインスタンスを保持し、リクエスト間で再利用する
export const openai = createOpenAIClient();
