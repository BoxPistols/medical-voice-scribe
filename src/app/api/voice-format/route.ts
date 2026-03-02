import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ModelId, TokenUsage } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';

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

const ORGANIZE_PROMPT = `あなたは音声認識テキストを整理するアシスタントです。
入力されたテキストは音声認識で生成されたものです。以下のルールで整理してください：

1. 誤認識と思われる箇所を文脈から推測して修正
2. 句読点・改行を適切に挿入
3. フィラー（えーと、あの、まあ）は除去
4. 話者が複数いる場合は区別して表示
5. 意味が通るように文章を整える（ただし内容は変えない）

出力はJSON形式:
{
  "formatted": "整理されたテキスト",
  "changes": ["変更点の簡潔な説明（配列）"]
}`;

const SUMMARIZE_PROMPT = `あなたは音声認識テキストを要約するアシスタントです。
入力されたテキストの要点をまとめてください：

1. 主要なポイントを箇条書きで抽出
2. 全体の概要を2-3文で記述
3. アクションアイテムがあれば抽出
4. キーワードを抽出

出力はJSON形式:
{
  "summary": "概要（2-3文）",
  "keyPoints": ["要点1", "要点2", ...],
  "actionItems": ["アクション1", ...],
  "keywords": ["キーワード1", ...]
}`;

export async function POST(req: Request) {
  try {
    const { text, mode, model: requestedModel } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'テキストがありません' }, { status: 400 });
    }

    if (!mode || !['organize', 'summarize'].includes(mode)) {
      return NextResponse.json({ error: 'modeは organize または summarize を指定してください' }, { status: 400 });
    }

    const model = requestedModel && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;
    const openai = getOpenAIClient();
    const systemPrompt = mode === 'organize' ? ORGANIZE_PROMPT : SUMMARIZE_PROMPT;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
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
    if (mode === 'organize') {
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
