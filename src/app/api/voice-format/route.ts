import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ModelId, TokenUsage } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';
import { checkAndIncrementRateLimit } from '@/lib/rateLimiter';

const USD_TO_JPY = 150;

function isValidModel(model: string): model is ModelId {
  return AVAILABLE_MODELS.some(m => m.id === model);
}

function calculateTokenCost(modelId: ModelId, promptTokens: number, completionTokens: number): TokenUsage {
  const modelConfig = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!modelConfig) {
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimatedCostUSD: 0, estimatedCostJPY: 0 };
  }
  const inputCost = (promptTokens / 1_000_000) * modelConfig.inputPrice;
  const outputCost = (completionTokens / 1_000_000) * modelConfig.outputPrice;
  const totalCostUSD = inputCost + outputCost;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUSD: totalCostUSD,
    estimatedCostJPY: totalCostUSD * USD_TO_JPY,
  };
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY環境変数が設定されていません');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const ORGANIZE_PROMPT = `あなたはITエンジニアの音声認識テキストをSlackチャット向けに整理するアシスタントです。
入力されたテキストは音声認識で生成されたものです。以下のルールで整理してください：

1. 誤認識と思われる箇所を文脈から推測して修正（特にIT用語・技術用語の誤認識に注意）
2. IT用語は正式な英語表記に統一（例: プルリク→Pull Request、デプロイ→deploy、リファクタ→refactor）
3. フィラー（えーと、あの、まあ、なんか、なんていうか等）は全て除去
4. 冗長な言い回しや繰り返しを簡潔に整理
5. 文節ごとに適切な句読点を挿入
6. 話題の切り替わりで空行（改行2つ）を入れ、コピーペーストでそのまま使える段落構造にする
7. 意味が通るように文章を整える（ただし内容は変えない）
8. Slackチャットとして自然な文体にする（「です・ます」調で簡潔に）
9. 絵文字を1つだけ文章の最初か最後に入れる（日本のチャット文化として1メッセージに絵文字は1個まで）
10. 話者が複数いる場合は区別して表示

【自然な日本語のための注意点】
- 「さらに」「加えて」「また」等の接続詞を連続して使わない。接続詞なしで文を並べるか、自然な繋ぎ言葉を使う
- 「〜という観点から」「〜を踏まえると」等の冗長表現を避け、「〜なので」「〜から」等の平易な言い回しにする
- 全ての文が同じ長さ・同じリズムにならないよう、短い文と長い文を混ぜる
- 箇条書きに太字見出し+コロン（「**項目:** 内容」）の形式を使わない
- 「極めて重要」「不可欠」等の大げさな表現を避ける
- 日本人エンジニアがSlackに実際に書くような自然な文体にする

出力はJSON形式:
{
  "formatted": "整理されたテキスト",
  "changes": ["変更点の簡潔な説明（配列）"]
}`;

const SUMMARIZE_PROMPT = `あなたはITエンジニアの音声認識テキストを要約するアシスタントです。
入力されたテキストの要点をまとめてください：

1. 主要なポイントを日本語の箇条書きで抽出（自然な日本語文で記述）
2. 全体の概要を2-3文で記述（Slackで共有しやすい簡潔な日本語文体で）
3. アクションアイテムがあれば日本語で抽出
4. キーワードを日本語で抽出（固有名詞や一般的な略語のみ原語表記可）

重要: 出力はすべて日本語で記述してください。英語のみの文は禁止です。

【自然な日本語のための注意点】
- 概要は日本人エンジニアが書くSlackメッセージのような自然な文体にする
- 「さらに」「加えて」「特筆すべきは」等の接続詞を連続で使わない
- 「〜が重要です」「〜が不可欠です」のような定型的な結びを避け、具体的な内容で締める
- 箇条書きの各項目を同じ構文パターンで揃えすぎない

出力はJSON形式:
{
  "summary": "概要（2-3文、日本語）",
  "keyPoints": ["要点1（日本語）", "要点2（日本語）", ...],
  "actionItems": ["アクション1（日本語）", ...],
  "keywords": ["キーワード1（日本語）", ...]
}`;

const CHAT_REFORMAT_PROMPT = `あなたは音声認識テキストをチャット投稿用に整形するアシスタントです。
話者本人が書いたかのように、一人称視点を絶対に維持してください。三人称や客観的な書き換えは禁止です。

以下のルールで整形してください：

1. 一人称視点を絶対に維持する（「私は〜」「〜しました」など、話者自身の言葉として整形）
2. フィラー（えーと、あの、まあ、なんか、えー等）を全て除去
3. 音声認識の誤認識を文脈から推測して修正
4. 話題の切り替わりで改行を入れ、読みやすい段落構造にする
5. 冗長な繰り返しのみ除去（内容は絶対に変えない）
6. 適切な句読点を挿入
7. Slack/Teamsにそのまま貼り付けできる形式にする
8. 絵文字は使わない
9. 敬語レベルは原文に合わせる

出力はJSON形式:
{
  "formatted": "整形されたテキスト",
  "changes": ["変更点の簡潔な説明（配列）"]
}`;

export async function POST(req: Request) {
  try {
    const { text, mode, model: requestedModel } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'テキストがありません' }, { status: 400 });
    }

    if (!mode || !['organize', 'summarize', 'chat-reformat'].includes(mode)) {
      return NextResponse.json({ error: 'modeは organize, summarize, chat-reformat のいずれかを指定してください' }, { status: 400 });
    }

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
    const systemPrompt = mode === 'organize' ? ORGANIZE_PROMPT : mode === 'chat-reformat' ? CHAT_REFORMAT_PROMPT : SUMMARIZE_PROMPT;

    // GPT-5.4系のトークン上限（nanoは4000、miniは16000）
    const maxCompletionTokens = model.includes('nano') ? 4000 : 16000;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: maxCompletionTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'AIからの応答がありませんでした' }, { status: 500 });
    }

    const usage = response.usage;
    const tokenUsage = usage
      ? calculateTokenCost(model, usage.prompt_tokens, usage.completion_tokens)
      : null;

    const parsed = JSON.parse(content);

    // AIレスポンスのスキーマ検証
    if (mode === 'organize' || mode === 'chat-reformat') {
      if (typeof parsed.formatted !== 'string' || !Array.isArray(parsed.changes)) {
        return NextResponse.json({ error: 'AIの応答形式が不正です（整理結果にformatted/changesがありません）' }, { status: 500 });
      }
    } else {
      if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.actionItems) || !Array.isArray(parsed.keywords)) {
        return NextResponse.json({ error: 'AIの応答形式が不正です（要約結果にsummary/keyPoints/actionItems/keywordsがありません）' }, { status: 500 });
      }
    }

    return NextResponse.json({ result: parsed, tokenUsage });
  } catch (error: unknown) {
    console.error('Voice format error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'AIの応答を解析できませんでした' }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
