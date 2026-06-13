import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ModelId, TokenUsage } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';
import { buildChatTuning, parseModelJson } from '@/lib/openaiChat';
import type { SymptomResult, SymptomUrgency } from '@/lib/wellness/types';

// ── 定数 ──────────────────────────────────────────────────────────────────

const USD_TO_JPY = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FIELD_LENGTH = 80;

/** 緊急度の許容値（パース後の厳密検証に使用） */
const URGENCY_VALUES: readonly SymptomUrgency[] = ['emergency', 'see-doctor', 'monitor', 'self-care'];

// ── ユーティリティ ────────────────────────────────────────────────────────

function isValidModel(model: string): model is ModelId {
  return AVAILABLE_MODELS.some((m) => m.id === model);
}

function calculateTokenCost(modelId: ModelId, promptTokens: number, completionTokens: number): TokenUsage {
  const modelConfig = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!modelConfig) {
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUSD: 0,
      estimatedCostJPY: 0,
    };
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

// ── システムプロンプト（保守的トリアージ補助・診断ではない） ────────────────

const SYSTEM_PROMPT = `あなたは一般市民向けの「症状トリアージ補助」アシスタントです。日本国内の利用者を想定し、必ず日本語で回答します。

## 最重要の前提（厳守）
- あなたは医療機器ではなく、医師ではありません。診断・治療は行いません。提示するのはあくまで「参考情報」です。
- 不確かなとき、迷ったときは必ず「安全側（受診を勧める方向）」に倒してください。過小評価は厳禁です。
- 最終的な判断は必ず医療機関・医療従事者に委ねるよう、利用者に伝えてください。

## レッドフラグ（検出したら urgency を必ず "emergency" にする）
以下のいずれかが疑われる記述があれば、迷わず "emergency" とし、redFlags に明記し、summary とselfCare で「ただちに119番通報・救急受診」を促してください。
- 突然の激しい胸痛・締め付け、特に呼吸困難・冷汗・左腕や顎への放散を伴うもの（急性冠症候群の疑い）
- 突然の呼吸困難、唇や顔色が青い、ゼーゼーして話せない
- 脳卒中を疑う FAST 所見：顔のゆがみ、片側の腕の脱力、ろれつが回らない、突然の激しい頭痛、視野・言語の異常
- アナフィラキシー：全身のじんましん＋顔や喉の腫れ＋呼吸困難・血圧低下、食物・薬・蜂刺され後の急激な悪化
- 止まらない大量出血、吐血・下血が大量、意識がもうろうとする
- けいれんが続く、意識消失、応答がない
- 自殺念慮・自傷の意思・「死にたい」等の訴え → emergency とし、いのちの電話（0570-783-556）やこころの健康相談統一ダイヤル（0570-064-556）等の相談窓口を selfCare に必ず案内する
- 激しい腹痛＋板のように硬い腹、妊娠中の出血・激痛、高熱＋意識障害、なども emergency 寄りに評価する

## 緊急度（urgency）の区分
- "emergency"：ただちに救急受診・119番。命に関わる可能性。
- "see-doctor"：早めに（当日〜数日内に）医療機関を受診すべき。
- "monitor"：自宅で経過観察しつつ、悪化や新たな症状があれば受診。
- "self-care"：セルフケアで様子を見てよい軽度の状態。

## 出力フォーマット（JSONオブジェクトのみ・追加テキスト禁止）
{
  "urgency": "emergency" | "see-doctor" | "monitor" | "self-care",
  "summary": "全体所見の要約（1〜2文・落ち着いた口調・断定的な診断名で締めない）",
  "considerations": [ { "name": "考えられる可能性の名称", "rationale": "なぜその可能性を挙げるかの簡潔な根拠（診断ではない旨を含意）" } ],
  "redFlags": [ "これがあれば至急受診すべき具体的な危険サイン" ],
  "selfCare": [ "自宅でできる対処・受診の目安・相談窓口など" ],
  "disclaimer": "この結果は医療機器による診断ではなく参考情報です。症状や不安がある場合は必ず医療機関にご相談ください。"
}

## 文体・内容のルール
- considerations は最大4件、断定を避け「〜の可能性」「〜が考えられます」と表現する。診断名の確定はしない。
- redFlags と selfCare はそれぞれ最大6件、具体的で実行可能な短文にする。
- emergency のときは selfCare の先頭で「ただちに119番通報・救急要請」を明示する。
- 過度に不安をあおらず、しかし危険を過小評価しない、落ち着いた実用的なトーンを保つ。
- 必ず有効なJSONのみを出力し、コードフェンスや説明文を付けない。`;

// ── 入力からユーザープロンプトを構築 ──────────────────────────────────────

