import { NextResponse } from 'next/server';
import { openai, OpenAIConfigError, OPENAI_CONFIG_ERROR_MESSAGE } from '@/lib/openai';
import OpenAI from 'openai';
import type { ModelId, TokenUsage } from '../analyze/types';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../analyze/types';
import { buildChatTuning, parseModelJson } from '@/lib/openaiChat';
import type { MoodEntry } from '@/lib/wellness/types';

const USD_TO_JPY = 150;

// 入力検証の上限
const MAX_ENTRIES = 14;
const MAX_NOTE_LENGTH = 1000;
const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 20;

// 気分5段階の日本語ラベル（プロンプト整形用）
const MOOD_LABELS: Record<number, string> = {
  1: 'とても悪い',
  2: '悪い',
  3: 'ふつう',
  4: '良い',
  5: 'とても良い',
};

const SYSTEM_PROMPT = `あなたは「あたたかいウェルネスの伴走者」です。利用者の最近の気分ログにそっと寄り添い、穏やかな言葉でふりかえりを返します。

## あなたの立場（重要）
- あなたはセラピストでも医師でもありません。**診断・治療・医療行為は一切行いません。**
- 病名・症状名の断定、薬や治療の指示は禁止です。
- 利用者を評価・採点したり、「こうあるべき」と説教したりしません。

## ふりかえりの流れ
1. **共感**: まず利用者の気持ちや状況に静かに寄り添う（1-2文）。
2. **気づき**: ログから読み取れる小さなパターンや変化をやさしく言葉にする（断定せず「〜かもしれませんね」のトーン）。
3. **小さな提案**: 今日から無理なく試せるやさしい提案を1〜2件。

## 危機兆候への配慮
- 自傷・自殺念慮、「消えたい」「いなくなりたい」等の深い苦しさが読み取れる場合、または気分が著しく低い記録が続く場合は、
  crisisHint に専門家・相談窓口への相談をやさしく促す一文を入れてください。
- 一般的な案内（例: 「よりそいホットライン 0120-279-338」「いのちの電話」「地域の精神保健福祉センター」「かかりつけ医や信頼できる人への相談」）を、押し付けずに添えてください。
- 危機兆候が無ければ crisisHint は省略してください。

## トーン・形式
- 日本語。やわらかく、短く、温度のある言葉で。専門用語や英語は避ける。
- 出力は必ず次のJSON形式のみ:
{
  "reflection": "共感から気づきまでの短いふりかえり（2〜4文程度の日本語）",
  "suggestions": ["やさしい提案1", "やさしい提案2"],
  "crisisHint": "（任意）危機兆候があれば相談窓口へのやさしい案内"
}
- suggestions は1〜2件。crisisHint は必要なときだけ含める。
- これは医療・診断ではないことを忘れず、利用者の主体性を尊重した言葉を選んでください。`;

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

/** 入力エントリの最小限の構造検証（unknown を安全に narrow する） */
function isValidEntry(value: unknown): value is MoodEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  if (typeof e.mood !== 'number' || e.mood < 1 || e.mood > 5) return false;
  if (typeof e.timestamp !== 'number') return false;
  if (e.tags !== undefined && !Array.isArray(e.tags)) return false;
  if (e.note !== undefined && typeof e.note !== 'string') return false;
  if (e.energy !== undefined && (typeof e.energy !== 'number' || e.energy < 1 || e.energy > 5)) return false;
  return true;
}

/** 最近のログを LLM 向けの読みやすいテキストに整形（新しい順） */
function formatEntriesForPrompt(entries: MoodEntry[]): string {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const lines = sorted.map((e, i) => {
    const date = new Date(e.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
    const moodStr = `気分: ${MOOD_LABELS[e.mood] ?? e.mood}(${e.mood}/5)`;
    const energyStr = typeof e.energy === 'number' ? ` / 活力: ${e.energy}/5` : '';
    const tags = Array.isArray(e.tags) && e.tags.length > 0 ? ` / タグ: ${e.tags.join('、')}` : '';
    const note = typeof e.note === 'string' && e.note.trim().length > 0 ? ` / メモ: ${e.note.trim()}` : '';
    return `${i + 1}. [${dateStr}] ${moodStr}${energyStr}${tags}${note}`;
  });
  return lines.join('\n');
}

interface ReflectResult {
  reflection: string;
  suggestions: string[];
  crisisHint?: string;
}

/** パース済みオブジェクトを ReflectResult として検証し、安全に整形して返す。不正なら null。 */
function validateResult(parsed: unknown): ReflectResult | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  if (typeof p.reflection !== 'string' || p.reflection.trim().length === 0) return null;
  if (!Array.isArray(p.suggestions)) return null;

  const suggestions = p.suggestions
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 4);

  const result: ReflectResult = {
    reflection: p.reflection.trim(),
    suggestions,
  };

  if (typeof p.crisisHint === 'string' && p.crisisHint.trim().length > 0) {
    result.crisisHint = p.crisisHint.trim();
  }

  return result;
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

    const { entries, model: requestedModel } = body as { entries?: unknown; model?: unknown };

    // ── 入力検証 ───────────────────────────────────────────────
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: '気分の記録がありません。まず記録してからお試しください' }, { status: 400 });
    }

    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json({ error: `記録が多すぎます（最大${MAX_ENTRIES}件）` }, { status: 400 });
    }

    const validEntries: MoodEntry[] = [];
    for (const raw of entries) {
      if (!isValidEntry(raw)) {
        return NextResponse.json({ error: '記録の形式が不正です' }, { status: 400 });
      }
      if (typeof raw.note === 'string' && raw.note.length > MAX_NOTE_LENGTH) {
        return NextResponse.json({ error: `メモが長すぎます（最大${MAX_NOTE_LENGTH}文字）` }, { status: 400 });
      }
      if (Array.isArray(raw.tags)) {
        if (raw.tags.length > MAX_TAGS) {
          return NextResponse.json({ error: 'タグが多すぎます' }, { status: 400 });
        }
        const badTag = raw.tags.find((t) => typeof t !== 'string' || t.length > MAX_TAG_LENGTH);
        if (badTag !== undefined) {
          return NextResponse.json({ error: 'タグの形式が不正です' }, { status: 400 });
        }
      }
      validEntries.push(raw);
    }

    // ── モデル検証 ─────────────────────────────────────────────
    const model =
      typeof requestedModel === 'string' && isValidModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const userContent = `最近の気分ログ（新しい順）:\n${formatEntriesForPrompt(validEntries)}\n\n上記をふまえて、あたたかくふりかえってください。`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      // GPT-5系は temperature非対応・max_completion_tokens必須のためモデル系統に応じて付与
      ...buildChatTuning(model, { temperature: 0.8, maxTokens: 800 }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'AIからの応答がありませんでした' }, { status: 500 });
    }

    const usage = response.usage;
    const tokenUsage = usage ? calculateTokenCost(model, usage.prompt_tokens, usage.completion_tokens) : null;

    const parsed = parseModelJson(content);
    const result = validateResult(parsed);

    if (!result) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です（reflection / suggestions が取得できませんでした）' },
        { status: 500 },
      );
    }

    return NextResponse.json({ result, model, tokenUsage });
  } catch (error: unknown) {
    if (error instanceof OpenAIConfigError) {
      return NextResponse.json({ error: OPENAI_CONFIG_ERROR_MESSAGE }, { status: 503 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'AIの応答を解析できませんでした' }, { status: 500 });
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'OpenAI APIキーが無効です' }, { status: 500 });
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'APIレート制限に達しました。しばらく待ってから再試行してください' },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: `OpenAI APIエラー: ${error.message}` }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
