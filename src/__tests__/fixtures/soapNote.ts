import type { SoapNote } from '@/app/api/analyze/types';

export const mockSoapNote: SoapNote = {
  summary: "頭痛の訴えで来院。2週間前から朝のズキズキする頭痛が続いている。",
  patientInfo: {
    chiefComplaint: "頭痛",
    duration: "2週間前から"
  },
  soap: {
    subjective: {
      presentIllness: "2週間前から朝起床時にズキズキする頭痛が持続。",
      symptoms: ["頭痛", "めまい", "吐き気"],
      severity: "中等度",
      onset: "急性",
      associatedSymptoms: ["めまい", "吐き気"],
      pastMedicalHistory: "高血圧（5年前から治療中）",
      medications: ["アムロジピン 5mg"]
    },
    objective: {
      vitalSigns: {
        bloodPressure: "145/95 mmHg",
        pulse: "78 bpm",
        temperature: "36.8°C",
        respiratoryRate: "16 回/分"
      },
      physicalExam: "瞳孔正常、頸部硬直なし",
      laboratoryFindings: "未実施"
    },
    assessment: {
      diagnosis: "緊張型頭痛",
      icd10: "G44.2",
      differentialDiagnosis: ["片頭痛", "高血圧性頭痛"],
      clinicalImpression: "ストレスによる緊張型頭痛の可能性が高い"
    },
    plan: {
      treatment: "鎮痛薬投与、生活指導",
      medications: [
        {
          name: "ロキソプロフェン",
          dosage: "60mg",
          frequency: "1日3回 毎食後",
          duration: "7日分"
        }
      ],
      tests: ["血液検査（1週間後）"],
      referral: "記載なし",
      followUp: "1週間後再診",
      patientEducation: "十分な睡眠と水分摂取を指導"
    }
  }
};

export const mockEmptySoapNote: SoapNote = {
  summary: "",
  patientInfo: {
    chiefComplaint: "",
    duration: ""
  },
  soap: {
    subjective: {
      presentIllness: "",
      symptoms: [],
      severity: "",
      onset: "",
      associatedSymptoms: [],
      pastMedicalHistory: "",
      medications: []
    },
    objective: {
      vitalSigns: {
        bloodPressure: "",
        pulse: "",
        temperature: "",
        respiratoryRate: ""
      },
      physicalExam: "",
      laboratoryFindings: ""
    },
    assessment: {
      diagnosis: "",
      icd10: "",
      differentialDiagnosis: [],
      clinicalImpression: ""
    },
    plan: {
      treatment: "",
      medications: [],
      tests: [],
      referral: "",
      followUp: "",
      patientEducation: ""
    }
  }
};

export const mockInvalidJson = '{ invalid json }';

export const mockPartialSoapNote = {
  summary: "テスト",
  // soap is missing
};
