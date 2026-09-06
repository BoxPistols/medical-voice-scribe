// モデル価格の単一ソース。
// 価格は変動するのでコードへ分散して書かず、このファイルに隔離する。
// 一次情報で確認が取れていないモデルは登録しない。見積もり関数はnullを返し、
// UIは表示しない(誤った数値を見せないほうがましなので、fail-closedにする)。

export interface ModelPricing {
  /** USD / 100万入力トークン */
  input: number;
  /** USD / 100万出力トークン */
  output: number;
}

/**
 * 価格表の確認日。
 * 2026-09-06: developers.openai.com/api/docs/pricingと
 * ai.google.dev/gemini-api/docs/pricingの表を直接照合した(標準処理・短コンテキスト)。
 */
export const PRICING_AS_OF = "2026-09-06";

const DEFAULT_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },

  // Gemini
  // 3.6/3.7/3.8 flashは同額で、いずれも2026-12-31までの期間価格。
  // 2027-01-01から $1.50/$7.50に戻るので、その時点で更新する。
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  // 3.5-flashは旧世代で、3.8の2倍以上高い($1.50/$9.00)。
  // 選ぶと損をするだけなので登録も選択肢入りもさせない。
};

function isValidPricing(v: unknown): v is ModelPricing {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as ModelPricing).input === "number" &&
    typeof (v as ModelPricing).output === "number" &&
    (v as ModelPricing).input >= 0 &&
    (v as ModelPricing).output >= 0
  );
}

/** ビルド時の環境変数(JSON)で上書きできる。値上げにコード変更なしで追随するため */
function overrides(): Record<string, ModelPricing> {
  const raw = process.env.NEXT_PUBLIC_MODEL_PRICING;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, ModelPricing> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isValidPricing(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getPricing(modelId: string): ModelPricing | null {
  return { ...DEFAULT_PRICING, ...overrides() }[modelId] ?? null;
}

/** 価格が登録されているモデルID。テストで許可リストとの整合を固定する */
export function pricedModelIds(): string[] {
  return Object.keys({ ...DEFAULT_PRICING, ...overrides() });
}

/**
 * トークン数から概算費用を出す。価格未登録ならnull。
 * 呼び出し側はnullを0に丸めず、「不明」として扱うこと。
 */
export function estimateCostUSD(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const p = getPricing(modelId);
  if (!p) return null;
  return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}
