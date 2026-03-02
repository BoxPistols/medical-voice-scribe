import type { Meta, StoryObj } from "@storybook/react";
import ChatSupportWidget from "./ChatSupportWidget";
import { SoapNote } from "../api/analyze/types";

const meta: Meta<typeof ChatSupportWidget> = {
  title: "Components/ChatSupportWidget",
  component: ChatSupportWidget,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ChatSupportWidget>;

const mockSoapNote: SoapNote = {
  summary: "45歳男性、昨夜からの急な右足親指の痛みと腫れ。痛風が疑われる。",
  patientInfo: {
    chiefComplaint: "右足親指の激痛",
    duration: "昨夜から",
  },
  soap: {
    subjective: {
      presentIllness: "昨夜の宴会後、深夜に右足第一趾中足趾節関節の激痛で目が覚めた。歩行困難。",
      symptoms: ["激痛", "腫脹", "発赤", "熱感"],
      severity: "重度 (10/10)",
      onset: "急性 (昨夜深夜)",
      associatedSymptoms: ["軽度の発熱"],
      pastMedicalHistory: "高尿酸血症 (放置)",
      medications: ["なし"],
    },
    objective: {
      vitalSigns: {
        bloodPressure: "138/88 mmHg",
        pulse: "82 bpm",
        temperature: "37.2 ℃",
        respiratoryRate: "16 /min",
      },
      physicalExam: "右第1MTP関節に高度の腫脹、発赤、熱感あり。触れるだけで激痛を訴える（圧痛著明）。",
      laboratoryFindings: "尿酸値 8.5 mg/dL, CRP 2.4 mg/dL, WBC 9800 /μL",
    },
    assessment: {
      diagnosis: "痛風発作 (急性痛風性関節炎)",
      icd10: "M10.0",
      differentialDiagnosis: ["偽痛風", "蜂窩織炎", "化膿性関節炎"],
      clinicalImpression: "典型的な痛風発作の所見。食生活の乱れと高尿酸血症の既往が背景にある。",
    },
    plan: {
      treatment: "患部の冷却と安静。水分摂取の励行。",
      medications: [
        {
          name: "ロキソプロフェンナトリウム",
          dosage: "60mg",
          frequency: "1日3回 毎食後",
          duration: "5日分",
        },
        {
          name: "コルヒチン",
          dosage: "0.5mg",
          frequency: "頓用 (発作予兆時)",
          duration: "10錠",
        },
      ],
      tests: ["関節液吸引（結晶確認）", "超音波検査"],
      referral: "なし",
      followUp: "1週間後に再診。発作消失後に尿酸降下薬の開始を検討。",
      patientEducation: "プリン体の多い食事やアルコールを控える。十分な水分を摂る。発作中に尿酸降下薬を急に始めない。",
    },
  },
};

export const Default: Story = {
  args: {
    soapNote: null,
    transcript: "",
    selectedModel: "gpt-4.1-mini",
    isRecording: false,
    isAnalyzing: false,
  },
};

export const WithSoapNote: Story = {
  args: {
    soapNote: mockSoapNote,
    transcript: "右足の親指が昨日の夜からものすごく痛くなって...",
    selectedModel: "gpt-4.1-mini",
    isRecording: false,
    isAnalyzing: false,
  },
};

export const Recording: Story = {
  args: {
    soapNote: null,
    transcript: "現在患者さんとお話ししています...",
    selectedModel: "gpt-4.1-mini",
    isRecording: true,
    isAnalyzing: false,
  },
};

export const Analyzing: Story = {
  args: {
    soapNote: null,
    transcript: "先ほどの会話を分析してカルテを作成しています...",
    selectedModel: "gpt-4.1-mini",
    isRecording: false,
    isAnalyzing: true,
  },
};
