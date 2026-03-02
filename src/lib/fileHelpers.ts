/**
 * File operation helper functions
 * Extracted from page.tsx for testability
 */

import type { SoapNote } from '@/app/api/analyze/types';
import { escapeCsvCell, getTimestampForFilename } from './helpers';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Build CSV content string from a SOAP note
 */
export const buildCsvContent = (result: SoapNote): string => {
  const csvRows = [
    ["項目", "内容"],
    ["要約", result.summary || ""],
    ["主訴", result.patientInfo?.chiefComplaint || ""],
    ["期間", result.patientInfo?.duration || ""],
    ["現病歴", result.soap.subjective?.presentIllness || ""],
    ["症状", result.soap.subjective?.symptoms?.join(", ") || ""],
    ["重症度", result.soap.subjective?.severity || ""],
    ["発症", result.soap.subjective?.onset || ""],
    [
      "随伴症状",
      result.soap.subjective?.associatedSymptoms?.join(", ") || "",
    ],
    ["既往歴", result.soap.subjective?.pastMedicalHistory || ""],
    ["内服薬", result.soap.subjective?.medications?.join(", ") || ""],
    ["血圧", result.soap.objective?.vitalSigns?.bloodPressure || ""],
    ["脈拍", result.soap.objective?.vitalSigns?.pulse || ""],
    ["体温", result.soap.objective?.vitalSigns?.temperature || ""],
    ["呼吸数", result.soap.objective?.vitalSigns?.respiratoryRate || ""],
    ["身体所見", result.soap.objective?.physicalExam || ""],
    ["検査所見", result.soap.objective?.laboratoryFindings || ""],
    ["診断名", result.soap.assessment?.diagnosis || ""],
    ["ICD-10", result.soap.assessment?.icd10 || ""],
    [
      "鑑別診断",
      result.soap.assessment?.differentialDiagnosis?.join(", ") || "",
    ],
    ["臨床的印象", result.soap.assessment?.clinicalImpression || ""],
    ["治療方針", result.soap.plan?.treatment || ""],
    [
      "処方薬",
      result.soap.plan?.medications
        ?.map((m) => {
          const parts = [
            m?.name,
            m?.dosage,
            m?.frequency,
            m?.duration,
          ].filter((p) => p !== undefined && p !== null && p !== "");
          return parts.join(" ");
        })
        .join("; ") || "",
    ],
    ["検査", result.soap.plan?.tests?.join(", ") || ""],
    ["紹介", result.soap.plan?.referral || ""],
    ["フォローアップ", result.soap.plan?.followUp || ""],
    ["患者教育", result.soap.plan?.patientEducation || ""],
  ];

  return csvRows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
};

/**
 * Build CSV filename with timestamp
 */
export const buildCsvFilename = (): string => {
  return `soap_note_${getTimestampForFilename()}.csv`;
};

/**
 * Build JSON export filename with timestamp
 */
export const buildJsonFilename = (): string => {
  return `soap_note_${getTimestampForFilename()}.json`;
};

/**
 * Validate an import file (size and extension)
 */
export const validateImportFile = (
  file: File
): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。",
    };
  }

  if (!file.name.endsWith(".json")) {
    return {
      valid: false,
      error: "JSON形式のファイルのみインポート可能です。",
    };
  }

  return { valid: true };
};

/**
 * Validate imported JSON data structure
 */
export const validateImportData = (
  data: unknown
): { valid: boolean; error?: string } => {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "無効なJSON形式です。" };
  }

  const imported = data as Record<string, unknown>;

  if (!imported.soap || !imported.patientInfo) {
    return {
      valid: false,
      error: "SOAPノート形式が正しくありません。soapまたはpatientInfoが見つかりません。",
    };
  }

  const soap = imported.soap as Record<string, unknown>;
  if (
    !soap.subjective ||
    !soap.objective ||
    !soap.assessment ||
    !soap.plan
  ) {
    return {
      valid: false,
      error: "必須のSOAPセクション（S/O/A/P）が不足しています。",
    };
  }

  if (
    typeof soap.subjective !== "object" ||
    typeof soap.objective !== "object" ||
    typeof soap.assessment !== "object" ||
    typeof soap.plan !== "object"
  ) {
    return {
      valid: false,
      error: "SOAPセクションの構造が正しくありません。",
    };
  }

  return { valid: true };
};

/**
 * Build chat history text for download
 */
export const buildChatHistoryText = (
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
  }>
): string => {
  if (messages.length === 0) return "";

  const lines = messages.map((msg) => {
    const time = msg.timestamp.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const role = msg.role === "user" ? "あなた" : "AIサポート";
    return `[${time}] ${role}:\n${msg.content}`;
  });

  return `診療サポート チャット履歴\n${new Date().toLocaleDateString(
    "ja-JP"
  )}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
};
