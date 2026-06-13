"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ChevronDownIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import {
  getMoodEntries,
  getSymptomChecks,
  getBreathSessions,
  getMoveSessions,
  subscribeStore,
  newId,
} from "@/lib/wellness/storage";
import type {
  MoodEntry,
  SymptomCheck,
  BreathSession,
  MoveSession,
} from "@/lib/wellness/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/analyze/types";
import type { ModelId } from "../api/analyze/types";
import { getVoiceForLanguage } from "@/lib/audioHelpers";

// ── 定数 ────────────────────────────────────────────────────────────
const COACH_LANG = "ja-JP";
const RECENT_DAYS = 7;
const HISTORY_LIMIT = 10;
const SPEECH_RATE = 1.0;

const STARTERS: readonly string[] = [
  "最近よく眠れない",
  "肩こりがつらい",
  "気分が落ち込みがち",
  "集中力を上げたい",
] as const;

const ERROR_MESSAGE =
  "申し訳ありません。一時的にエラーが発生しました。少し時間をおいて、もう一度試してみてください。";

type CoachMessageType = "normal" | "warning" | "recommendation";

interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  type?: CoachMessageType;
}

// 横断コンテキストの集計結果（参照中データの可視化にも使う）
interface WellnessSnapshot {
  moodCount: number;
  symptomCount: number;
  breathCount: number;
  moveCount: number;
  contextText: string;
}

// ── ヘルパー（純粋関数） ─────────────────────────────────────────────
const MOOD_LABELS = ["", "とても悪い", "悪い", "普通", "良い", "とても良い"];

function withinRecentDays(timestamp: number, days: number): boolean {
  const diff = Date.now() - timestamp;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

/** 直近の記録を要約して API に渡す wellnessContext 文字列を組み立てる */
function buildSnapshot(
  moods: MoodEntry[],
  symptoms: SymptomCheck[],
  breaths: BreathSession[],
  moves: MoveSession[],
): WellnessSnapshot {
  const recentMoods = moods.filter((m) => withinRecentDays(m.timestamp, RECENT_DAYS));
  const recentSymptoms = symptoms.filter((s) => withinRecentDays(s.timestamp, RECENT_DAYS));
  const recentBreaths = breaths.filter((b) => withinRecentDays(b.timestamp, RECENT_DAYS));
  const recentMoves = moves.filter((mv) => withinRecentDays(mv.timestamp, RECENT_DAYS));

  const lines: string[] = [];

  if (recentMoods.length > 0) {
    const avg = recentMoods.reduce((sum, m) => sum + m.mood, 0) / recentMoods.length;
    const tagCounts = new Map<string, number>();
    recentMoods.forEach((m) =>
      m.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)),
    );
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);
    lines.push(
      `気分ログ ${recentMoods.length} 件（直近${RECENT_DAYS}日）。平均的な気分は「${MOOD_LABELS[Math.round(avg)] ?? "普通"}」。` +
        (topTags.length > 0 ? `よく出るタグ: ${topTags.join("、")}。` : ""),
    );
  }

  if (recentSymptoms.length > 0) {
    const latest = recentSymptoms[0];
    lines.push(
      `症状チェック ${recentSymptoms.length} 件。直近の入力: 「${latest.input.description.slice(0, 60)}」（緊急度判定: ${latest.result.urgency}）。`,
    );
  }

  if (recentBreaths.length > 0) {
    const totalSec = recentBreaths.reduce((s, b) => s + b.durationSec, 0);
    lines.push(
      `呼吸・瞑想セッション ${recentBreaths.length} 回（合計 約${Math.round(totalSec / 60)} 分）。`,
    );
  }

  if (recentMoves.length > 0) {
    const totalSec = recentMoves.reduce((s, mv) => s + mv.durationSec, 0);
    lines.push(
      `体を動かすセッション ${recentMoves.length} 回（合計 約${Math.round(totalSec / 60)} 分）。`,
    );
  }

  return {
    moodCount: recentMoods.length,
    symptomCount: recentSymptoms.length,
    breathCount: recentBreaths.length,
    moveCount: recentMoves.length,
    contextText: lines.join("\n"),
  };
}

