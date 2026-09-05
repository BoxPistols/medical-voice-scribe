"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  HeartIcon,
  PhoneIcon,
  LifebuoyIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getSymptomChecks,
  addSymptomCheck,
  setSymptomChecks,
  subscribeStore,
  newId,
  STORAGE_KEYS,
} from "@/lib/wellness/storage";
import type {
  SymptomCheck,
  SymptomResult,
  SymptomUrgency,
  Scale5,
} from "@/lib/wellness/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/app/api/analyze/types";
import type { ModelId } from "@/app/api/analyze/types";
import { getVoiceForLanguage } from "@/lib/audioHelpers";

// ── 定数 ──────────────────────────────────────────────────────────────────

const MAX_DESCRIPTION = 2000;

const BODY_PARTS = ["頭", "胸", "腹", "背中", "喉", "皮膚", "全身", "その他"] as const;

const DURATION_OPTIONS = [
  { value: "数時間", label: "数時間" },
  { value: "1日", label: "1日" },
  { value: "2-3日", label: "2〜3日" },
  { value: "1週間以上", label: "1週間以上" },
  { value: "1ヶ月以上", label: "1ヶ月以上" },
] as const;

const SEVERITY_LABELS: Record<Scale5, string> = {
  1: "ごく軽い",
  2: "軽い",
  3: "ふつう",
  4: "つらい",
  5: "とてもつらい",
};

/** 緊急度ごとの表示メタ（色分け強調） */
interface UrgencyMeta {
  label: string;
  headline: string;
  /** バナー背景・枠・文字のクラス */
  banner: string;
  chip: string;
  Icon: typeof ShieldExclamationIcon;
}

const URGENCY_META: Record<SymptomUrgency, UrgencyMeta> = {
  emergency: {
    label: "至急",
    headline: "至急の受診・救急要請を検討してください",
    banner: "bg-danger-soft border-danger-line text-danger-fg",
    chip: "bg-danger-soft text-danger-fg border border-danger-line",
    Icon: ShieldExclamationIcon,
  },
  "see-doctor": {
    label: "早めに受診",
    headline: "早めに医療機関の受診をおすすめします",
    banner: "bg-warning-soft border-warning-line text-warning-fg",
    chip: "bg-warning-soft text-warning-fg border border-warning-line",
    Icon: ExclamationTriangleIcon,
  },
  monitor: {
    label: "経過観察",
    headline: "経過を観察し、悪化時は受診してください",
    banner: "bg-info-soft border-info-line text-info-fg",
    chip: "bg-info-soft text-info-fg border border-info-line",
    Icon: HeartIcon,
  },
  "self-care": {
    label: "セルフケア",
    headline: "セルフケアで様子を見てよい状態です",
    banner: "bg-brand-soft border-brand-line text-brand-fg",
    chip: "bg-brand-soft text-brand-fg border border-brand-line",
    Icon: CheckCircleIcon,
  },
};

const URGENCY_ORDER: SymptomUrgency[] = ["emergency", "see-doctor", "monitor", "self-care"];

// ── ヘルパー ──────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

/** 結果を読み上げ用テキストへ整形 */
function resultToSpeech(result: SymptomResult): string {
  const meta = URGENCY_META[result.urgency];
  const parts: string[] = [`緊急度は${meta.label}です。`, result.summary];
  if (result.redFlags.length > 0) {
    parts.push(`至急のサイン。${result.redFlags.join("。")}`);
  }
  if (result.selfCare.length > 0) {
    parts.push(`セルフケア。${result.selfCare.join("。")}`);
  }
  parts.push(result.disclaimer);
  return parts.join("");
}

// ── 子コンポーネント ──────────────────────────────────────────────────────

function UrgencyChip({ urgency }: { urgency: SymptomUrgency }) {
  const meta = URGENCY_META[urgency];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.chip}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

interface ResultPanelProps {
  result: SymptomResult;
  isSpeaking: boolean;
  speechSupported: boolean;
  onToggleSpeech: () => void;
}

