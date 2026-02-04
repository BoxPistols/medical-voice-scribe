// 利用可能なOpenAIモデル（料金: USD per 1M tokens）
// speed: 1-5 (5が最速), quality: 1-5 (5が最高品質)
export const AVAILABLE_MODELS = [
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'バランス型', inputPrice: 0.40, outputPrice: 1.60, speed: 4, quality: 3 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: '最速・最安', inputPrice: 0.10, outputPrice: 0.40, speed: 5, quality: 2 },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: '高品質', inputPrice: 1.10, outputPrice: 4.40, speed: 3, quality: 5 },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: '高速・高品質', inputPrice: 0.30, outputPrice: 1.20, speed: 4, quality: 4 },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export const DEFAULT_MODEL: ModelId = 'gpt-4.1-mini';

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
