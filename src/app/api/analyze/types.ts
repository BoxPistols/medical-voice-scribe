// 利用可能なOpenAIモデル（料金: USD per 1M tokens）
// speed: 1-5 (5が最速), quality: 1-5 (5が最高品質)
// 価格は OpenAI 公式 pricing を ground truth として記載（2026-06 時点・実測確認済み）。
// 参照: https://developers.openai.com/api/docs/pricing
export const AVAILABLE_MODELS = [
  { id: 'gpt-5.4-nano', name: 'gpt-5.4-nano', description: '高速・軽量', inputPrice: 0.20, outputPrice: 1.25, speed: 5, quality: 4 },
  { id: 'gpt-5.4-mini', name: 'gpt-5.4-mini', description: '高性能', inputPrice: 0.75, outputPrice: 4.50, speed: 3, quality: 5 },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export const DEFAULT_MODEL: ModelId = 'gpt-5.4-nano';

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

// チャットメッセージの型
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  type?: "recommendation" | "warning" | "help" | "normal";
}