function ResultPanel({ result, isSpeaking, speechSupported, onToggleSpeech }: ResultPanelProps) {
  const meta = URGENCY_META[result.urgency];
  const { Icon } = meta;
  const isEmergency = result.urgency === "emergency";

  return (
    <section aria-label="症状チェックの結果" className="space-y-4">
      {/* 緊急度バナー */}
      <div
        className={`rounded-2xl border-2 p-4 sm:p-5 ${meta.banner}`}
        role={isEmergency ? "alert" : "status"}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-7 h-7 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
              緊急度: {meta.label}
            </p>
            <h3 className="text-lg font-bold leading-snug">{meta.headline}</h3>
            <p className="mt-1 text-sm leading-relaxed text-current/90">{result.summary}</p>
          </div>
          {speechSupported && (
            <button
              type="button"
              onClick={onToggleSpeech}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-theme-card transition-colors text-theme-tertiary hover:text-theme-secondary"
              aria-label={isSpeaking ? "読み上げを停止" : "結果を読み上げ"}
              aria-pressed={isSpeaking}
            >
              {isSpeaking ? (
                <SpeakerXMarkIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* emergency 時の救急受診の具体案内 */}
        {isEmergency && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <a
              href="tel:119"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white hover:bg-danger-strong transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
            >
              <PhoneIcon className="w-5 h-5" aria-hidden="true" />
              119番（救急）に電話する
            </a>
            <a
              href="tel:%237119"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-danger-line px-4 py-2.5 text-sm font-semibold text-danger-fg hover:bg-danger-soft-strong transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
            >
              <LifebuoyIcon className="w-5 h-5" aria-hidden="true" />
              #7119（救急相談）
            </a>
          </div>
        )}
      </div>

      {/* 免責（常時目立つ位置） */}
      <div className="rounded-xl border border-theme-warning bg-theme-warning px-4 py-3">
        <p className="text-xs leading-relaxed text-theme-warning flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            これは医療機器ではなく、診断ではありません。最終的な判断は必ず医療機関にご相談ください。
            {result.disclaimer ? ` ${result.disclaimer}` : ""}
          </span>
        </p>
      </div>

      {/* 考えられる可能性・参考 */}
      {result.considerations.length > 0 && (
        <div className="rounded-2xl bg-theme-card border border-theme-light p-4 sm:p-5">
          <h4 className="text-sm font-bold text-theme-primary mb-3">可能性・参考（診断ではありません）</h4>
          <ul className="space-y-3">
            {result.considerations.map((c, i) => (
              <li key={`${c.name}-${i}`} className="rounded-xl bg-theme-surface p-3">
                <p className="text-sm font-semibold text-theme-primary">{c.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-theme-secondary">{c.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* レッドフラグ */}
      {result.redFlags.length > 0 && (
        <div className="rounded-2xl border-2 border-danger-line bg-danger-soft p-4 sm:p-5">
          <h4 className="text-sm font-bold text-danger-fg mb-2 flex items-center gap-1.5">
            <ShieldExclamationIcon className="w-4 h-4" aria-hidden="true" />
            これがあれば至急受診を
          </h4>
          <ul className="space-y-1.5">
            {result.redFlags.map((f, i) => (
              <li key={`rf-${i}`} className="text-sm text-theme-primary flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* セルフケア */}
      {result.selfCare.length > 0 && (
        <div className="rounded-2xl bg-theme-card border border-theme-light p-4 sm:p-5">
          <h4 className="text-sm font-bold text-theme-primary mb-2 flex items-center gap-1.5">
            <HeartIcon className="w-4 h-4 text-brand-fg" aria-hidden="true" />
            セルフケアの目安
          </h4>
          <ul className="space-y-1.5">
            {result.selfCare.map((s, i) => (
              <li key={`sc-${i}`} className="text-sm text-theme-secondary flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface HistoryItemProps {
  check: SymptomCheck;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function HistoryItem({ check, expanded, onToggle, onDelete }: HistoryItemProps) {
  const panelId = `history-panel-${check.id}`;
  return (
    <li className="rounded-xl bg-theme-card border border-theme-light overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md"
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <UrgencyChip urgency={check.result.urgency} />
          <span className="flex-1 min-w-0 truncate text-sm text-theme-secondary">
            {check.input.description}
          </span>
          <span className="text-xs text-theme-muted flex-shrink-0 hidden sm:inline">
            {formatTimestamp(check.timestamp)}
          </span>
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4 text-theme-tertiary flex-shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-theme-tertiary flex-shrink-0" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 p-1.5 rounded-md text-theme-tertiary hover:text-danger-fg hover:bg-danger-soft-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          aria-label="この履歴を削除"
        >
          <TrashIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div id={panelId} className="px-3 pb-3 pt-1 border-t border-theme-light space-y-2">
          <p className="text-xs text-theme-muted sm:hidden">{formatTimestamp(check.timestamp)}</p>
          <div className="flex flex-wrap gap-1.5 text-xs text-theme-tertiary">
            {check.input.bodyPart && (
              <span className="rounded-full bg-theme-surface px-2 py-0.5">部位: {check.input.bodyPart}</span>
            )}
            {check.input.duration && (
              <span className="rounded-full bg-theme-surface px-2 py-0.5">期間: {check.input.duration}</span>
            )}
            {check.input.severity && (
              <span className="rounded-full bg-theme-surface px-2 py-0.5">
                重症度: {check.input.severity}/5
              </span>
            )}
          </div>
          <p className="text-sm text-theme-secondary leading-relaxed">{check.result.summary}</p>
          {check.result.redFlags.length > 0 && (
            <p className="text-xs text-danger-fg leading-relaxed">
              至急サイン: {check.result.redFlags.join(" / ")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────

export default function SymptomCheckerMode() {
  // 入力状態
  const [description, setDescription] = useState("");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [severity, setSeverity] = useState<Scale5>(3);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);

  // 通信状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SymptomResult | null>(null);

  // 履歴
  const [history, setHistory] = useState<SymptomCheck[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 読み上げ
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    []
  );

  // 履歴の初期化＋ストア購読
  useEffect(() => {
    setHistory(getSymptomChecks());
    const unsubscribe = subscribeStore((key) => {
      if (key === STORAGE_KEYS.symptom) {
        setHistory(getSymptomChecks());
      }
    });
    return unsubscribe;
  }, []);

  // 音声リストの取得（非同期で揃うブラウザに対応）
  useEffect(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => setVoices(synth.getVoices());
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [speechSupported]);

  // アンマウント時に読み上げ・通信を確実に停止
  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
      abortRef.current?.abort();
    };
  }, [speechSupported]);

  const stopSpeech = useCallback(() => {
    if (speechSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [speechSupported]);

  const handleToggleSpeech = useCallback(() => {
    if (!speechSupported || !result) return;
    if (isSpeaking) {
      stopSpeech();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(resultToSpeech(result));
    utterance.lang = "ja-JP";
    const voice = getVoiceForLanguage(voices, "ja-JP");
    if (voice) utterance.voice = voice;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synth.speak(utterance);
  }, [speechSupported, result, isSpeaking, stopSpeech, voices]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = description.trim();
      if (!trimmed || loading) return;

      stopSpeech();
      setLoading(true);
      setError(null);
      setResult(null);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/symptom-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: trimmed,
            bodyPart: bodyPart ?? undefined,
            duration: duration || undefined,
            severity,
            model,
          }),
          signal: controller.signal,
        });

        const data: unknown = await res.json();
        if (!res.ok) {
          const msg =
            data !== null && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : "症状チェックに失敗しました";
          throw new Error(msg);
        }

        const payload = data as { result?: SymptomResult };
        if (!payload.result) {
          throw new Error("結果を取得できませんでした");
        }

        setResult(payload.result);

        // 履歴に保存
        const check: SymptomCheck = {
          id: newId(),
          timestamp: Date.now(),
          input: {
            description: trimmed,
            bodyPart: bodyPart ?? undefined,
            duration: duration || undefined,
            severity,
          },
          result: payload.result,
        };
        addSymptomCheck(check);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "症状チェックに失敗しました");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }

    },
    [description, loading, bodyPart, duration, severity, model, stopSpeech]
  );

  const handleDelete = useCallback((id: string) => {
    const next = getSymptomChecks().filter((c) => c.id !== id);
    // 共有ストアのヘルパー経由で書き戻す（書込＋vital:storeイベント発火を一元化）
    setSymptomChecks(next);
    setHistory(next);
  }, []);

  const remaining = MAX_DESCRIPTION - description.length;
  const canSubmit = description.trim().length > 0 && !loading;

  const sortedHistory = useMemo(() => {
    // 緊急度の高い順を優先しつつ、新しいものを上に（emergency を見落とさない）
    return [...history].sort((a, b) => {
      const ua = URGENCY_ORDER.indexOf(a.result.urgency);
      const ub = URGENCY_ORDER.indexOf(b.result.urgency);
      if (ua !== ub) return ua - ub;
      return b.timestamp - a.timestamp;
    });
  }, [history]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <style>{`
        @keyframes scm-spin { to { transform: rotate(360deg); } }
        .scm-spinner { animation: scm-spin 0.8s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .scm-spinner { animation-duration: 1.6s; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-theme-primary flex items-center gap-2">
          <ShieldExclamationIcon className="w-6 h-6 text-brand-fg" aria-hidden="true" />
          AI症状チェッカー
        </h2>
        <p className="text-sm text-theme-tertiary">
          症状を入力すると、受診の目安となる参考情報を表示します。診断ではありません。
        </p>
      </header>

      {/* 常時表示の免責バナー */}
      <div className="rounded-xl border border-theme-warning bg-theme-warning px-4 py-2.5">
        <p className="text-xs leading-relaxed text-theme-warning flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            この機能は医療機器ではなく、診断・治療を目的としたものではありません。
            気になる症状がある場合は、自己判断せず医療機関を受診してください。
            命に関わる緊急時はためらわず119番へ。
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 入力フォーム */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5" noValidate>
          {/* 症状の説明 */}
          <div>
            <label htmlFor="scm-description" className="block text-sm font-semibold text-theme-primary mb-1.5">
              症状の説明 <span className="text-danger-fg" aria-hidden="true">*</span>
            </label>
            <textarea
              id="scm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
              maxLength={MAX_DESCRIPTION}
              rows={4}
              required
              placeholder="例: 昨日の夜から右下腹部が痛い。歩くと響く感じがする。"
              className="w-full rounded-xl bg-theme-surface border border-theme-medium px-3 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted resize-y focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              aria-describedby="scm-desc-count"
            />
            <p id="scm-desc-count" className="mt-1 text-xs text-theme-muted text-right">
              残り {remaining} 文字
            </p>
          </div>

          {/* 部位チップ */}
          <fieldset>
            <legend className="text-sm font-semibold text-theme-primary mb-1.5">部位（任意）</legend>
            <div className="flex flex-wrap gap-2">
              {BODY_PARTS.map((part) => {
                const active = bodyPart === part;
                return (
                  <button
                    key={part}
                    type="button"
                    onClick={() => setBodyPart(active ? null : part)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-brand text-white"
                        : "bg-theme-surface text-theme-secondary border border-theme-light hover:bg-theme-card"
                    }`}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 期間 */}
          <div>
            <label htmlFor="scm-duration" className="block text-sm font-semibold text-theme-primary mb-1.5">
              続いている期間（任意）
            </label>
            <select
              id="scm-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full sm:w-auto rounded-xl bg-theme-surface border border-theme-medium px-3 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">指定しない</option>
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 重症度スライダ */}
          <div>
            <label htmlFor="scm-severity" className="block text-sm font-semibold text-theme-primary mb-1.5">
              つらさの程度: <span className="text-brand-fg">{severity} / 5（{SEVERITY_LABELS[severity]}）</span>
            </label>
            <input
              id="scm-severity"
              type="range"
              min={1}
              max={5}
              step={1}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value) as Scale5)}
              className="w-full accent-brand cursor-pointer"
              aria-valuetext={`${severity}段階中 ${SEVERITY_LABELS[severity]}`}
            />
            <div className="flex justify-between text-xs text-theme-muted mt-1" aria-hidden="true">
              <span>軽い</span>
              <span>とてもつらい</span>
            </div>
          </div>

          {/* モデルセレクタ */}
          <div>
            <label htmlFor="scm-model" className="block text-sm font-semibold text-theme-primary mb-1.5">
              使用モデル
            </label>
            <select
              id="scm-model"
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
              className="w-full sm:w-auto rounded-xl bg-theme-surface border border-theme-medium px-3 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.description}）
                </option>
              ))}
            </select>
          </div>

          {/* 送信ボタン */}
          <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full sm:w-auto">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="scm-spinner inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                チェック中…
              </span>
            ) : (
              "症状をチェックする"
            )}
          </button>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger-fg"
            >
              {error}
            </p>
          )}
        </form>

        {/* 結果＋履歴 */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <ResultPanel
              result={result}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onToggleSpeech={handleToggleSpeech}
            />
          ) : (
            !loading && (
              <div className="rounded-2xl border border-dashed border-theme-light bg-theme-surface p-6 text-center">
                <HeartIcon className="w-8 h-8 text-brand-fg mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-theme-tertiary">
                  症状を入力してチェックすると、ここに参考情報が表示されます。
                </p>
              </div>
            )
          )}

          {/* 履歴 */}
          <section aria-label="過去のチェック履歴">
            <h3 className="text-sm font-bold text-theme-primary mb-2">
              過去のチェック{sortedHistory.length > 0 ? `（${sortedHistory.length}）` : ""}
            </h3>
            {sortedHistory.length === 0 ? (
              <p className="text-xs text-theme-muted">まだ履歴はありません。</p>
            ) : (
              <ul className="space-y-2">
                {sortedHistory.map((check) => (
                  <HistoryItem
                    key={check.id}
                    check={check}
                    expanded={expandedId === check.id}
                    onToggle={() => setExpandedId((prev) => (prev === check.id ? null : check.id))}
                    onDelete={() => handleDelete(check.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
