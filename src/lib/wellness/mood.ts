// 気分ジャーナルの集計・トレンド計算（純粋関数のみ）。
// React / DOM に依存しないため、単体テストや AI コンテキスト生成からも再利用できる。

import type { MoodEntry, Scale5 } from "./types";

/** 1日あたりのミリ秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 気分5段階のメタ情報（顔文字・日本語ラベル・teal系色相） */
export interface MoodLevelMeta {
  value: Scale5;
  emoji: string;
  label: string;
  /** スパークライン / カレンダードットの色相（HSL）。気分が良いほど teal に寄せる。 */
  hue: number;
}

/**
 * 気分レベルの定義。1=とても悪い … 5=とても良い。
 * 色相は赤みがかった暖色(12)から teal(174) へ連続的に変化させ、落ち着いた印象を保つ。
 */
export const MOOD_LEVELS: readonly MoodLevelMeta[] = [
  { value: 1, emoji: "😣", label: "とても悪い", hue: 12 },
  { value: 2, emoji: "😕", label: "悪い", hue: 40 },
  { value: 3, emoji: "😐", label: "ふつう", hue: 130 },
  { value: 4, emoji: "🙂", label: "良い", hue: 162 },
  { value: 5, emoji: "😄", label: "とても良い", hue: 174 },
] as const;

/** 活力5段階の日本語ラベル */
export const ENERGY_LABELS: readonly string[] = ["かなり低い", "低い", "ふつう", "高い", "かなり高い"] as const;

/** 文脈タグの候補（複数選択可） */
export const CONTEXT_TAGS: readonly string[] = [
  "仕事",
  "睡眠",
  "運動",
  "人間関係",
  "食事",
  "体調",
  "達成感",
  "不安",
  "リラックス",
  "天気",
] as const;

/** 指定値の気分メタを取得（範囲外は「ふつう」相当にフォールバック） */
export function getMoodMeta(value: number): MoodLevelMeta {
  return MOOD_LEVELS.find((m) => m.value === value) ?? MOOD_LEVELS[2];
}

/**
 * 気分値に対応する HSL 色文字列を返す。
 * @param value 1-5 の気分値
 * @param lightness 明度（%）。ライト/ダーク調整用。
 */
export function moodColor(value: number, lightness = 48): string {
  const { hue } = getMoodMeta(value);
  return `hsl(${hue} 62% ${lightness}%)`;
}

/** エントリ配列を新しい順（timestamp 降順）に並べた新配列を返す。 */
export function sortByNewest(entries: readonly MoodEntry[]): MoodEntry[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}

/** epoch ms をローカル日付キー（YYYY-MM-DD）に変換。 */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 直近 `windowMs` 以内のエントリを抽出（now を基準）。未来タイムスタンプは集計を汚染するため除外。 */
export function withinWindow(entries: readonly MoodEntry[], windowMs: number, now: number = Date.now()): MoodEntry[] {
  const threshold = now - windowMs;
  return entries.filter((e) => e.timestamp >= threshold && e.timestamp <= now);
}

/** 直近N日(デフォルト7)の平均気分。対象が無ければ null。小数第1位に丸める。 */
export function averageMood(entries: readonly MoodEntry[], days = 7, now: number = Date.now()): number | null {
  const recent = withinWindow(entries, days * DAY_MS, now);
  if (recent.length === 0) return null;
  const sum = recent.reduce((acc, e) => acc + e.mood, 0);
  return Math.round((sum / recent.length) * 10) / 10;
}

/**
 * 連続記録日数（streak）を計算。
 * 今日または昨日に記録があれば、そこから過去へ連続して記録のある日数を数える。
 * 今日も昨日も記録が無ければ 0。
 */
export function recordStreak(entries: readonly MoodEntry[], now: number = Date.now()): number {
  if (entries.length === 0) return 0;
  const daySet = new Set(entries.map((e) => dayKey(e.timestamp)));

  // 昨日キーはローカルカレンダー基準で算出（固定24h減算は DST 境界で日付がずれるため）
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(yesterday.getTime());

  // 起点: 今日に記録があれば今日、無ければ昨日（昨日にも無ければ streak は途切れている）
  let cursor: number;
  if (daySet.has(todayKey)) {
    cursor = now;
  } else if (daySet.has(yesterdayKey)) {
    cursor = yesterday.getTime();
  } else {
    return 0;
  }

  let streak = 0;
  while (daySet.has(dayKey(cursor))) {
    streak += 1;
    // 1日戻すのはローカルカレンダー基準（DST 境界での日跨ぎドリフト防止）
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = d.getTime();
  }
  return streak;
}

/** 直近14日トレンドの1日分 */
export interface DayTrendPoint {
  /** 0=最も古い … (count-1)=今日 の順 */
  date: number;
  dayKey: string;
  /** 月/日 表示用ラベル */
  label: string;
  /** その日の平均気分（記録が無ければ null） */
  avgMood: number | null;
  /** その日の記録件数 */
  count: number;
}

/**
 * 直近 `days` 日（デフォルト14）の日別トレンドを古い順で返す。
 * 記録の無い日も穴埋めして含める（カレンダー/スパークラインの連続性のため）。
 */
export function buildTrend(entries: readonly MoodEntry[], days = 14, now: number = Date.now()): DayTrendPoint[] {
  // 日付キーごとに気分を集約（未来タイムスタンプはトレンドを汚染するため除外）
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    if (e.timestamp > now) continue;
    const key = dayKey(e.timestamp);
    const bucket = byDay.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += e.mood;
    bucket.count += 1;
    byDay.set(key, bucket);
  }

  const points: DayTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // 各日の起点は今日0時から setDate で算出（固定 i*DAY_MS は DST 境界で日抜けするため）
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const ts = d.getTime();
    const key = dayKey(ts);
    const bucket = byDay.get(key);
    points.push({
      date: ts,
      dayKey: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      avgMood: bucket ? Math.round((bucket.sum / bucket.count) * 10) / 10 : null,
      count: bucket ? bucket.count : 0,
    });
  }
  return points;
}

/**
 * 著しく気分が低い記録が連続しているかの簡易判定。
 * 直近 `lookback` 件のうち mood<=2 が `threshold` 件以上なら true。
 * 専門窓口案内をやさしく出す UI 判断に使う（医療診断ではない）。
 */
export function hasPersistentLowMood(entries: readonly MoodEntry[], lookback = 5, threshold = 3): boolean {
  const recent = sortByNewest(entries).slice(0, lookback);
  if (recent.length < threshold) return false;
  const lowCount = recent.filter((e) => e.mood <= 2).length;
  return lowCount >= threshold;
}
