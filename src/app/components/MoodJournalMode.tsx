"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HeartIcon,
  SparklesIcon,
  TrashIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  getMoodEntries,
  addMoodEntry,
  setMoodEntries,
  subscribeStore,
  newId,
  STORAGE_KEYS,
} from "@/lib/wellness/storage";
import type { MoodEntry, Scale5 } from "@/lib/wellness/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/app/api/analyze/types";
import type { ModelId, TokenUsage } from "@/app/api/analyze/types";
import {
  MOOD_LEVELS,
  ENERGY_LABELS,
  CONTEXT_TAGS,
  getMoodMeta,
  moodColor,
  sortByNewest,
  averageMood,
  recordStreak,
  buildTrend,
  hasPersistentLowMood,
  type DayTrendPoint,
} from "@/lib/wellness/mood";

// ── 定数 ────────────────────────────────────────────────────────────
const NOTE_MAX = 280;
const REFLECT_ENTRY_LIMIT = 14;
const TREND_DAYS = 14;

interface ReflectResult {
  reflection: string;
  suggestions: string[];
  crisisHint?: string;
}

interface ReflectResponse {
  result?: ReflectResult;
  model?: string;
  tokenUsage?: TokenUsage | null;
  error?: string;
}

// 一般的な相談窓口（医療・診断ではない案内）
const SUPPORT_LINES: readonly { name: string; detail: string }[] = [
  { name: "よりそいホットライン", detail: "0120-279-338（24時間・無料）" },
  { name: "いのちの電話", detail: "0570-783-556（10時〜22時）" },
  { name: "地域の精神保健福祉センター", detail: "お住まいの自治体の窓口" },
];

// ── 日時フォーマット（クライアントのみで実行：SSR では呼ばない） ──
function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

