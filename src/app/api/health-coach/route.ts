import { NextResponse } from "next/server";
import { openai, OpenAIConfigError, OPENAI_CONFIG_ERROR_MESSAGE } from '@/lib/openai';
import OpenAI from "openai";
import type { ModelId } from "../analyze/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../analyze/types";
import { buildChatTuning } from "@/lib/openaiChat";

// AIヘルスコーチ用システムプロンプト
// からだ・こころ・生活習慣を横断するホリスティックなウェルネスコーチ。
// 医師ではなく、診断・処方は行わない。支持的・具体的・実行可能な提案に徹する。
const HEALTH_COACH_PROMPT = `あなたは「からだ・こころ・生活習慣」を横断的に見るホリスティックなウェルネスコーチです。

## あなたの役割
- ユーザーが心身ともに健やかに過ごせるよう、寄り添いながら伴走します。
- 睡眠・運動・食事・ストレス・気分・人間関係など、生活全体の視点でサポートします。
- ユーザーの記録（気分ログ・症状チェック・呼吸/運動セッション）を踏まえて、今のその人に合った提案をします。

## 応答ルール
- 必ず日本語で、落ち着いた支持的なトーンで応答してください。
- まず相手の状態や気持ちを受け止め（共感）、そのうえで提案を述べてください。
- 提案は「具体的で・実行可能で・小さな一歩」にしてください（例: 「今夜は就寝1時間前にスマホを別室に置く」など）。
- 一度に詰め込みすぎず、最重要の1〜3点に絞ってください。
- 箇条書きや短い段落を使い、読みやすく簡潔にまとめてください。

## 重要：あなたは医師ではありません
- あなたは医療機器ではなく、診断・治療・処方を行うものではありません。
- 病名の断定、薬の処方・増減の指示、検査結果の解釈はしないでください。
- 受診の判断が必要そうな場合は「医療機関への相談」を一般的な形で勧めてください。

## 危機兆候への対応
- 自傷・自殺の意図、強い絶望、他者を傷つけたい等の危機兆候が読み取れる場合は、まず安全を最優先に気遣い、
  日本の相談窓口（例: いのちの電話、こころの健康相談統一ダイヤル 0570-064-556、緊急時は119/110）への連絡を、
  落ち着いた口調で具体的に案内してください。決して突き放さず、一人で抱えなくてよいことを伝えてください。

## 出力の最後
- 必要に応じて「これは医療上の診断ではなく、一般的なセルフケアの情報です」という趣旨を、押し付けがましくない範囲で添えてください。`;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CONTENT = 1000;
const MAX_CONTEXT_LENGTH = 2000;

type CoachResponseType = "normal" | "warning" | "recommendation";

interface HistoryItem {
  role: "user" | "assistant";
  content: string;
}

// モデルIDの検証
function isValidModel(model: unknown): model is ModelId {
  return typeof model === "string" && AVAILABLE_MODELS.some((m) => m.id === model);
}

// 会話履歴を検証して直近 MAX_HISTORY_ITEMS 件に整形
function sanitizeHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const validRoles = new Set(["user", "assistant"]);
  return raw
    .filter(
      (m): m is HistoryItem =>
        !!m &&
        typeof m === "object" &&
        typeof (m as { role?: unknown }).role === "string" &&
        validRoles.has((m as { role: string }).role) &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_HISTORY_CONTENT),
    }));
}

// 応答内容からタイプを判定（警告 / 推奨 / 通常）
function classifyResponse(content: string): CoachResponseType {
  if (
    content.includes("いのちの電話") ||
    content.includes("緊急") ||
    content.includes("119") ||
    content.includes("110") ||
    content.includes("相談窓口") ||
    content.includes("受診")
  ) {
    return "warning";
  }
  if (
    content.includes("おすすめ") ||
    content.includes("提案") ||
    content.includes("試して") ||
    content.includes("一歩") ||
    content.includes("みましょう")
  ) {
    return "recommendation";
  }
  return "normal";
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式（JSON）が正しくありません" }, { status: 400 });
  }

  try {
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
    }

    const {
      message,
      conversationHistory,
      wellnessContext,
      model: requestedModel,
    } = body as {
      message?: unknown;
      conversationHistory?: unknown;
      wellnessContext?: unknown;
      model?: unknown;
    };

    // 入力検証
    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "メッセージが無効です" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `メッセージが長すぎます（最大${MAX_MESSAGE_LENGTH}文字）` },
        { status: 400 },
      );
    }
    if (
      wellnessContext !== undefined &&
      (typeof wellnessContext !== "string" || wellnessContext.length > MAX_CONTEXT_LENGTH)
    ) {
      return NextResponse.json(
        { error: "コンテキスト情報が無効です" },
        { status: 400 },
      );
    }

    const model: ModelId = isValidModel(requestedModel) ? (requestedModel as ModelId) : DEFAULT_MODEL;
    const history = sanitizeHistory(conversationHistory);

    const contextData =
      typeof wellnessContext === "string" && wellnessContext.trim().length > 0
        ? `## ユーザーの最近の記録（参考。診断には使わないこと）\n${wellnessContext.trim()}`
        : "## ユーザーの最近の記録\n（記録はまだありません）";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: HEALTH_COACH_PROMPT },
        { role: "user", content: `[Context Data]\n${contextData}` },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
      // GPT-5系は temperature非対応・max_completion_tokens必須のためモデル系統に応じて付与
      ...buildChatTuning(model, { temperature: 0.7, maxTokens: 800 }),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI応答が空です" }, { status: 500 });
    }

    return NextResponse.json({
      response: content,
      type: classifyResponse(content),
    });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return NextResponse.json({ error: OPENAI_CONFIG_ERROR_MESSAGE }, { status: 503 });
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: "OpenAI APIキーが無効です" },
          { status: 500 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "APIレート制限に達しました。しばらく待ってから再試行してください" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `OpenAI APIエラー: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "コーチとの会話処理に失敗しました" },
      { status: 500 },
    );
  }
}