function buildUserPrompt(input: {
  description: string;
  bodyPart?: string;
  duration?: string;
  severity?: number;
}): string {
  const lines: string[] = [];
  lines.push('以下の症状について、上記ルールに従いトリアージ補助情報をJSONで出力してください。');
  lines.push('');
  lines.push(`【症状の説明】\n${input.description}`);
  if (input.bodyPart) lines.push(`【主な部位】${input.bodyPart}`);
  if (input.duration) lines.push(`【続いている期間】${input.duration}`);
  if (typeof input.severity === 'number') {
    lines.push(`【本人が感じる重症度】5段階中 ${input.severity}（1=軽い／5=とてもつらい）`);
  }
  return lines.join('\n');
}

// ── パース結果の厳密検証 ──────────────────────────────────────────────────

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isConsiderations(value: unknown): value is { name: string; rationale: string }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v !== null &&
        typeof v === 'object' &&
        typeof (v as { name?: unknown }).name === 'string' &&
        typeof (v as { rationale?: unknown }).rationale === 'string'
    )
  );
}

/** LLM 出力を SymptomResult として厳密検証。不正なら null を返す。 */
function validateSymptomResult(parsed: unknown): SymptomResult | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.urgency !== 'string' || !URGENCY_VALUES.includes(obj.urgency as SymptomUrgency)) {
    return null;
  }
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) return null;
  if (!isConsiderations(obj.considerations)) return null;
  if (!isStringArray(obj.redFlags)) return null;
  if (!isStringArray(obj.selfCare)) return null;
  if (typeof obj.disclaimer !== 'string' || obj.disclaimer.trim().length === 0) return null;

  return {
    urgency: obj.urgency as SymptomUrgency,
    summary: obj.summary,
    considerations: obj.considerations,
    redFlags: obj.redFlags,
    selfCare: obj.selfCare,
    disclaimer: obj.disclaimer,
  };
}

// ── ハンドラ ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (body === null || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 });
    }
    const { description, bodyPart, duration, severity, model: requestedModel } = body as Record<string, unknown>;

    // 入力検証
    if (typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: '症状の説明を入力してください' }, { status: 400 });
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `症状の説明が長すぎます（最大${MAX_DESCRIPTION_LENGTH}文字）` },
        { status: 400 }
      );
    }
    if (bodyPart !== undefined && (typeof bodyPart !== 'string' || bodyPart.length > MAX_FIELD_LENGTH)) {
      return NextResponse.json({ error: '部位の指定が不正です' }, { status: 400 });
    }
    if (duration !== undefined && (typeof duration !== 'string' || duration.length > MAX_FIELD_LENGTH)) {
      return NextResponse.json({ error: '期間の指定が不正です' }, { status: 400 });
    }
    let severityNum: number | undefined;
    if (severity !== undefined) {
      if (typeof severity !== 'number' || !Number.isFinite(severity) || severity < 1 || severity > 5) {
        return NextResponse.json({ error: '重症度は1〜5で指定してください' }, { status: 400 });
      }
      severityNum = Math.round(severity);
    }

    const model: ModelId =
      typeof requestedModel === 'string' && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const openai = getOpenAIClient();

    const userPrompt = buildUserPrompt({
      description,
      bodyPart: typeof bodyPart === 'string' ? bodyPart : undefined,
      duration: typeof duration === 'string' ? duration : undefined,
      severity: severityNum,
    });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      // GPT-5系は temperature非対応・max_completion_tokens必須。複雑スキーマ+reasoning消費を見込み上限は大きめ(8000)
      ...buildChatTuning(model, { temperature: 0.3, maxTokens: 8000 }),
    });

    const content = response.choices[0]?.message?.content;

    let parsed: unknown;
    try {
      // 空応答・コードフェンス・前後散文に耐える頑健パース
      parsed = parseModelJson(content);
    } catch {
      return NextResponse.json({ error: 'AIの応答を解析できませんでした（空または不正な形式）。軽量モデルに切り替えるか、もう一度お試しください。' }, { status: 500 });
    }

    const result = validateSymptomResult(parsed);
    if (!result) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です（トリアージ結果のスキーマ検証に失敗しました）' },
        { status: 500 }
      );
    }

    const usage = response.usage;
    const tokenUsage = usage ? calculateTokenCost(model, usage.prompt_tokens, usage.completion_tokens) : null;

    return NextResponse.json({ result, tokenUsage });
  } catch (error: unknown) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'OpenAI APIキーが無効です' }, { status: 500 });
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'APIレート制限に達しました。しばらく待ってから再試行してください' },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: `OpenAI APIエラー: ${error.message}` }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : '症状チェックの処理に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
