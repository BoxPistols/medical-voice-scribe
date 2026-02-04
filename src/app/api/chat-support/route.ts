import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { SoapNote, ModelId, ChatMessage } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';

// チャットサポート用システムプロンプト
const CHAT_SUPPORT_PROMPT = `あなたは医療従事者向けの診療支援AIアシスタントです。医師や看護師が診療を行う際のサポートを行います。

## あなたの役割
1. **診療サポート**: 問診データに基づいて、診断の確認、追加検査の提案、フォローアップの推奨を行います
2. **誤診防止支援**: 鑑別診断の確認、レッドフラグ症状のチェック、見落としがちなポイントの指摘を行います
3. **アプリ使用サポート**: このアプリ（Medical Voice Scribe）の使い方について説明します

## 応答ルール
- 日本語で応答してください
- 簡潔で実用的な回答を心がけてください
- 医学的な提案は、あくまで参考情報として提示し、最終判断は医療従事者に委ねてください
- 患者に直接説明する内容ではなく、医療従事者向けの専門的な内容で回答してください
- 不確かな情報は推測であることを明示してください

## 重要：免責事項とプライバシー
- **このAIは医療機器ではなく、診断・治療を目的としたものではありません。** 提示された情報は必ず医療従事者が検証してください。
- **患者の個人情報（氏名、住所、生年月日など）は入力データに含まれないようにしてください。**
- AIは一般的な医学知識に基づいて回答しますが、最新のガイドラインや個別の症例の特殊性を完全に反映できない場合があります。

## アプリの使い方に関する質問への回答
このアプリ「Medical Voice Scribe」は医療音声文字起こし＆カルテ生成アプリです：
- **録音機能**: 「録音開始」ボタンまたはRキーで開始、再度押すと停止
- **カルテ生成**: 「カルテ生成」ボタンまたはAキーで、入力テキストからSOAP形式のカルテを自動生成
- **エクスポート**: JSON/CSV形式でカルテをダウンロード可能
- **インポート**: 以前エクスポートしたJSONファイルを読み込み可能
- **読み上げ**: 各セクションのスピーカーアイコンで音声読み上げ
- **テーマ**: ライト/ダーク/システム設定から選択可能
- **ショートカット**: ?キーでヘルプ、各種ショートカットはカスタマイズ可能

## 診療サポートの際の注意点
- 提供された問診データ（SOAP形式）を参照しながら回答
- 診断名だけでなく、その根拠や確認すべきポイントも説明
- 鑑別診断を挙げる際は、除外すべき理由や追加検査も提案
- 緊急性の高い症状や所見がある場合は、明確に警告
`;

// モデルIDの検証
function isValidModel(model: string): model is ModelId {
  return AVAILABLE_MODELS.some(m => m.id === model);
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY環境変数が設定されていません');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// SOAPノートをコンテキスト文字列に変換
function formatSoapContext(soapNote: SoapNote | null): string {
  if (!soapNote || !soapNote.soap) return '（カルテデータなし）';

  const { soap, summary, patientInfo } = soapNote;
  
  // 安全なアクセスヘルパー
  const safeStr = (val: string | undefined | null) => val || '不明';
  const safeJoin = (arr: string[] | undefined | null) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : 'なし';

  return `
## 現在の診療データ

### 要約
${safeStr(summary)}

### 患者情報
- 主訴: ${safeStr(patientInfo?.chiefComplaint)}
- 症状期間: ${safeStr(patientInfo?.duration)}

### S（主観的情報）
- 現病歴: ${safeStr(soap.subjective?.presentIllness)}
- 症状: ${safeJoin(soap.subjective?.symptoms)}
- 重症度: ${safeStr(soap.subjective?.severity)}
- 発症時期: ${safeStr(soap.subjective?.onset)}
- 随伴症状: ${safeJoin(soap.subjective?.associatedSymptoms)}
- 既往歴: ${safeStr(soap.subjective?.pastMedicalHistory)}
- 服用中の薬: ${safeJoin(soap.subjective?.medications)}

### O（客観的情報）
- バイタル: BP ${safeStr(soap.objective?.vitalSigns?.bloodPressure)}, P ${safeStr(soap.objective?.vitalSigns?.pulse)}, T ${safeStr(soap.objective?.vitalSigns?.temperature)}, RR ${safeStr(soap.objective?.vitalSigns?.respiratoryRate)}
- 身体所見: ${safeStr(soap.objective?.physicalExam)}
- 検査所見: ${safeStr(soap.objective?.laboratoryFindings)}

### A（評価）
- 診断: ${safeStr(soap.assessment?.diagnosis)}
- ICD-10: ${safeStr(soap.assessment?.icd10)}
- 鑑別診断: ${safeJoin(soap.assessment?.differentialDiagnosis)}
- 臨床的印象: ${safeStr(soap.assessment?.clinicalImpression)}

### P（計画）
- 治療方針: ${safeStr(soap.plan?.treatment)}
- 処方薬: ${Array.isArray(soap.plan?.medications) ? soap.plan.medications.map(m => `${m.name || '名称不明'} ${m.dosage || ''} ${m.frequency || ''}`).join(', ') : 'なし'}
- 検査計画: ${safeJoin(soap.plan?.tests)}
- 紹介: ${safeStr(soap.plan?.referral)}
- フォローアップ: ${safeStr(soap.plan?.followUp)}
- 患者教育: ${safeStr(soap.plan?.patientEducation)}
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, soapNote, transcript, model: requestedModel, conversationHistory } = body;

    // 基本的な入力検証
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'メッセージが無効です' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'メッセージが長すぎます（最大2000文字）' },
        { status: 400 }
      );
    }

    if (transcript && typeof transcript === 'string' && transcript.length > 20000) {
      return NextResponse.json(
        { error: 'トランスクリプトが長すぎます' },
        { status: 400 }
      );
    }

    // モデルの検証とフォールバック
    const model = requestedModel && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const openai = getOpenAIClient();

    // コンテキストの構築
    const soapContext = formatSoapContext(soapNote);
    const transcriptContext = transcript ? `\n## 元のトランスクリプト\n${transcript.slice(0, 5000)}` : ''; // コンテキスト制限のため切り詰め

    // 会話履歴の検証と構築
    const validRoles = ['user', 'assistant', 'system'];
    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = Array.isArray(conversationHistory) 
      ? conversationHistory
          .filter((msg: any) => 
            msg && 
            typeof msg === 'object' && 
            validRoles.includes(msg.role) && 
            typeof msg.content === 'string'
          )
          .slice(-10)
          .map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content.slice(0, 1000), // 各メッセージの長さも制限
          }))
      : [];

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: CHAT_SUPPORT_PROMPT + '\n\n' + soapContext + transcriptContext
        },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json(
        { error: 'AI応答が空です' },
        { status: 500 }
      );
    }

    // 応答タイプの判定（警告、推奨、通常）
    let responseType = 'normal';
    if (content.includes('警告') || content.includes('注意') || content.includes('緊急')) {
      responseType = 'warning';
    } else if (content.includes('推奨') || content.includes('提案') || content.includes('検討')) {
      responseType = 'recommendation';
    }

    return NextResponse.json({
      response: content,
      type: responseType,
    });

  } catch (error) {
    console.error('Chat Support API Error:', error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'OpenAI APIキーが無効です' },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'APIレート制限に達しました。しばらく待ってから再試行してください' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `OpenAI APIエラー: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'チャット処理に失敗しました' },
      { status: 500 }
    );
  }
}
