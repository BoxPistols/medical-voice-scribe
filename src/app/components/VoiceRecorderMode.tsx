"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MicrophoneIcon,
  StopIcon,
  SparklesIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowsPointingInIcon,
  ScissorsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { ModelId, TokenUsage } from "../api/analyze/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/analyze/types";
import { processRecognizedText } from "@/lib/textProcessor";
import {
  loadVoiceGroups,
  saveVoiceGroups,
  type PersistentVoiceGroup,
  type VoiceCategory,
} from "@/lib/voiceStore";

// ------ Types ------

const VOICE_CATEGORIES: { value: VoiceCategory; label: string }[] = [
  { value: "meeting", label: "会議" },
  { value: "idea", label: "アイデア" },
  { value: "memo", label: "メモ" },
  { value: "other", label: "その他" },
];

interface VoiceGroup {
  id: string;
  text: string;
  createdAt: Date;
  label: string;
  category: VoiceCategory;
  isRecording?: boolean;
}

interface OrganizeResult {
  formatted: string;
  changes: string[];
}

interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  keywords: string[];
}

type FormatMode = "organize" | "summarize" | "chat-reformat";

// Web Speech API type definitions
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface IWindow extends Window {
  webkitSpeechRecognition: SpeechRecognitionConstructor;
  SpeechRecognition: SpeechRecognitionConstructor;
}

// ------ Helpers ------

