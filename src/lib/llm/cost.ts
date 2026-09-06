// トークン使用量から概算費用を出す。4つのルートに同じ計算が重複していたので集約した。

import { estimateCostUSD } from "./pricing";
import type { TokenUsage } from "@/app/api/analyze/types";

/** USD/JPYレート(概算)。環境変数で上書きできる */
const USD_TO_JPY = Number(process.env.NEXT_PUBLIC_USD_TO_JPY ?? 150);

/**
 * 価格が未登録のモデルは費用を0として返す。
 * 0は「無料」ではなく「不明」を意味するので、表示側は金額を出さない判断に使うこと。
 */
export function calculateTokenCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): TokenUsage {
  const usd = estimateCostUSD(modelId, promptTokens, completionTokens);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUSD: usd ?? 0,
    estimatedCostJPY: usd === null ? 0 : usd * USD_TO_JPY,
  };
}
