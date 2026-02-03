import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'テキストがありません' }, { status: 400 });
    }

    const systemPrompt = `
あなたは経験豊富な医療記録専門家です。医師と患者の会話から、実際の電子カルテに記載するような詳細で専門的なSOAPノートを作成してください。

【重要な指示】
- 会話から推測できる情報を最大限に活用し、臨床的に妥当な詳細を補完してください
- 医学用語を適切に使用し、実際の診療記録としての完成度を高めてください
- 不明な情報は「記載なし」と明記してください

以下のJSON形式で出力してください：

{
  "summary": "症状と診察内容の簡潔な要約（100-150文字）",
  "patientInfo": {
    "chiefComplaint": "主訴（患者が訴える主な症状）",
    "duration": "症状の期間・発症時期"
  },
  "soap": {
    "subjective": {
      "presentIllness": "現病歴の詳細な記述",
      "symptoms": ["症状1", "症状2", "症状3"],
      "severity": "症状の重症度（軽度/中等度/重度）",
      "onset": "発症様式（急性/慢性/突然など）",
      "associatedSymptoms": ["随伴症状1", "随伴症状2"],
      "pastMedicalHistory": "既往歴（会話から推測できる範囲）",
      "medications": ["現在服用中の薬剤"]
    },
    "objective": {
      "vitalSigns": {
        "bloodPressure": "血圧（例: 120/80 mmHg、記載なしの場合は「測定なし」）",
        "pulse": "脈拍（例: 72 bpm、記載なしの場合は「測定なし」）",
        "temperature": "体温（例: 36.5°C、記載なしの場合は「測定なし」）",
        "respiratoryRate": "呼吸数（記載なしの場合は「測定なし」）"
      },
      "physicalExam": "身体所見の詳細（会話から推測される所見を記載）",
      "laboratoryFindings": "検査所見（実施された場合のみ記載、なければ「未実施」）"
    },
    "assessment": {
      "diagnosis": "診断名（日本語）",
      "icd10": "ICD-10コード（推定、例: M79.3）",
      "differentialDiagnosis": ["鑑別診断1", "鑑別診断2"],
      "clinicalImpression": "臨床的評価・病状の解釈"
    },
    "plan": {
      "treatment": "治療方針の詳細",
      "medications": [
        {
          "name": "薬剤名（一般名と商品名）",
          "dosage": "用量",
          "frequency": "頻度（例: 1日3回 毎食後）",
          "duration": "期間（例: 7日分）"
        }
      ],
      "tests": ["追加検査項目"],
      "referral": "紹介・専門医への照会（必要な場合）",
      "followUp": "フォローアップ計画",
      "patientEducation": "患者指導内容"
    }
  }
}

【出力時の注意】
1. 全てのフィールドに何らかの情報を記載してください（不明な場合は推測または「記載なし」）
2. 医学的に矛盾のない内容にしてください
3. 日本の医療現場で実際に使用される表現を使ってください
4. バイタルサインは会話に記載がなくても、症状から推測される範囲で記載してください
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // コスト重視。精度重視ならgpt-4o
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return NextResponse.json(result);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'AI処理に失敗しました' }, { status: 500 });
  }
}
