/**
 * 医療用語データセットのembedding事前計算スクリプト
 *
 * 使い方: pnpm generate:embeddings
 *
 * src/data/medical-terms-source.json を読み込み、
 * text-embedding-3-small (dim=256) でembeddingを生成し、
 * src/data/medical-terms-embedded.json に出力する。
 */

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;

interface MedicalTermSource {
  icd10: string;
  name_ja: string;
  name_en: string;
  aliases: string[];
  category: string;
  keywords: string[];
}

interface MedicalTermEmbedded extends MedicalTermSource {
  embedding: number[];
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY が設定されていません");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // 元データ読み込み
  const sourcePath = resolve(__dirname, "../src/data/medical-terms-source.json");
  const sourceData: MedicalTermSource[] = JSON.parse(
    readFileSync(sourcePath, "utf-8")
  );

  console.log(`${sourceData.length} エントリを読み込みました`);

  // embedding用テキストを生成（病名 + 別名 + キーワードを結合）
  const texts = sourceData.map(
    (entry) =>
      `${entry.name_ja} ${entry.aliases.join(" ")} ${entry.keywords.join(" ")}`
  );

  console.log(`embedding生成中... (model: ${EMBEDDING_MODEL}, dim: ${EMBEDDING_DIMENSIONS})`);

  // バッチでembedding生成（最大2048個まで1回のAPI呼び出しで処理可能）
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  console.log(
    `embedding生成完了 (トークン使用量: ${response.usage.total_tokens})`
  );

  // 元データとembeddingを結合
  const embeddedData: MedicalTermEmbedded[] = sourceData.map((entry, i) => ({
    ...entry,
    embedding: response.data[i].embedding,
  }));

  // 出力
  const outputPath = resolve(
    __dirname,
    "../src/data/medical-terms-embedded.json"
  );
  writeFileSync(outputPath, JSON.stringify(embeddedData, null, 2), "utf-8");

  const fileSizeKB = (
    Buffer.byteLength(JSON.stringify(embeddedData)) / 1024
  ).toFixed(1);
  console.log(`出力完了: ${outputPath} (${fileSizeKB} KB)`);
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
