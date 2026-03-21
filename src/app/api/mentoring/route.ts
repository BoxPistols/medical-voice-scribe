import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ModelId } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';
import { checkAndIncrementRateLimit } from '@/lib/rateLimiter';

// メンタリングモード用システムプロンプト（ポジティブ心理学ベース）
const MENTORING_PROMPT = `あなたはポジティブ心理学に基づくメンタルコーチです。
ユーザーの発言からネガティブな思考パターンを検出し、認知の再構築（リフレーミング）を通じて前向きな視点を提供します。

## ルール
- 診断や治療は絶対に行わない。あくまでウェルビーイング支援
- まず共感を1〜2文で示し、ユーザーの気持ちを受け止める
- その上で別の視点や考え方を穏やかに提案する
- 具体的で実行可能な小さなアクションを1つ提案
- 過度にポジティブにならない。現実を認めた上で前向きな視点を示す
- 深刻な精神的問題の兆候がある場合は専門家への相談を勧める

## 文章構成（重要）
- 冒頭は共感を自然な言葉で1〜2文。ユーザーの言葉をそのまま繰り返さない
- 「〇〇と感じているんですね」のようなオウム返しは1回まで。冒頭で使ったら以降は繰り返さない
- 共感→視点の提示→アクション提案の順に段落を分ける
- 意味のまとまりごとに改行を入れ、1段落は2〜3文まで
- 長い壁文は絶対に避ける
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, conversationHistory, model: requestedModel } = body;

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

    // モデルの検証とフォールバック
    const model = requestedModel && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    // レート制限チェック
    const rateLimit = checkAndIncrementRateLimit(model);
    if (rateLimit.exceeded) {
      return NextResponse.json(
        { error: `本日の使用回数上限（${rateLimit.limit}回）に達しました。明日また試してください。` },
        { status: 429 }
      );
    }

    const openai = getOpenAIClient();

    // 会話履歴の検証と構築（systemロールはプロンプトインジェクション防止のため除外）
    const validRoles = ['user', 'assistant'];
    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = Array.isArray(conversationHistory)
      ? conversationHistory
          .filter((msg: { role?: string; content?: string }) =>
            msg &&
            typeof msg === 'object' &&
            validRoles.includes(msg.role || '') &&
            typeof msg.content === 'string'
          )
          .slice(-10)
          .map((msg: { role: string; content: string }) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content.slice(0, 1000),
          }))
      : [];

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: MENTORING_PROMPT
        },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_completion_tokens: 800,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json(
        { error: 'AI応答が空です' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: content,
    });

  } catch (error) {
    console.error('Mentoring API Error:', error);

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
      { error: 'メンタリング処理に失敗しました' },
      { status: 500 }
    );
  }
}
