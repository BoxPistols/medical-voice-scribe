import type { SoapNote } from "@/app/api/analyze/types";

// レコメンドアイテムの型
export interface Recommendation {
  id: string;
  type: "differential" | "test" | "followup" | "education" | "warning";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  iconName: string; // アイコン名を文字列で保持（コンポーネント外でも使えるように）
}

// 定数
export const MAX_RECOMMENDATIONS = 5;
export const PRIORITY_ORDER: Record<Recommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * SOAPノートからレコメンドを生成する
 */
export function generateRecommendations(soapNote: SoapNote | null): Recommendation[] {
  if (!soapNote?.soap) return [];

  const recommendations: Recommendation[] = [];
  const { soap } = soapNote;

  // 鑑別診断の確認を促す
  if (
    soap.assessment?.differentialDiagnosis &&
    soap.assessment.differentialDiagnosis.length > 0
  ) {
    recommendations.push({
      id: "differential-check",
      type: "differential",
      title: "鑑別診断の確認",
      description: `${soap.assessment.differentialDiagnosis.slice(0, 3).join("、")}など${soap.assessment.differentialDiagnosis.length}つの鑑別診断があります。除外診断のための追加情報を検討してください。`,
      priority: "high",
      iconName: "ClipboardDocumentCheckIcon",
    });
  }

  // 症状の重症度に基づく警告
  if (
    soap.subjective?.severity &&
    (soap.subjective.severity.includes("重") ||
      soap.subjective.severity.includes("強"))
  ) {
    recommendations.push({
      id: "severity-warning",
      type: "warning",
      title: "重症度に注意",
      description: "患者は重度の症状を報告しています。バイタルサインの継続的なモニタリングと、必要に応じて専門医への紹介を検討してください。",
      priority: "high",
      iconName: "ExclamationTriangleIcon",
    });
  }

  // 追加検査の提案
  if (soap.plan?.tests && soap.plan.tests.length > 0) {
    recommendations.push({
      id: "tests-suggested",
      type: "test",
      title: "追加検査の実施",
      description: `提案された検査: ${soap.plan.tests.slice(0, 3).join("、")}。診断確定のため、これらの検査を検討してください。`,
      priority: "medium",
      iconName: "BeakerIcon",
    });
  }

  // フォローアップの提案
  if (soap.plan?.followUp) {
    recommendations.push({
      id: "followup-reminder",
      type: "followup",
      title: "フォローアップの設定",
      description: `推奨フォローアップ: ${soap.plan.followUp}。症状の経過観察と治療効果の評価のため、フォローアップ予定を確認してください。`,
      priority: "medium",
      iconName: "ArrowPathIcon",
    });
  }

  // 患者教育のポイント
  if (soap.plan?.patientEducation) {
    recommendations.push({
      id: "patient-education",
      type: "education",
      title: "患者への説明事項",
      description: soap.plan.patientEducation,
      priority: "low",
      iconName: "UserGroupIcon",
    });
  }

  // 薬の相互作用チェック
  if (
    soap.plan?.medications &&
    soap.plan.medications.length > 0 &&
    soap.subjective?.medications &&
    soap.subjective.medications.length > 0
  ) {
    recommendations.push({
      id: "drug-interaction",
      type: "warning",
      title: "薬物相互作用の確認",
      description: `新規処方薬と既存薬の相互作用をご確認ください。現在服用中: ${soap.subjective.medications.slice(0, 2).join("、")}`,
      priority: "high",
      iconName: "ExclamationTriangleIcon",
    });
  }

  // 随伴症状からの追加チェック
  if (
    soap.subjective?.associatedSymptoms &&
    soap.subjective.associatedSymptoms.length > 2
  ) {
    recommendations.push({
      id: "associated-symptoms",
      type: "differential",
      title: "複数症状の包括的評価",
      description: `${soap.subjective.associatedSymptoms.length}つの随伴症状があります。全身性疾患や複合的な病態の可能性を検討してください。`,
      priority: "medium",
      iconName: "LightBulbIcon",
    });
  }

  // 優先度順にソートして上位5件を返す
  return recommendations
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, MAX_RECOMMENDATIONS);
}