// ── スパークライン（チャートライブラリ不使用の自前 SVG） ──
function MoodSparkline({ points }: { points: DayTrendPoint[] }) {
  const width = 100;
  const height = 32;
  const padX = 2;
  const innerW = width - padX * 2;

  // 値のある点だけで折れ線を描く（無い日は途切れさせる）
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? padX + (i / (points.length - 1)) * innerW : width / 2;
    // mood 1..5 を 下(height-2)..上(2) にマップ
    const y = p.avgMood == null ? null : height - 2 - ((p.avgMood - 1) / 4) * (height - 4);
    return { x, y, p };
  });

  // 連続する非null区間ごとに polyline を分割
  const segments: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const c of coords) {
    if (c.y == null) {
      if (cur.length > 0) segments.push(cur);
      cur = [];
    } else {
      cur.push({ x: c.x, y: c.y });
    }
  }
  if (cur.length > 0) segments.push(cur);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12"
      preserveAspectRatio="none"
      role="img"
      aria-label="直近14日間の気分の推移グラフ"
    >
      {segments.map((seg, si) =>
        seg.length === 1 ? null : (
          <polyline
            key={si}
            points={seg.map((s) => `${s.x},${s.y}`).join("")}
            fill="none"
            stroke="#14b8a6"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
      {coords.map((c, i) =>
        c.y == null ? null : (
          <circle key={i} cx={c.x} cy={c.y} r={1.8} fill={moodColor(c.p.avgMood ?? 3, 50)} vectorEffect="non-scaling-stroke" />
        ),
      )}
    </svg>
  );
}

// ── 色付きドットカレンダー ──
function MoodDotCalendar({ points }: { points: DayTrendPoint[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="日別の気分カレンダー">
      {points.map((p) => {
        const has = p.avgMood != null;
        return (
          <div
            key={p.dayKey}
            role="listitem"
            className="flex flex-col items-center gap-0.5"
            title={
              has
                ? `${p.label}：平均 ${p.avgMood}（${p.count}件）`
                : `${p.label}：記録なし`
            }
          >
            <span
              className="block w-5 h-5 rounded-full border border-theme-light"
              style={{
                backgroundColor: has ? moodColor(p.avgMood as number, 52) : "transparent",
              }}
              aria-hidden="true"
            />
            <span className="text-[9px] leading-none text-theme-muted tabular-nums">{p.label.split("/")[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── メインコンポーネント ──
export default function MoodJournalMode() {
  // データ（SSR 安全：初期は空、useEffect で読込）
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // フォーム状態
  const [mood, setMood] = useState<Scale5 | null>(null);
  const [energy, setEnergy] = useState<Scale5 | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // AI ふりかえり状態
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [reflecting, setReflecting] = useState(false);
  const [reflectResult, setReflectResult] = useState<ReflectResult | null>(null);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // 表示切替（スパークライン / カレンダー）
  const [trendView, setTrendView] = useState<"spark" | "calendar">("spark");

  const savedTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 初回読込 + ストア購読
  useEffect(() => {
    setEntries(getMoodEntries());
    setHydrated(true);
    const unsubscribe = subscribeStore((key) => {
      if (key === STORAGE_KEYS.mood) {
        setEntries(getMoodEntries());
      }
    });
    return unsubscribe;
  }, []);

  // クリーンアップ（タイマー / 進行中フェッチ）
  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // 派生統計
  const sorted = useMemo(() => sortByNewest(entries), [entries]);
  const avg7 = useMemo(() => averageMood(entries, 7), [entries]);
  const streak = useMemo(() => recordStreak(entries), [entries]);
  const trend = useMemo(() => buildTrend(entries, TREND_DAYS), [entries]);
  const showCrisisCard = useMemo(() => hasPersistentLowMood(entries), [entries]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const resetForm = useCallback(() => {
    setMood(null);
    setEnergy(null);
    setSelectedTags([]);
    setNote("");
  }, []);

  const handleSave = useCallback(() => {
    if (mood == null) return;
    const entry: MoodEntry = {
      id: newId(),
      timestamp: Date.now(),
      mood,
      ...(energy != null ? { energy } : {}),
      tags: selectedTags,
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
    };
    const next = addMoodEntry(entry);
    setEntries(next);
    resetForm();

    setJustSaved(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2200);
  }, [mood, energy, selectedTags, note, resetForm]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = sortByNewest(entries).filter((e) => e.id !== id);
      setMoodEntries(next);
      setEntries(next);
    },
    [entries],
  );

  const handleReflect = useCallback(async () => {
    if (sorted.length === 0) return;
    setReflecting(true);
    setReflectError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const payload = sorted.slice(0, REFLECT_ENTRY_LIMIT);

    try {
      const res = await fetch("/api/wellness-reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload, model }),
        signal: controller.signal,
      });
      const data: ReflectResponse = await res.json();
      if (!res.ok || !data.result) {
        setReflectError(data.error ?? "ふりかえりの生成に失敗しました");
        setReflectResult(null);
        setTokenUsage(null);
        return;
      }
      setReflectResult(data.result);
      setTokenUsage(data.tokenUsage ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setReflectError("通信に失敗しました。時間をおいて再度お試しください");
      setReflectResult(null);
    } finally {
      if (abortRef.current === controller) {
        setReflecting(false);
        abortRef.current = null;
      }
    }
  }, [sorted, model]);

  const canSave = mood != null;

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 sm:py-8">
      <style>{`
        @keyframes mj-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .mj-fade-up { animation: mj-fade-up 0.4s cubic-bezier(0.4,0,0.2,1) both; }
        .mj-saved-pop { animation: mj-fade-up 0.3s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .mj-fade-up, .mj-saved-pop { animation: none !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HeartIcon className="w-6 h-6 text-theme-accent" strokeWidth={2} aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">気分ジャーナル</h1>
        </div>
        <p className="text-sm text-theme-tertiary">
          今のこころの状態をやさしく記録して、自分のペースをふりかえりましょう。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
        {/* ── チェックインカード ── */}
        <section
          aria-labelledby="mj-checkin-heading"
          className="bg-theme-card rounded-2xl border border-theme-light shadow-sm p-5 sm:p-6"
        >
          <h2 id="mj-checkin-heading" className="text-base font-semibold text-theme-primary mb-4">
            いまの気分は？
          </h2>

          {/* 気分5段階 */}
          <div role="radiogroup" aria-label="気分を5段階で選択" className="flex justify-between gap-1.5 sm:gap-2 mb-5">
            {MOOD_LEVELS.map((lv) => {
              const active = mood === lv.value;
              return (
                <button
                  key={lv.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${lv.label}（${lv.value}点）`}
                  onClick={() => setMood(lv.value)}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                    active
                      ? "border-brand bg-theme-highlight scale-105 shadow-sm"
                      : "border-theme-light bg-theme-surface hover:border-theme-medium hover:bg-theme-card"
                  }`}
                  style={active ? { borderColor: moodColor(lv.value, 50) } : undefined}
                >
                  <span className={`text-2xl sm:text-3xl transition-transform ${active ? "scale-110" : ""}`} aria-hidden="true">
                    {lv.emoji}
                  </span>
                  <span className={`text-[10px] sm:text-xs leading-tight ${active ? "text-theme-primary font-semibold" : "text-theme-tertiary"}`}>
                    {lv.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 活力（任意） */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-theme-secondary">活力（任意）</span>
              {energy != null && (
                <button
                  type="button"
                  onClick={() => setEnergy(null)}
                  className="text-xs text-theme-muted hover:text-theme-accent transition-colors"
                >
                  クリア
                </button>
              )}
            </div>
            <div role="radiogroup" aria-label="活力を5段階で選択（任意）" className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as Scale5[]).map((v) => {
                const active = energy === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`活力 ${ENERGY_LABELS[v - 1]}`}
                    onClick={() => setEnergy(v)}
                    className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-brand text-white border-brand shadow-sm"
                        : "bg-theme-surface text-theme-tertiary border-theme-light hover:bg-theme-card"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 文脈タグ */}
          <div className="mb-5">
            <span className="block text-sm font-medium text-theme-secondary mb-2">きっかけ・文脈（任意・複数可）</span>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-brand text-white border-brand shadow-sm"
                        : "bg-theme-surface text-theme-secondary border-theme-light hover:border-theme-medium hover:bg-theme-card"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 自由メモ */}
          <div className="mb-5">
            <label htmlFor="mj-note" className="block text-sm font-medium text-theme-secondary mb-2">
              ひとことメモ（任意）
            </label>
            <textarea
              id="mj-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="今日あったこと、感じたことを自由に…"
              className="w-full rounded-xl border border-theme-light bg-theme-surface px-3 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:border-brand transition-colors"
            />
            <div className="mt-1 text-right text-[11px] text-theme-muted tabular-nums">
              {note.length} / {NOTE_MAX}
            </div>
          </div>

          {/* 記録ボタン */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={handleSave}
              disabled={!canSave}
              aria-disabled={!canSave}
            >
              <HeartIcon className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              記録する
            </button>
            {justSaved && (
              <span className="mj-saved-pop text-sm text-theme-accent font-medium whitespace-nowrap" role="status">
                記録しました
              </span>
            )}
          </div>
          {!canSave && <p className="mt-2 text-xs text-theme-muted">気分を選ぶと記録できます。</p>}
        </section>

        {/* ── 右カラム：可視化 + AI ── */}
        <div className="space-y-5 lg:space-y-6">
          {/* 統計 + トレンド */}
          <section
            aria-labelledby="mj-trend-heading"
            className="bg-theme-card rounded-2xl border border-theme-light shadow-sm p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="mj-trend-heading" className="flex items-center gap-2 text-base font-semibold text-theme-primary">
                <ChartBarIcon className="w-5 h-5 text-theme-accent" strokeWidth={2} aria-hidden="true" />
                推移
              </h2>
              <div className="flex items-center gap-0.5 bg-theme-surface rounded-lg p-0.5 border border-theme-light" role="tablist" aria-label="推移の表示形式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={trendView === "spark"}
                  onClick={() => setTrendView("spark")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    trendView === "spark" ? "bg-brand text-white" : "text-theme-tertiary hover:text-theme-secondary"
                  }`}
                >
                  折れ線
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={trendView === "calendar"}
                  onClick={() => setTrendView("calendar")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    trendView === "calendar" ? "bg-brand text-white" : "text-theme-tertiary hover:text-theme-secondary"
                  }`}
                >
                  カレンダー
                </button>
              </div>
            </div>

            {/* 統計 3 つ */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="rounded-xl bg-theme-surface border border-theme-light px-2 py-3 text-center">
                <div className="text-xl font-bold text-theme-primary tabular-nums">
                  {hydrated && avg7 != null ? avg7.toFixed(1) : "—"}
                </div>
                <div className="text-[10px] text-theme-tertiary mt-0.5">7日平均</div>
              </div>
              <div className="rounded-xl bg-theme-surface border border-theme-light px-2 py-3 text-center">
                <div className="text-xl font-bold text-theme-primary tabular-nums">{hydrated ? entries.length : "—"}</div>
                <div className="text-[10px] text-theme-tertiary mt-0.5">記録数</div>
              </div>
              <div className="rounded-xl bg-theme-surface border border-theme-light px-2 py-3 text-center">
                <div className="text-xl font-bold text-theme-primary tabular-nums">{hydrated ? `${streak}日` : "—"}</div>
                <div className="text-[10px] text-theme-tertiary mt-0.5">連続記録</div>
              </div>
            </div>

            {/* トレンド本体 */}
            <div className="text-xs text-theme-muted mb-2">直近{TREND_DAYS}日間</div>
            {hydrated ? (
              trendView === "spark" ? (
                <MoodSparkline points={trend} />
              ) : (
                <MoodDotCalendar points={trend} />
              )
            ) : (
              <div className="h-12" aria-hidden="true" />
            )}
          </section>

          {/* AI ふりかえり */}
          <section
            aria-labelledby="mj-ai-heading"
            className="bg-theme-card rounded-2xl border border-theme-light shadow-sm p-5 sm:p-6"
          >
            <h2 id="mj-ai-heading" className="flex items-center gap-2 text-base font-semibold text-theme-primary mb-1">
              <SparklesIcon className="w-5 h-5 text-theme-accent" strokeWidth={2} aria-hidden="true" />
              AI にふりかえりを依頼
            </h2>
            <p className="text-xs text-theme-tertiary mb-4">
              直近{REFLECT_ENTRY_LIMIT}件の記録をもとに、やさしいふりかえりと小さな提案をお届けします。
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReflect}
                disabled={reflecting || sorted.length === 0}
                aria-disabled={reflecting || sorted.length === 0}
              >
                <SparklesIcon className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                {reflecting ? "考えています…" : "ふりかえりを依頼"}
              </button>

              <label className="flex items-center gap-2 text-xs text-theme-tertiary">
                <span className="sr-only sm:not-sr-only">モデル</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelId)}
                  aria-label="AIモデルを選択"
                  className="rounded-lg border border-theme-light bg-theme-surface px-2 py-1.5 text-xs text-theme-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {sorted.length === 0 && hydrated && (
              <p className="text-sm text-theme-muted">まず気分を記録すると、ふりかえりを依頼できます。</p>
            )}

            {reflectError && (
              <div className="rounded-xl bg-theme-warning border border-theme-warning px-3 py-2.5 text-sm text-theme-warning" role="alert">
                {reflectError}
              </div>
            )}

            {reflectResult && (
              <div className="mj-fade-up space-y-3">
                <div className="rounded-xl bg-theme-highlight border border-theme-light px-4 py-3">
                  <p className="text-sm text-theme-primary leading-relaxed whitespace-pre-wrap">{reflectResult.reflection}</p>
                </div>

                {reflectResult.suggestions.length > 0 && (
                  <div className="rounded-xl bg-theme-surface border border-theme-light px-4 py-3">
                    <div className="text-xs font-semibold text-theme-secondary mb-2">やさしい提案</div>
                    <ul className="space-y-1.5">
                      {reflectResult.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-theme-primary">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" aria-hidden="true" />
                          <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {reflectResult.crisisHint && (
                  <div className="rounded-xl bg-theme-warning border border-theme-warning px-4 py-3" role="note">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="w-5 h-5 text-theme-warning flex-shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
                      <p className="text-sm text-theme-warning leading-relaxed">{reflectResult.crisisHint}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-theme-muted flex items-center gap-1">
                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                    これは医療・診断ではありません。あくまで気づきのきっかけとしてご利用ください。
                  </p>
                  {tokenUsage && (
                    <span className="text-[10px] text-theme-muted tabular-nums">
                      {tokenUsage.totalTokens.toLocaleString()} tokens / ¥{tokenUsage.estimatedCostJPY.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── 気分が続けて低いときの案内 ── */}
      {hydrated && showCrisisCard && (
        <section
          aria-label="相談窓口のご案内"
          className="mt-5 lg:mt-6 rounded-2xl bg-theme-warning border border-theme-warning p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-theme-warning flex-shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-theme-warning mb-1">つらい状態が続いていませんか</h2>
              <p className="text-sm text-theme-warning leading-relaxed mb-3">
                最近、気分の低い記録が続いているようです。ひとりで抱え込まず、専門の窓口や信頼できる人にそっと話してみることも、やさしい選択肢のひとつです。
                （これは医療・診断ではありません。）
              </p>
              <ul className="space-y-1">
                {SUPPORT_LINES.map((line) => (
                  <li key={line.name} className="text-sm text-theme-warning">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-theme-warning/80"> — {line.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── 履歴一覧 ── */}
      <section aria-labelledby="mj-history-heading" className="mt-5 lg:mt-6">
        <h2 id="mj-history-heading" className="text-base font-semibold text-theme-primary mb-3">
          最近の記録
        </h2>
        {!hydrated ? (
          <div className="h-16" aria-hidden="true" />
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-theme-medium bg-theme-surface px-5 py-8 text-center text-sm text-theme-muted">
            まだ記録がありません。最初の気分を記録してみましょう。
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.slice(0, 30).map((e) => {
              const meta = getMoodMeta(e.mood);
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-xl bg-theme-card border border-theme-light px-4 py-3"
                >
                  <span className="text-2xl flex-shrink-0 leading-none" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-theme-primary">{meta.label}</span>
                      <span className="text-xs text-theme-muted tabular-nums">{formatDateTime(e.timestamp)}</span>
                      {typeof e.energy === "number" && (
                        <span className="text-[11px] text-theme-tertiary">活力 {e.energy}/5</span>
                      )}
                    </div>
                    {e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full bg-theme-surface border border-theme-light text-[11px] text-theme-secondary"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {e.note && <p className="mt-1.5 text-sm text-theme-secondary leading-relaxed break-words">{e.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    aria-label={`${formatDateTime(e.timestamp)} の記録を削除`}
                    className="flex-shrink-0 p-1.5 rounded-lg text-theme-muted hover:text-theme-warning hover:bg-theme-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <TrashIcon className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
