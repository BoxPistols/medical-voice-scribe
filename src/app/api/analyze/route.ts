import { NextResponse } from 'next/server';
import { openai, OpenAIConfigError } from '@/lib/openai';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt';
import type { SoapNote, ModelId, TokenUsage } from './types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './types';
import { validateModel } from '@/lib/helpers';
import { checkAndIncrementRateLimit } from '@/lib/rateLimiter';
import { searchMedicalTerms, buildMedicalContext } from '@/lib/medicalDictionary';

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;

// USD/JPY レート（概算）
const USD_TO_JPY = 150;

// AVAILABLE_MODELSからIDリストを生成
const VALID_MODEL_IDS = AVAILABLE_MODELS.map(m => m.id) as unknown as string[];

// トークンコスト計算
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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストの形式（JSON）が正しくありません' }, { status: 400 });
  }

  try {
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
    }

    const { text, stream: useStream, model: requestedModel } = body as { text?: unknown; stream?: unknown; model?: unknown };

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'テキストがありません' },
        { status: 400 }
      );
    }

    // モデルの検証とフォールバック
    const model = validateModel(typeof requestedModel === 'string' ? requestedModel : undefined, VALID_MODEL_IDS, DEFAULT_MODEL) as ModelId;

    // レート制限チェック
    const rateLimit = checkAndIncrementRateLimit(model);
    if (rateLimit.exceeded) {
      return NextResponse.json(
        { error: `本日の使用回数上限（${rateLimit.limit}回）に達しました。明日また試してください。` },
        { status: 429 }
      );
    }

    // トークン上限（nano は 4000、gpt-5.6-luna 等それ以外は 16000）
    // luna を 4000 にすると推論トークンが上限を食い切り可視出力が空になる（実測）
    const maxCompletionTokens = model.includes('nano') ? 4000 : 16000;

    // セマンティック医療辞書検索（失敗時はフォールバック）
    let medicalContext = "";
    try {
      const queryText = text.slice(0, 1000);
      const embeddingRes = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: queryText,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      const queryEmbedding = embeddingRes.data[0].embedding;
      const searchResults = searchMedicalTerms(queryEmbedding);
      medicalContext = buildMedicalContext(searchResults);
    } catch (e) {
      console.warn("医療辞書検索スキップ:", (e as Error).message);
    }

    const systemPrompt = SYSTEM_PROMPT + medicalContext;

    // ストリーミングモード
    if (useStream) {
      const stream = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: maxCompletionTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let usage: TokenUsage | null = null;
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
              // ストリーム終了時にusage情報が含まれる
              if (chunk.usage) {
                usage = calculateTokenCost(
                  model as ModelId,
                  chunk.usage.prompt_tokens,
                  chunk.usage.completion_tokens
                );
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, usage })}\n\n`));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'ストリーミング中にエラーが発生しました' })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 非ストリーミングモード（従来の動作）
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: maxCompletionTokens,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json(
        { error: 'AI応答が空です' },
        { status: 500 }
      );
    }

    const result: SoapNote = JSON.parse(content);
    return NextResponse.json(result);

  } catch (error) {
    console.error('API Error:', error);

    if (error instanceof OpenAIConfigError) {
      return NextResponse.json(
        { error: 'サーバーにOpenAI APIキーが設定されていません。.env.localにOPENAI_API_KEYを設定してください' },
        { status: 503 }
      );
    }

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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'AI処理に失敗しました' },
      { status: 500 }
    );
  }
}
