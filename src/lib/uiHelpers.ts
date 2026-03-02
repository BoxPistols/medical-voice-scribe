/**
 * UI helper functions
 * Extracted from page.tsx for testability
 */

import type { SoapNote } from '@/app/api/analyze/types';

export type ThemeMode = "light" | "dark" | "system";

export type LayoutPreset = "equal" | "left" | "right";

/**
 * Get the left panel width percentage for a layout preset
 */
export const getLayoutPresetWidth = (preset: LayoutPreset): number => {
  switch (preset) {
    case "equal":
      return 50;
    case "left":
      return 65;
    case "right":
      return 35;
  }
};

/**
 * Cycle through themes: light → dark → system → light
 */
export const cycleTheme = (current: ThemeMode): ThemeMode => {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
};

/**
 * Build copy text for Subjective section
 */
export const buildCopySectionS = (result: SoapNote): string => {
  let text = "【主観的情報 (Subjective)】\n\n";
  if (result.soap.subjective?.presentIllness) {
    text += `現病歴:\n${result.soap.subjective.presentIllness}\n\n`;
  }
  if (
    result.soap.subjective?.symptoms &&
    result.soap.subjective.symptoms.length > 0
  ) {
    text += `症状:\n${result.soap.subjective.symptoms
      .map((s) => `• ${s}`)
      .join("\n")}\n\n`;
  }
  if (result.soap.subjective?.severity) {
    text += `重症度: ${result.soap.subjective.severity}\n\n`;
  }
  if (result.soap.subjective?.pastMedicalHistory) {
    text += `既往歴:\n${result.soap.subjective.pastMedicalHistory}\n`;
  }
  return text;
};

/**
 * Build copy text for Objective section
 */
export const buildCopySectionO = (result: SoapNote): string => {
  let text = "【客観的情報 (Objective)】\n\n";
  if (result.soap.objective?.vitalSigns) {
    text += "バイタルサイン:\n";
    const vs = result.soap.objective.vitalSigns;
    if (vs.bloodPressure) text += `• 血圧: ${vs.bloodPressure}\n`;
    if (vs.pulse) text += `• 脈拍: ${vs.pulse}\n`;
    if (vs.temperature) text += `• 体温: ${vs.temperature}\n`;
    if (vs.respiratoryRate) text += `• 呼吸数: ${vs.respiratoryRate}\n`;
    text += "\n";
  }
  if (result.soap.objective?.physicalExam) {
    text += `身体所見:\n${result.soap.objective.physicalExam}\n`;
  }
  return text;
};

/**
 * Build copy text for Assessment section
 */
export const buildCopySectionA = (result: SoapNote): string => {
  let text = "【評価・診断 (Assessment)】\n\n";
  if (result.soap.assessment?.diagnosis) {
    text += `診断名: ${result.soap.assessment.diagnosis}\n`;
    if (result.soap.assessment.icd10) {
      text += `ICD-10: ${result.soap.assessment.icd10}\n`;
    }
    text += "\n";
  }
  if (
    result.soap.assessment?.differentialDiagnosis &&
    result.soap.assessment.differentialDiagnosis.length > 0
  ) {
    text += `鑑別診断:\n${result.soap.assessment.differentialDiagnosis
      .map((d) => `• ${d}`)
      .join("\n")}\n\n`;
  }
  if (result.soap.assessment?.clinicalImpression) {
    text += `臨床的評価:\n${result.soap.assessment.clinicalImpression}\n`;
  }
  return text;
};

/**
 * Build copy text for Plan section
 */
export const buildCopySectionP = (result: SoapNote): string => {
  let text = "【計画 (Plan)】\n\n";
  if (result.soap.plan?.treatment) {
    text += `治療方針:\n${result.soap.plan.treatment}\n\n`;
  }
  if (
    result.soap.plan?.medications &&
    result.soap.plan.medications.length > 0
  ) {
    text += "処方:\n";
    result.soap.plan.medications.forEach((med, i) => {
      text += `${i + 1}. ${med.name || ""}\n`;
      if (med.dosage) text += `   用量: ${med.dosage}\n`;
      if (med.frequency) text += `   頻度: ${med.frequency}\n`;
      if (med.duration) text += `   期間: ${med.duration}\n`;
    });
    text += "\n";
  }
  if (result.soap.plan?.followUp) {
    text += `フォローアップ:\n${result.soap.plan.followUp}\n`;
  }
  return text;
};