// ── コンポーネント ──────────────────────────────────────────────────
export default function HealthCoachMode() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState<WellnessSnapshot>({
    moodCount: 0,
    symptomCount: 0,
    breathCount: 0,
    moveCount: 0,
    contextText: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakEnabledRef = useRef(speakEnabled);
  const wasNearBottomRef = useRef(true);

  // 読み上げ ON/OFF の最新値を ref に同期（コールバック内で参照するため）
  useEffect(() => {
    speakEnabledRef.current = speakEnabled;
  }, [speakEnabled]);

  // スクロール位置を監視し、自動スクロールすべきか（底付近にいるか）を保持
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    // 判定しきい値はメッセージ1件分程度の余裕を持たせる
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  // 横断コンテキストを集計し、ストア変更を購読して更新
  useEffect(() => {
    const refresh = () => {
      setSnapshot(
        buildSnapshot(
          getMoodEntries(),
          getSymptomChecks(),
          getBreathSessions(),
          getMoveSessions(),
        ),
      );
    };
    refresh();
    const unsubscribe = subscribeStore(refresh);
    return unsubscribe;
  }, []);

  // SpeechSynthesis の音声一覧をロード。アンマウント時に発話をキャンセル。
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // メッセージ追加時に自動スクロール。
  // ユーザーが上方履歴を読んでいる間は妨げないよう、更新前に最下部にいたときのみ追従する。
  useEffect(() => {
    if (!wasNearBottomRef.current) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, isLoading]);

  // textarea の自動リサイズ
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [inputValue]);

  // アシスタント返信を読み上げる
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoiceForLanguage(voicesRef.current, COACH_LANG);
    if (voice) utterance.voice = voice;
    utterance.lang = COACH_LANG;
    utterance.rate = SPEECH_RATE;
    window.speechSynthesis.speak(utterance);
  }, []);

  // 読み上げトグル。OFF にした際は進行中の発話を停止。
  const toggleSpeak = useCallback(() => {
    setSpeakEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // メッセージ送信
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: CoachMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      // 送信時点の履歴（直近10件）を控えておく
      const historyToSend = [...messages, userMessage].slice(-HISTORY_LIMIT).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/health-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory: historyToSend.slice(0, -1),
            wellnessContext: snapshot.contextText,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          throw new Error("Health coach API error");
        }

        const data: { response?: string; type?: CoachMessageType } = await response.json();
        const content = data.response ?? ERROR_MESSAGE;

        const assistantMessage: CoachMessage = {
          id: newId(),
          role: "assistant",
          content,
          timestamp: Date.now(),
          type: data.type ?? "normal",
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (speakEnabledRef.current) {
          speak(content);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: ERROR_MESSAGE,
            timestamp: Date.now(),
            type: "normal",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, snapshot.contextText, selectedModel, speak],
  );

  // キーボード: Enter送信 / Shift+Enter改行（IME変換中は無視）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(inputValue);
      }
    },
    [inputValue, sendMessage],
  );

  const handleStarter = useCallback(
    (starter: string) => {
      void sendMessage(starter);
    },
    [sendMessage],
  );

  // 参照中データのチップ表示
  const contextChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (snapshot.moodCount > 0) chips.push({ key: "mood", label: `気分ログ${snapshot.moodCount}件` });
    if (snapshot.symptomCount > 0)
      chips.push({ key: "symptom", label: `症状チェック${snapshot.symptomCount}件` });
    if (snapshot.breathCount > 0)
      chips.push({ key: "breath", label: `呼吸${snapshot.breathCount}回` });
    if (snapshot.moveCount > 0) chips.push({ key: "move", label: `運動${snapshot.moveCount}回` });
    return chips;
  }, [snapshot]);

  const hasMessages = messages.length > 0;

  return (
    <div className="hc-root max-w-[1100px] mx-auto px-4 py-6 w-full">
      <style>{`
        .hc-typing { display: inline-flex; gap: 4px; align-items: center; padding: 2px 0; }
        .hc-typing span {
          width: 7px; height: 7px; border-radius: 9999px;
          background: currentColor; opacity: 0.5;
          animation: hc-bounce 1.2s infinite ease-in-out both;
        }
        .hc-typing span:nth-child(2) { animation-delay: 0.16s; }
        .hc-typing span:nth-child(3) { animation-delay: 0.32s; }
        @keyframes hc-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 0.9; }
        }
        .hc-fade { animation: hc-fade-in 0.28s ease both; }
        @keyframes hc-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hc-typing span { animation: none; opacity: 0.6; }
          .hc-fade { animation: none; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-theme-accent text-white flex-shrink-0">
            <HeartIcon className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-theme-primary leading-tight">
              AIヘルスコーチ
            </h1>
            <p className="text-xs text-theme-tertiary leading-snug">
              からだ・こころ・生活習慣を横断して伴走します
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto flex-shrink-0">
          {/* 読み上げトグル */}
          <button
            type="button"
            onClick={toggleSpeak}
            className="flex items-center gap-1.5 rounded-xl border border-theme-light bg-theme-card px-3 py-2 text-xs font-medium text-theme-secondary transition-colors hover:bg-theme-glass focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-pressed={speakEnabled}
            aria-label={speakEnabled ? "音声読み上げをオフにする" : "音声読み上げをオンにする"}
            title={speakEnabled ? "読み上げ ON" : "読み上げ OFF"}
          >
            {speakEnabled ? (
              <SpeakerWaveIcon className="w-4 h-4 text-theme-accent" aria-hidden="true" />
            ) : (
              <SpeakerXMarkIcon className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">読み上げ</span>
          </button>

          {/* モデルセレクタ */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelId)}
              className="appearance-none rounded-xl border border-theme-light bg-theme-card pl-3 pr-8 py-2 text-xs text-theme-secondary cursor-pointer transition-colors hover:bg-theme-glass focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="AIモデルを選択"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      {/* 参照中データの可視化 */}
      <section
        className="mb-4 rounded-2xl border border-theme-soft bg-theme-glass px-4 py-3"
        aria-label="コーチが参照中のデータ"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-theme-tertiary mb-2">
          <SparklesIcon className="w-3.5 h-3.5 text-theme-accent" aria-hidden="true" />
          コーチが参照中のデータ
        </div>
        {contextChips.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="参照データ一覧">
            {contextChips.map((chip) => (
              <li
                key={chip.key}
                className="rounded-full bg-theme-card border border-theme-light px-3 py-1 text-xs text-theme-secondary"
              >
                {chip.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-theme-muted">
            まだ記録がありません。気分ジャーナルや呼吸・運動を記録すると、コーチがあなたの状態を踏まえて応答します。
          </p>
        )}
      </section>

      {/* チャット領域 */}
      <div className="rounded-2xl border border-theme-soft bg-theme-card overflow-hidden flex flex-col h-[clamp(380px,60vh,640px)]">
        {/* メッセージリスト */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          role="log"
          aria-live="polite"
          aria-label="コーチとの会話"
        >
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-theme-accent text-white mb-3">
                <ChatBubbleLeftRightIcon className="w-7 h-7" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-theme-primary mb-1">
                気になっていることを話してみてください
              </p>
              <p className="text-xs text-theme-tertiary mb-5 max-w-sm">
                睡眠・気分・からだの不調・習慣づくりなど、なんでも大丈夫です。
                あなたの記録を踏まえて、無理のない小さな一歩を一緒に考えます。
              </p>
              <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="話しかけの候補">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleStarter(starter)}
                    disabled={isLoading}
                    className="rounded-full border border-theme-light bg-theme-glass px-3.5 py-2 text-xs text-theme-secondary transition-colors hover:bg-theme-card hover:border-theme-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-theme-glass border border-theme-soft px-4 py-3 text-theme-secondary">
                    <span className="sr-only">コーチが入力中です</span>
                    <span className="hc-typing" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* スターターチップ（会話開始後はリスト上部に出さず、入力欄上に） */}
        {hasMessages && (
          <div className="px-4 pt-2 pb-1 flex flex-wrap gap-2 border-t border-theme-soft">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => handleStarter(starter)}
                disabled={isLoading}
                className="rounded-full border border-theme-light bg-theme-glass px-3 py-1.5 text-[11px] text-theme-tertiary transition-colors hover:bg-theme-card hover:text-theme-secondary disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {/* 入力エリア */}
        <div className="flex items-end gap-2 border-t border-theme-soft p-3">
          <div className="flex-1 min-w-0">
            <label htmlFor="hc-input" className="sr-only">
              コーチへのメッセージ
            </label>
            <textarea
              id="hc-input"
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="気になっていることを話してみてください..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-theme-light bg-theme-surface px-3 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
            <p className="mt-1 px-1 text-[10px] text-theme-muted">
              Enter で送信 ／ Shift+Enter で改行。これは医療上の診断ではなく、一般的なセルフケアの情報です。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="btn btn-primary flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="メッセージを送信"
          >
            <PaperAirplaneIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── チャットバブル ──────────────────────────────────────────────────
function ChatBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div className="hc-fade flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-md bg-teal-500 px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words">
            {message.content}
          </div>
          <div className="mt-1 text-right text-[10px] text-theme-muted">{time}</div>
        </div>
      </div>
    );
  }

  const isWarning = message.type === "warning";
  const isRecommendation = message.type === "recommendation";

  const bubbleClass = isWarning
    ? "bg-theme-warning border-theme-warning text-theme-primary"
    : "bg-theme-glass border-theme-soft text-theme-secondary";

  return (
    <div className="hc-fade flex justify-start">
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl rounded-bl-md border px-4 py-3 text-sm whitespace-pre-wrap break-words ${bubbleClass}`}
        >
          {(isWarning || isRecommendation) && (
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold">
              {isWarning ? (
                <>
                  <ExclamationTriangleIcon
                    className="w-4 h-4 text-theme-warning"
                    aria-hidden="true"
                  />
                  <span className="text-theme-warning">大切なお知らせ</span>
                </>
              ) : (
                <>
                  <LightBulbIcon className="w-4 h-4 text-theme-accent" aria-hidden="true" />
                  <span className="text-theme-accent">提案</span>
                </>
              )}
            </div>
          )}
          {message.content}
        </div>
        <div className="mt-1 text-left text-[10px] text-theme-muted">{time}</div>
      </div>
    </div>
  );
}