const generateId = () => `vg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatTimestamp = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const formatElapsed = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ------ Component ------

export default function VoiceRecorderMode() {
  // Groups（localStorageから復元）
  const [groups, setGroups] = useState<VoiceGroup[]>(() => {
    const saved = loadVoiceGroups();
    return saved.map((g) => ({
      id: g.id,
      text: g.text,
      createdAt: new Date(g.createdAt),
      label: g.label,
      category: g.category,
    }));
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 過去の記録UI
  const [showHistory, setShowHistory] = useState(false);
  const [historyCategory, setHistoryCategory] = useState<VoiceCategory | "">("");
  const [historySearch, setHistorySearch] = useState("");

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingGroupId, setRecordingGroupId] = useState<string | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // AI processing
  const [formatMode, setFormatMode] = useState<FormatMode>("organize");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);
  const [organizeResults, setOrganizeResults] = useState<Record<string, OrganizeResult>>({});
  const [chatReformatResults, setChatReformatResults] = useState<Record<string, OrganizeResult>>({});
  const [summarizeResults, setSummarizeResults] = useState<Record<string, SummarizeResult>>({});
  const [aiError, setAiError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // UI
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [splitTarget, setSplitTarget] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);

  // Cleanup recognition on unmount (when switching away from voice mode)
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        const ref = recognitionRef.current;
        recognitionRef.current = null;
        try { ref.stop(); } catch { /* already stopped */ }
      }
    };
  }, []);

  // groupsが変更されたらlocalStorageに保存（録音中のグループは除外）
  useEffect(() => {
    const toSave: PersistentVoiceGroup[] = groups
      .filter((g) => !g.isRecording && g.text.trim().length > 0)
      .map((g) => ({
        id: g.id,
        text: g.text,
        createdAt: g.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
        label: g.label,
        category: g.category,
        tags: [],
        organizeResult: organizeResults[g.id]?.formatted,
        summarizeResult: summarizeResults[g.id]?.summary,
        chatReformatResult: chatReformatResults[g.id]?.formatted,
      }));
    saveVoiceGroups(toSave);
  }, [groups, organizeResults, summarizeResults, chatReformatResults]);

  // 保存済みの整理・要約・チャット整形結果を復元
  useEffect(() => {
    const saved = loadVoiceGroups();
    const org: Record<string, OrganizeResult> = {};
    const sum: Record<string, SummarizeResult> = {};
    const chat: Record<string, OrganizeResult> = {};
    saved.forEach((g) => {
      if (g.organizeResult) org[g.id] = { formatted: g.organizeResult, changes: [] };
      if (g.summarizeResult) sum[g.id] = { summary: g.summarizeResult, keyPoints: [], actionItems: [], keywords: [] };
      if (g.chatReformatResult) chat[g.id] = { formatted: g.chatReformatResult, changes: [] };
    });
    if (Object.keys(org).length) setOrganizeResults((prev) => ({ ...org, ...prev }));
    if (Object.keys(sum).length) setSummarizeResults((prev) => ({ ...sum, ...prev }));
    if (Object.keys(chat).length) setChatReformatResults((prev) => ({ ...chat, ...prev }));
  }, []);

  // Recording elapsed timer
  useEffect(() => {
    if (!isRecording || !recordingStartRef.current) return;
    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as unknown as IWindow).webkitSpeechRecognition ||
      (window as unknown as IWindow).SpeechRecognition;
    if (!SpeechRecognition) {
      setAiError("このブラウザは音声認識に対応していません");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ja-JP";

    const groupId = generateId();
    const newGroup: VoiceGroup = {
      id: groupId,
      text: "",
      createdAt: new Date(),
      label: `録音 ${groups.length + 1}`,
      category: "memo",
      isRecording: true,
    };

    setGroups((prev) => [...prev, newGroup]);
    setRecordingGroupId(groupId);
    setExpandedGroups((prev) => new Set(prev).add(groupId));

    let fullText = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (final) {
        fullText += processRecognizedText(final);
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, text: fullText } : g))
        );
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal during stop/restart cycles
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setAiError(`音声認識エラー: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // auto-restart if still supposed to be recording
      // Use a small delay to let the browser's speech engine fully reset
      if (recognitionRef.current === recognition) {
        setTimeout(() => {
          if (recognitionRef.current === recognition) {
            try {
              recognition.start();
            } catch {
              // already stopped or being disposed
            }
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    recordingStartRef.current = Date.now();
    setIsRecording(true);
    setRecordingElapsed(0);
  }, [groups.length]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }
    setIsRecording(false);
    setInterimText("");
    recordingStartRef.current = null;

    // Mark group as not recording and remove if empty
    if (recordingGroupId) {
      setGroups((prev) =>
        prev
          .map((g) => (g.id === recordingGroupId ? { ...g, isRecording: false } : g))
          .filter((g) => g.text.trim().length > 0 || g.isRecording)
      );
    }
    setRecordingGroupId(null);
  }, [recordingGroupId]);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Merge selected groups
  const mergeSelected = useCallback(() => {
    if (selectedIds.size < 2) return;
    const selected = groups.filter((g) => selectedIds.has(g.id));
    const merged: VoiceGroup = {
      id: generateId(),
      text: selected.map((g) => g.text).join("\n\n"),
      createdAt: new Date(),
      label: `結合: ${selected.map((g) => g.label).join(" + ")}`,
      category: selected[0].category,
    };
    // Replace first selected with merged, remove others
    const firstIdx = groups.findIndex((g) => selectedIds.has(g.id));
    const newGroups = groups.filter((g) => !selectedIds.has(g.id));
    newGroups.splice(firstIdx, 0, merged);
    setGroups(newGroups);
    setSelectedIds(new Set());
    setExpandedGroups((prev) => new Set(prev).add(merged.id));
  }, [groups, selectedIds]);

  // Split a group
  const confirmSplit = useCallback(() => {
    if (!splitTarget) return;
    const group = groups.find((g) => g.id === splitTarget);
    if (!group || splitPosition <= 0 || splitPosition >= group.text.length) {
      setSplitTarget(null);
      return;
    }
    const textA = group.text.slice(0, splitPosition).trim();
    const textB = group.text.slice(splitPosition).trim();
    if (!textA || !textB) {
      setSplitTarget(null);
      return;
    }
    const partA: VoiceGroup = {
      id: generateId(),
      text: textA,
      createdAt: group.createdAt,
      label: `${group.label} (前半)`,
      category: group.category,
    };
    const partB: VoiceGroup = {
      id: generateId(),
      text: textB,
      createdAt: new Date(),
      label: `${group.label} (後半)`,
      category: group.category,
    };
    const idx = groups.findIndex((g) => g.id === splitTarget);
    const newGroups = [...groups];
    newGroups.splice(idx, 1, partA, partB);
    setGroups(newGroups);
    setSplitTarget(null);
    setSplitPosition(0);
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.delete(splitTarget);
      next.add(partA.id);
      next.add(partB.id);
      return next;
    });
  }, [splitTarget, splitPosition, groups]);

  // Delete a group
  const deleteGroup = useCallback(
    (id: string) => {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Clean up results
      setOrganizeResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setChatReformatResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSummarizeResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  // AI format single group
  const formatGroup = useCallback(
    async (groupId: string, mode: FormatMode) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group || !group.text.trim()) return;

      setProcessingId(groupId);
      setAiError(null);

      try {
        const res = await fetch("/api/voice-format", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: group.text, mode, model: selectedModel }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI処理に失敗しました");

        if (mode === "organize") {
          setOrganizeResults((prev) => ({ ...prev, [groupId]: data.result }));
        } else if (mode === "chat-reformat") {
          setChatReformatResults((prev) => ({ ...prev, [groupId]: data.result }));
        } else {
          setSummarizeResults((prev) => ({ ...prev, [groupId]: data.result }));
        }
        if (data.tokenUsage) setTokenUsage(data.tokenUsage);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "AI処理に失敗しました");
      } finally {
        setProcessingId(null);
      }
    },
    [groups, selectedModel]
  );

  // AI format all groups
  const formatAll = useCallback(
    async (mode: FormatMode) => {
      const targets = groups.filter((g) => g.text.trim() && !g.isRecording);
      if (targets.length === 0) return;
      setProcessingAll(true);
      setAiError(null);

      for (const group of targets) {
        setProcessingId(group.id);
        try {
          const res = await fetch("/api/voice-format", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: group.text, mode, model: selectedModel }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (mode === "organize") {
            setOrganizeResults((prev) => ({ ...prev, [group.id]: data.result }));
          } else if (mode === "chat-reformat") {
            setChatReformatResults((prev) => ({ ...prev, [group.id]: data.result }));
          } else {
            setSummarizeResults((prev) => ({ ...prev, [group.id]: data.result }));
          }
          if (data.tokenUsage) setTokenUsage(data.tokenUsage);
        } catch (err) {
          setAiError(err instanceof Error ? err.message : "AI処理に失敗しました");
          break;
        }
      }
      setProcessingId(null);
      setProcessingAll(false);
    },
    [groups, selectedModel]
  );

  // Copy to clipboard
  const copyText = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API非対応環境のフォールバック
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Apply organized text back to group
  const applyOrganized = useCallback((groupId: string) => {
    const result = organizeResults[groupId];
    if (!result) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, text: result.formatted } : g))
    );
    setOrganizeResults((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, [organizeResults]);

  // カテゴリ変更
  const updateCategory = useCallback((id: string, category: VoiceCategory) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, category } : g))
    );
  }, []);

  // ラベル変更
  const updateLabel = useCallback((id: string, label: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, label } : g))
    );
  }, []);

  // 過去の記録のフィルタリング済みリスト
  const filteredHistory = groups
    .filter((g) => !g.isRecording && g.text.trim().length > 0)
    .filter((g) => !historyCategory || g.category === historyCategory)
    .filter((g) => {
      if (!historySearch) return true;
      const q = historySearch.toLowerCase();
      return g.label.toLowerCase().includes(q) || g.text.toLowerCase().includes(q);
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const hasGroups = groups.length > 0;
  const canMerge = selectedIds.size >= 2;
  const savedCount = groups.filter((g) => !g.isRecording && g.text.trim().length > 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-theme-border bg-theme-surface">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Record button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                isRecording
                  ? "bg-danger hover:bg-danger-strong text-white"
                  : "bg-brand hover:bg-brand-strong text-white"
              }`}
            >
              {isRecording ? (
                <>
                  <StopIcon className="w-4 h-4" />
                  停止 {formatElapsed(recordingElapsed)}
                </>
              ) : (
                <>
                  <MicrophoneIcon className="w-4 h-4" />
                  録音開始
                </>
              )}
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-theme-border" />

            {/* AI Mode selector */}
            <div className="flex items-center gap-1 bg-theme-card rounded-lg p-0.5 border border-theme-border">
              <button
                onClick={() => setFormatMode("organize")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formatMode === "organize"
                    ? "bg-info text-white shadow-sm"
                    : "text-theme-tertiary hover:text-theme-secondary"
                }`}
              >
                整理
              </button>
              <button
                onClick={() => setFormatMode("chat-reformat")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formatMode === "chat-reformat"
                    ? "bg-brand text-white shadow-sm"
                    : "text-theme-tertiary hover:text-theme-secondary"
                }`}
              >
                伝わる文に整形
              </button>
              <button
                onClick={() => setFormatMode("summarize")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formatMode === "summarize"
                    ? "bg-info text-white shadow-sm"
                    : "text-theme-tertiary hover:text-theme-secondary"
                }`}
              >
                要約
              </button>
            </div>

            {/* Format all */}
            {hasGroups && (
              <button
                onClick={() => formatAll(formatMode)}
                disabled={processingAll || isRecording}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-theme-card border border-theme-border text-theme-secondary hover:bg-theme-surface disabled:opacity-50 transition-all"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                {processingAll ? "処理中..." : `全て${formatMode === "organize" ? "整理" : formatMode === "chat-reformat" ? "整形" : "要約"}`}
              </button>
            )}

            {/* Merge */}
            {canMerge && (
              <button
                onClick={mergeSelected}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-warning-soft border border-warning-line text-warning-fg hover:bg-warning-soft-strong transition-all"
              >
                <ArrowsPointingInIcon className="w-3.5 h-3.5" />
                選択を結合 ({selectedIds.size})
              </button>
            )}

            {/* 過去の記録ボタン */}
            {savedCount > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  showHistory
                    ? "bg-brand-soft border-brand-line text-brand-fg"
                    : "bg-theme-card border-theme-border text-theme-secondary hover:bg-theme-surface"
                }`}
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                過去の記録 ({savedCount})
              </button>
            )}

            {/* Model selector */}
            <div className="ml-auto relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                className="appearance-none bg-theme-card border border-theme-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-theme-tertiary cursor-pointer hover:border-theme-border-hover focus:outline-none focus:ring-2 focus:ring-info"
                aria-label="AIモデル選択"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted pointer-events-none" />
            </div>
          </div>

          {/* Token usage */}
          {tokenUsage && (
            <div className="mt-2 text-xs text-theme-muted">
              Token: {tokenUsage.totalTokens.toLocaleString()} |
              ¥{tokenUsage.estimatedCostJPY.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {aiError && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg bg-danger-soft border border-danger-line text-danger-fg text-sm flex items-center justify-between">
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} className="ml-2 text-danger-fg hover:text-danger">
            &times;
          </button>
        </div>
      )}

      {/* 過去の記録パネル */}
      {showHistory && (
        <div className="flex-shrink-0 border-b border-theme-border bg-theme-surface/50 max-h-72 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-theme-secondary">過去の記録</h3>
              {/* カテゴリフィルタ */}
              <select
                value={historyCategory}
                onChange={(e) => setHistoryCategory(e.target.value as VoiceCategory | "")}
                className="text-xs bg-theme-card border border-theme-border rounded-md px-2 py-1 text-theme-tertiary"
              >
                <option value="">全カテゴリ</option>
                {VOICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {/* テキスト検索 */}
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="検索..."
                className="text-xs bg-theme-card border border-theme-border rounded-md px-2 py-1 text-theme-primary placeholder:text-theme-muted w-32"
              />
              <button
                onClick={() => setShowHistory(false)}
                className="ml-auto text-theme-muted hover:text-theme-secondary text-xs"
              >
                閉じる
              </button>
            </div>
            {filteredHistory.length === 0 ? (
              <p className="text-xs text-theme-muted py-2">記録が見つかりません</p>
            ) : (
              <div className="space-y-1">
                {filteredHistory.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-card border border-theme-border hover:bg-theme-surface transition-all cursor-pointer"
                    onClick={() => {
                      setExpandedGroups((prev) => new Set(prev).add(g.id));
                      setShowHistory(false);
                      // スクロール先のグループにフォーカス
                      setTimeout(() => {
                        document.getElementById(`voice-group-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 100);
                    }}
                  >
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-theme-surface text-theme-tertiary border border-theme-border">
                      {VOICE_CATEGORIES.find((c) => c.value === g.category)?.label ?? "メモ"}
                    </span>
                    <span className="text-xs font-medium text-theme-primary truncate">{g.label}</span>
                    <span className="text-xs text-theme-muted font-mono ml-1">
                      {g.createdAt.toLocaleDateString("ja-JP")}
                    </span>
                    <span className="text-xs text-theme-muted truncate ml-auto max-w-48">
                      {g.text.slice(0, 40)}...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          {!hasGroups && !isRecording && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MicrophoneIcon className="w-16 h-16 text-theme-muted mb-4" />
              <h2 className="text-lg font-bold text-theme-secondary mb-2">
                音声メモ
              </h2>
              <p className="text-sm text-theme-tertiary max-w-md">
                録音ボタンを押して音声を記録してください。
                録音したテキストはグループで管理でき、分割・結合やAIによる整理・要約が可能です。
              </p>
            </div>
          )}

          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const isSelected = selectedIds.has(group.id);
            const isProcessing = processingId === group.id;
            const orgResult = organizeResults[group.id];
            const chatResult = chatReformatResults[group.id];
            const sumResult = summarizeResults[group.id];
            const isSplitting = splitTarget === group.id;

            return (
              <div
                key={group.id}
                id={`voice-group-${group.id}`}
                className={`rounded-xl border transition-all ${
                  isSelected
                    ? "border-brand bg-brand-soft shadow-md"
                    : "border-theme-border bg-theme-card shadow-sm"
                } ${group.isRecording ? "ring-2 ring-danger ring-opacity-50" : ""}`}
              >
                {/* Group header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer"
                  onClick={() => toggleExpand(group.id)}
                >
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(group.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-brand flex-shrink-0"
                  />

                  {/* Recording indicator */}
                  {group.isRecording && (
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse flex-shrink-0" />
                  )}

                  {/* Label */}
                  <span className="font-medium text-sm text-theme-primary truncate">
                    {group.label}
                  </span>

                  {/* Timestamp */}
                  <span className="text-xs text-theme-muted font-mono ml-1">
                    {formatTimestamp(group.createdAt)}
                  </span>

                  {/* Text preview */}
                  {!isExpanded && group.text && (
                    <span className="text-xs text-theme-tertiary truncate ml-2 flex-1 min-w-0">
                      {group.text.slice(0, 60)}...
                    </span>
                  )}

                  {/* Result badges */}
                  <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    {orgResult && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-info-soft text-info-fg">
                        整理済
                      </span>
                    )}
                    {chatResult && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-soft text-brand-fg">
                        整形済
                      </span>
                    )}
                    {sumResult && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-info-soft text-info-fg">
                        要約済
                      </span>
                    )}
                    {isProcessing && (
                      <ArrowPathIcon className="w-3.5 h-3.5 text-brand-fg animate-spin" />
                    )}
                  </div>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronUpIcon className="w-4 h-4 text-theme-muted flex-shrink-0" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-theme-muted flex-shrink-0" />
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-theme-border px-4 py-3 space-y-3">
                    {/* ラベル・カテゴリ編集 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={group.label}
                        onChange={(e) => updateLabel(group.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-theme-surface border border-theme-border rounded-md px-2 py-1 text-theme-primary flex-1 min-w-0"
                        placeholder="ラベル"
                      />
                      <select
                        value={group.category}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateCategory(group.id, e.target.value as VoiceCategory);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-theme-surface border border-theme-border rounded-md px-2 py-1 text-theme-tertiary"
                      >
                        {VOICE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Original text */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-theme-tertiary">
                          原文 ({group.text.length}文字)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyText(group.text, `orig-${group.id}`)}
                            className="p-1 rounded hover:bg-theme-surface text-theme-muted"
                            title="コピー"
                          >
                            {copiedId === `orig-${group.id}` ? (
                              <CheckCircleIcon className="w-3.5 h-3.5 text-success-fg" />
                            ) : (
                              <ClipboardDocumentIcon className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-theme-primary whitespace-pre-wrap bg-theme-surface rounded-lg p-3 max-h-48 overflow-y-auto">
                        {group.text}
                        {group.isRecording && interimText && (
                          <span className="text-theme-muted italic">{interimText}</span>
                        )}
                        {!group.text && group.isRecording && (
                          <span className="text-theme-muted italic">音声を認識中...</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!group.isRecording && group.text && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => formatGroup(group.id, "organize")}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-info-soft border border-info-line text-info-fg hover:bg-info-soft-strong disabled:opacity-50 transition-all"
                        >
                          <DocumentTextIcon className="w-3.5 h-3.5" />
                          整理
                        </button>
                        <button
                          onClick={() => formatGroup(group.id, "summarize")}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-info-soft border border-info-line text-info-fg hover:bg-info-soft-strong disabled:opacity-50 transition-all"
                        >
                          <SparklesIcon className="w-3.5 h-3.5" />
                          要約
                        </button>
                        <button
                          onClick={() => formatGroup(group.id, "chat-reformat")}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-soft border border-brand-line text-brand-fg hover:bg-brand-soft-strong disabled:opacity-50 transition-all"
                        >
                          <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                          伝わる文に整形
                        </button>
                        <button
                          onClick={() => {
                            setSplitTarget(group.id);
                            setSplitPosition(Math.floor(group.text.length / 2));
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-surface border border-theme-border text-theme-secondary hover:bg-theme-card transition-all"
                        >
                          <ScissorsIcon className="w-3.5 h-3.5" />
                          分割
                        </button>
                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-danger-fg hover:bg-danger-soft-strong transition-all ml-auto"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          削除
                        </button>
                      </div>
                    )}

                    {/* Split UI */}
                    {isSplitting && (
                      <div className="bg-theme-surface rounded-lg p-3 border border-theme-border space-y-2">
                        <div className="text-xs font-medium text-theme-secondary">
                          分割位置を指定 (0 〜 {group.text.length})
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={group.text.length - 1}
                          value={splitPosition}
                          onChange={(e) => setSplitPosition(Number(e.target.value))}
                          className="w-full accent-brand"
                        />
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-theme-card p-2 rounded border border-theme-border">
                            <div className="text-theme-muted mb-1">前半 ({splitPosition}文字)</div>
                            <div className="text-theme-primary truncate">
                              {group.text.slice(0, splitPosition)}
                            </div>
                          </div>
                          <div className="bg-theme-card p-2 rounded border border-theme-border">
                            <div className="text-theme-muted mb-1">
                              後半 ({group.text.length - splitPosition}文字)
                            </div>
                            <div className="text-theme-primary truncate">
                              {group.text.slice(splitPosition)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={confirmSplit}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-strong transition-all"
                          >
                            分割実行
                          </button>
                          <button
                            onClick={() => setSplitTarget(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-theme-tertiary hover:bg-theme-card transition-all"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Organize result */}
                    {orgResult && (
                      <div className="bg-info-soft rounded-lg p-3 border border-info-line space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-info-fg">
                            整理結果
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => applyOrganized(group.id)}
                              className="px-2 py-1 rounded text-xs font-medium bg-info text-white hover:bg-info-strong transition-all"
                              title="整理結果を原文に適用"
                            >
                              適用
                            </button>
                            <button
                              onClick={() => copyText(orgResult.formatted, `org-${group.id}`)}
                              className="p-1 rounded hover:bg-info-soft-strong"
                            >
                              {copiedId === `org-${group.id}` ? (
                                <CheckCircleIcon className="w-3.5 h-3.5 text-success-fg" />
                              ) : (
                                <ClipboardDocumentIcon className="w-5 h-5 text-info-fg" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-theme-primary whitespace-pre-wrap">
                          {orgResult.formatted}
                        </div>
                        {orgResult.changes.length > 0 && (
                          <div className="text-xs text-info-fg">
                            変更点: {orgResult.changes.join("、")}
                          </div>
                        )}
                      </div>
                    )}


                    {/* Chat reformat result */}
                    {chatResult && (
                      <div className="bg-brand-soft rounded-lg p-3 border border-brand-line space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-brand-fg">
                            整形結果
                          </span>
                          <button
                            onClick={() => copyText(chatResult.formatted, `chat-${group.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand text-white hover:bg-brand-strong transition-all shadow-sm"
                          >
                            {copiedId === `chat-${group.id}` ? (
                              <>
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                コピー済
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                コピー
                              </>
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-theme-primary whitespace-pre-wrap bg-theme-secondary rounded-lg p-3 border border-brand-line">
                          {chatResult.formatted}
                        </div>
                        {chatResult.changes.length > 0 && (
                          <div className="text-xs text-brand-fg">
                            変更点: {chatResult.changes.join("、")}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Summarize result */}
                    {sumResult && (
                      <div className="bg-info-soft rounded-lg p-3 border border-info-line space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-info-fg">
                            要約結果
                          </span>
                          <button
                            onClick={() =>
                              copyText(
                                `${sumResult.summary}\n\n要点:\n${sumResult.keyPoints.map((p) => `・${p}`).join("\n")}${
                                  sumResult.actionItems.length
                                    ? `\n\nアクション:\n${sumResult.actionItems.map((a) => `・${a}`).join("\n")}`
                                    : ""
                                }`,
                                `sum-${group.id}`
                              )
                            }
                            className="p-1 rounded hover:bg-info-soft-strong"
                          >
                            {copiedId === `sum-${group.id}` ? (
                              <CheckCircleIcon className="w-3.5 h-3.5 text-success-fg" />
                            ) : (
                              <ClipboardDocumentIcon className="w-5 h-5 text-info-fg" />
                            )}
                          </button>
                        </div>
                        {/* Summary */}
                        <p className="text-sm text-theme-primary">{sumResult.summary}</p>
                        {/* Key points */}
                        {sumResult.keyPoints.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-info-fg mb-1">要点</div>
                            <ul className="space-y-0.5">
                              {sumResult.keyPoints.map((p, i) => (
                                <li key={i} className="text-xs text-theme-secondary flex gap-1.5">
                                  <span className="text-info-fg flex-shrink-0">•</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Action items */}
                        {sumResult.actionItems.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-info-fg mb-1">
                              アクションアイテム
                            </div>
                            <ul className="space-y-0.5">
                              {sumResult.actionItems.map((a, i) => (
                                <li key={i} className="text-xs text-theme-secondary flex gap-1.5">
                                  <span className="text-warning-fg flex-shrink-0">▸</span>
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Keywords */}
                        {sumResult.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sumResult.keywords.map((kw, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-info-soft text-info-fg"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
