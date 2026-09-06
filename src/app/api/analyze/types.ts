import { getPricing } from "@/lib/llm/pricing";
import { PROVIDERS, type ProviderKey } from "@/lib/llm/providers";

// 利用可能なモデル。
// speed: 1-5 (5が最速), quality: 1-5 (5が最高品質)
// 価格はここに書かずsrc/lib/llm/pricing.tsから引く(分散させると更新漏れが起きる)。
// モデルIDは各社の公式ドキュメントで確認したものだけを載せる。
export interface ModelInfo {
  id: string;
  provider: ProviderKey;
  name: string;
  description: string;
  speed: number;
  quality: number;
  /** USD / 100万入力トークン。価格未登録ならnull */
  inputPrice: number | null;
  outputPrice: number | null;
}

const MODEL_CATALOG: Omit<ModelInfo, "inputPrice" | "outputPrice">[] = [
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    name: "GPT-5.6 Luna",
    description: "高速・コスパ最強",
    speed: 5,
    quality: 4,
  },
  {
    id: "gemini-3.6-flash",
    provider: "gemini",
    name: "Gemini 3.6 Flash",
    description: "無料枠あり・高速",
    speed: 5,
    quality: 4,
  },
];

export const AVAILABLE_MODELS: ModelInfo[] = MODEL_CATALOG.map((m) => {
  const p = getPricing(m.id);
  return { ...m, inputPrice: p?.input ?? null, outputPrice: p?.output ?? null };
});

export type ModelId = string;

export const DEFAULT_MODEL = "gpt-5.6-luna";

/** そのモデルを提供するプロバイダーの環境変数名 */
export function envKeyForModel(modelId: string): string | null {
  const m = AVAILABLE_MODELS.find((x) => x.id === modelId);
  return m ? PROVIDERS[m.provider].envKey : null;
}

// トークン使用量
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  estimatedCostJPY: number;
}

export interface SoapNote {
  summary: string;
  patientInfo: {
    chiefComplaint: string;
    duration: string;
  };
  soap: {
    subjective: {
      presentIllness: string;
      symptoms: string[];
      severity: string;
      onset: string;
      associatedSymptoms: string[];
      pastMedicalHistory: string;
      medications: string[];
    };
    objective: {
      vitalSigns: {
        bloodPressure: string;
        pulse: string;
        temperature: string;
        respiratoryRate: string;
      };
      physicalExam: string;
      laboratoryFindings: string;
    };
    assessment: {
      diagnosis: string;
      icd10: string;
      differentialDiagnosis: string[];
      clinicalImpression: string;
    };
    plan: {
      treatment: string;
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
      }>;
      tests: string[];
      referral: string;
      followUp: string;
      patientEducation: string;
    };
  };
}

// 医療用語エントリ（embedding付き）
export interface MedicalTermEntry {
  icd10: string;
  name_ja: string;
  name_en: string;
  aliases: string[];
  category: string;
  keywords: string[];
  embedding: number[];
}

// 医療用語検索結果
export interface MedicalSearchResult {
  icd10: string;
  name_ja: string;
  name_en: string;
  keywords: string[];
  similarity: number;
}

// チャットメッセージの型
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  type?: "recommendation" | "warning" | "help" | "normal";
}
