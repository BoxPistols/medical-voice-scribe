import type { ModelId } from "@/app/api/analyze/types";

// GPT-5 / GPT-4.1 / o1 / o3 系は Chat Completions API で次の制約がある:
//  - temperature のカスタム値を受け付けない（既定 1.0 のみ）
//  - max_tokens ではなく max_completion_tokens を要求する
// これらを満たさないと 400 (unsupported_value) になる。
// llm-radar:allow-superseded 世代の前方一致で判定するので旧IDが要る（gpt-6は未対応）
const RESTRICTED_PREFIX = /^(gpt-5|gpt-4\.1|o1|o3)/;

// reasoning 系は reasoning トークンも max_completion_tokens に乗るため、
// 床が低いと「reasoning で使い切って content 空」になりやすい。十分な床を確保する。
const RESTRICTED_TOKEN_FLOOR = 4000;

function isRestricted(model: string): boolean {
  return RESTRICTED_PREFIX.test(model);
}

/**
 * モデル系統に応じて互換なチューニング引数を組み立て、create() にスプレッドして使う。
 * 例: openai.chat.completions.create({ model, messages, ...buildChatTuning(model, { temperature: 0.7, maxTokens: 800 }) })
 */
export function buildChatTuning(
  model: ModelId,
  opts: { maxTokens?: number; temperature?: number }
): { temperature?: number; max_tokens?: number; max_completion_tokens?: number } {
  const out: { temperature?: number; max_tokens?: number; max_completion_tokens?: number } = {};

  if (isRestricted(model)) {
    // 呼び出し側が指定した値を優先し、指定がなければ床（RESTRICTED_TOKEN_FLOOR）を使用
    out.max_completion_tokens = opts.maxTokens ?? RESTRICTED_TOKEN_FLOOR;
    // temperature は既定(1)のみ許容のため付与しない
  } else {
    if (typeof opts.maxTokens === "number") out.max_tokens = opts.maxTokens;
    if (typeof opts.temperature === "number") out.temperature = opts.temperature;
  }
  return out;
}

/**
 * モデル応答から JSON を頑健に取り出す。
 * - 空応答（reasoning がトークンを使い切った等）は明確な日本語エラーで弾く（サイレント失敗防止）
 * - ```json ... ``` のコードフェンスを除去
 * - 前後に散文が付いても最初の { 〜 最後の } を抽出
 * response_format: json_object が（モデル都合で）強制されないケースでも復元できるようにする。
 */
export function parseModelJson<T = unknown>(content: string | null | undefined): T {
  if (!content || content.trim() === "") {
    throw new Error(
      "AIの応答が空でした。モデルがトークン上限に達した可能性があります。軽量モデルに切り替えるか、もう一度お試しください。"
    );
  }
  let text = content.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  return JSON.parse(text) as T;
}
