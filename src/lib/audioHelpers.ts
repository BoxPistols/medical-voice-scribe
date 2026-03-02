/**
 * Audio/Speech helper functions
 * Extracted from page.tsx for testability
 */

import type { SoapNote } from '@/app/api/analyze/types';

/**
 * Format elapsed time as MM:SS or HH:MM:SS
 */
export const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

/**
 * Extract readable text from SOAP note structure for speech synthesis (full version)
 */
export const buildSpeechText = (soapNote: SoapNote): string => {
  let text = "";

  // Summary
  if (soapNote.summary) {
    text += `要約。${soapNote.summary}\n\n`;
  }

  // Patient Info
  if (soapNote.patientInfo) {
    text += "患者情報。";
    if (soapNote.patientInfo.chiefComplaint) {
      text += `主訴、${soapNote.patientInfo.chiefComplaint}。`;
    }
    if (soapNote.patientInfo.duration) {
      text += `期間、${soapNote.patientInfo.duration}。`;
    }
    text += "\n\n";
  }

  // Subjective
  text += "S、主観的情報。";
  if (soapNote.soap.subjective?.presentIllness) {
    text += `現病歴、${soapNote.soap.subjective.presentIllness}。`;
  }
  if (soapNote.soap.subjective?.symptoms?.length > 0) {
    text += `症状、${soapNote.soap.subjective.symptoms.join("、")}。`;
  }
  if (soapNote.soap.subjective?.severity) {
    text += `重症度、${soapNote.soap.subjective.severity}。`;
  }
  text += "\n\n";

  // Objective
  text += "O、客観的情報。";
  if (soapNote.soap.objective?.vitalSigns) {
    const vs = soapNote.soap.objective.vitalSigns;
    text += `バイタルサイン、血圧${vs.bloodPressure}、脈拍${vs.pulse}、体温${vs.temperature}、呼吸数${vs.respiratoryRate}。`;
  }
  if (soapNote.soap.objective?.physicalExam) {
    text += `身体所見、${soapNote.soap.objective.physicalExam}。`;
  }
  text += "\n\n";

  // Assessment
  text += "A、評価・診断。";
  if (soapNote.soap.assessment?.diagnosis) {
    text += `診断名、${soapNote.soap.assessment.diagnosis}。`;
  }
  if (soapNote.soap.assessment?.differentialDiagnosis?.length > 0) {
    text += `鑑別診断、${soapNote.soap.assessment.differentialDiagnosis.join(
      "、"
    )}。`;
  }
  text += "\n\n";

  // Plan
  text += "P、治療計画。";
  if (soapNote.soap.plan?.treatment) {
    text += `治療方針、${soapNote.soap.plan.treatment}。`;
  }
  if (soapNote.soap.plan?.medications?.length > 0) {
    text += "処方、";
    soapNote.soap.plan.medications.forEach((med, i) => {
      text += `${i + 1}、${med.name}、用量${med.dosage}、用法${
        med.frequency
      }、期間${med.duration}。`;
    });
  }
  if (soapNote.soap.plan?.followUp) {
    text += `フォローアップ、${soapNote.soap.plan.followUp}。`;
  }

  return text;
};

/**
 * Find the best voice for a given language from available voices
 */
export const getVoiceForLanguage = (
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | null => {
  // Exact match first
  const exactMatch = voices.find((v) => v.lang === lang);
  if (exactMatch) return exactMatch;

  // Partial match (e.g. "ja" matches "ja-JP")
  const baseLang = lang.split("-")[0];
  const partialMatch = voices.find((v) => v.lang.startsWith(baseLang));
  if (partialMatch) return partialMatch;

  // Fallback to first voice
  return voices.length > 0 ? voices[0] : null;
};
