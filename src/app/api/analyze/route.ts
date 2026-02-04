import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt';
import type { SoapNote, ModelId, TokenUsage } from './types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './types';

// USD/JPY レート（概算）
const USD_TO_JPY = 150;

// モデルIDの検証
function isValidModel(model: string): model is ModelId {
  return AVAILABLE_MODELS.some(m => m.id === model);
}

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
    const { text, stream: useStream, model: requestedModel } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'テキストがありません' },
        { status: 400 }
      );
    }

    // モデルの検証とフォールバック
    const model = requestedModel && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const openai = getOpenAIClient();

    // ストリーミングモード
    if (useStream) {
      const stream = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
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
