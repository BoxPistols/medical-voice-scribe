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

// ------ Types ------

interface VoiceGroup {
  id: string;
  text: string;
  createdAt: Date;
  label: string;
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

type FormatMode = "organize" | "summarize";

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
  // Groups
  const [groups, setGroups] = useState<VoiceGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
  const [summarizeResults, setSummarizeResults] = useState<Record<string, SummarizeResult>>({});
  const [aiError, setAiError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // UI
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [splitTarget, setSplitTarget] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);

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
        fullText += final;
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
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // already stopped or being disposed
        }
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
    };
    const partB: VoiceGroup = {
      id: generateId(),
      text: textB,
      createdAt: new Date(),
      label: `${group.label} (後半)`,
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
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
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

  const hasGroups = groups.length > 0;
  const canMerge = selectedIds.size >= 2;

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
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-teal-500 hover:bg-teal-600 text-white"
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
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-theme-tertiary hover:text-theme-secondary"
                }`}
              >
                整理
              </button>
              <button
                onClick={() => setFormatMode("summarize")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formatMode === "summarize"
                    ? "bg-purple-500 text-white shadow-sm"
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
                {processingAll ? "処理中..." : `全て${formatMode === "organize" ? "整理" : "要約"}`}
              </button>
            )}

            {/* Merge */}
            {canMerge && (
              <button
                onClick={mergeSelected}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all"
              >
                <ArrowsPointingInIcon className="w-3.5 h-3.5" />
                選択を結合 ({selectedIds.size})
              </button>
            )}

            {/* Model selector */}
            <div className="ml-auto relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                className="appearance-none bg-theme-card border border-theme-border rounded-lg pl-3 pr-7 py-1.5 text-[11px] text-theme-tertiary cursor-pointer hover:border-theme-border-hover focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="mt-2 text-[10px] text-theme-muted">
              Token: {tokenUsage.totalTokens.toLocaleString()} |
              ¥{tokenUsage.estimatedCostJPY.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {aiError && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} className="ml-2 text-red-400 hover:text-red-500">
            &times;
          </button>
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
            const sumResult = summarizeResults[group.id];
            const isSplitting = splitTarget === group.id;

            return (
              <div
                key={group.id}
                className={`rounded-xl border transition-all ${
                  isSelected
                    ? "border-teal-400 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 shadow-md"
                    : "border-theme-border bg-theme-card shadow-sm"
                } ${group.isRecording ? "ring-2 ring-red-400 ring-opacity-50" : ""}`}
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
                    className="w-4 h-4 rounded accent-teal-500 flex-shrink-0"
                  />

                  {/* Recording indicator */}
                  {group.isRecording && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  )}

                  {/* Label */}
                  <span className="font-medium text-sm text-theme-primary truncate">
                    {group.label}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[11px] text-theme-muted font-mono ml-1">
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
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                        整理済
                      </span>
                    )}
                    {sumResult && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                        要約済
                      </span>
                    )}
                    {isProcessing && (
                      <ArrowPathIcon className="w-3.5 h-3.5 text-teal-500 animate-spin" />
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
                    {/* Original text */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-theme-tertiary">
                          原文 ({group.text.length}文字)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyText(group.text, `orig-${group.id}`)}
                            className="p-1 rounded hover:bg-theme-surface text-theme-muted"
                            title="コピー"
                          >
                            {copiedId === `orig-${group.id}` ? (
                              <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
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
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 transition-all"
                        >
                          <DocumentTextIcon className="w-3.5 h-3.5" />
                          整理
                        </button>
                        <button
                          onClick={() => formatGroup(group.id, "summarize")}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-50 transition-all"
                        >
                          <SparklesIcon className="w-3.5 h-3.5" />
                          要約
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
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all ml-auto"
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
                          className="w-full accent-teal-500"
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
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-500 text-white hover:bg-teal-600 transition-all"
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
                      <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3 border border-blue-200 dark:border-blue-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
                            整理結果
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => applyOrganized(group.id)}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all"
                              title="整理結果を原文に適用"
                            >
                              適用
                            </button>
                            <button
                              onClick={() => copyText(orgResult.formatted, `org-${group.id}`)}
                              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
                            >
                              {copiedId === `org-${group.id}` ? (
                                <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <ClipboardDocumentIcon className="w-3.5 h-3.5 text-blue-400" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-theme-primary whitespace-pre-wrap">
                          {orgResult.formatted}
                        </div>
                        {orgResult.changes.length > 0 && (
                          <div className="text-[11px] text-blue-500 dark:text-blue-400">
                            変更点: {orgResult.changes.join("、")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summarize result */}
                    {sumResult && (
                      <div className="bg-purple-50 dark:bg-purple-950/50 rounded-lg p-3 border border-purple-200 dark:border-purple-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-300">
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
                            className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900"
                          >
                            {copiedId === `sum-${group.id}` ? (
                              <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <ClipboardDocumentIcon className="w-3.5 h-3.5 text-purple-400" />
                            )}
                          </button>
                        </div>
                        {/* Summary */}
                        <p className="text-sm text-theme-primary">{sumResult.summary}</p>
                        {/* Key points */}
                        {sumResult.keyPoints.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium text-purple-500 mb-1">要点</div>
                            <ul className="space-y-0.5">
                              {sumResult.keyPoints.map((p, i) => (
                                <li key={i} className="text-xs text-theme-secondary flex gap-1.5">
                                  <span className="text-purple-400 flex-shrink-0">•</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Action items */}
                        {sumResult.actionItems.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium text-purple-500 mb-1">
                              アクションアイテム
                            </div>
                            <ul className="space-y-0.5">
                              {sumResult.actionItems.map((a, i) => (
                                <li key={i} className="text-xs text-theme-secondary flex gap-1.5">
                                  <span className="text-amber-500 flex-shrink-0">▸</span>
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
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300"
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
