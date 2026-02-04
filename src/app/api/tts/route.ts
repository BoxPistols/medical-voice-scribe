import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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
    const { text, voice = 'alloy' } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'テキストがありません' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      { error: '音声生成に失敗しました' },
      { status: 500 }
    );
  }
}
