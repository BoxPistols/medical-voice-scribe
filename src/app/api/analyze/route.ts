import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt';
import type { SoapNote } from './types';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY環境変数が設定されていません');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'テキストがありません' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
