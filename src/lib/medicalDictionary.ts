/**
 * セマンティック医療辞書検索エンジン
 *
 * 事前計算済みembeddingを使って、入力テキストに関連する
 * 医療用語・ICD-10コードを検索する。
 */

import type { MedicalTermEntry, MedicalSearchResult } from "@/app/api/analyze/types";

// 事前計算済みembeddingデータ（サーバーサイドのみで使用）
import embeddedData from "@/data/medical-terms-embedded.json";

const dictionary: MedicalTermEntry[] = embeddedData as MedicalTermEntry[];

/** cosine similarity を計算 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * クエリembeddingで医療用語を検索
 * @param queryEmbedding - 入力テキストのembeddingベクトル
 * @param topK - 返却件数（デフォルト5）
 * @param threshold - 最低類似度（デフォルト0.3）
 */
export function searchMedicalTerms(
  queryEmbedding: number[],
  topK = 5,
  threshold = 0.3
): MedicalSearchResult[] {
  const results: MedicalSearchResult[] = dictionary
    .map((entry) => ({
      icd10: entry.icd10,
      name_ja: entry.name_ja,
      name_en: entry.name_en,
      keywords: entry.keywords,
      similarity: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

/**
 * 検索結果をプロンプト注入用テキストに変換
 */
export function buildMedicalContext(results: MedicalSearchResult[]): string {
  if (results.length === 0) return "";

  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.name_ja} (${r.icd10}) - 類似度: ${r.similarity.toFixed(2)}\n   関連症状: ${r.keywords.join("、")}`
  );

  return `\n\n【参考: 関連する可能性のある医療用語・ICD-10コード】
以下は入力テキストとの意味的類似度に基づく参考情報です。該当する場合は診断やICD-10コードの記載に活用してください。該当しない場合は無視してください。

${lines.join("\n")}`;
}
