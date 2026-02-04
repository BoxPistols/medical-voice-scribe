"use client";

import { useState, useEffect, useRef } from "react";
import type { SoapNote, ModelId, TokenUsage } from "./api/analyze/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "./api/analyze/types";
import {
  MicrophoneIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  UserCircleIcon,
  PuzzlePieceIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  DocumentIcon,
  DocumentChartBarIcon,
} from "@heroicons/react/24/outline";
import { StopIcon as StopIconSolid } from "@heroicons/react/24/solid";

// Custom Keyboard Icon Component
const KeyboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M18 12h.01M10 12h.01M14 12h.01M8 15h8" />
  </svg>
);

// Types for Shortcuts
type ActionId =
  | "toggleRecording"
  | "analyze"
  | "clear"
  | "toggleSpeech"
  | "increaseSpeechRate"
  | "decreaseSpeechRate"
  | "import"
  | "exportJson"
  | "exportCsv"
  | "themeLight"
  | "themeDark"
  | "themeSystem"
  | "layoutLeft"
  | "layoutEqual"
  | "layoutRight"
  | "toggleSettings"
  | "toggleHelp";

interface ShortcutKey {
  key: string;
  ctrl?: boolean; // Ctrl or Cmd on Mac
  alt?: boolean;
  shift?: boolean;
  meta?: boolean; // Windows key on Windows
}

type ShortcutGroup = "basic" | "speech" | "file" | "theme" | "layout" | "other";

interface ShortcutDef {
  id: ActionId;
  label: string;
  default: ShortcutKey;
  modifierDefault?: ShortcutKey;
  group: ShortcutGroup;
}

const SHORTCUT_GROUPS: { id: ShortcutGroup; label: string }[] = [
  { id: "basic", label: "基本操作" },
  { id: "speech", label: "音声読み上げ" },
  { id: "file", label: "ファイル" },
  { id: "theme", label: "テーマ" },
  { id: "layout", label: "レイアウト" },
  { id: "other", label: "その他" },
];

const SHORTCUT_DEFS: ShortcutDef[] = [
  {
    id: "toggleRecording",
    label: "録音開始/停止",
    default: { key: "r" },
    modifierDefault: { key: "r", ctrl: true },
    group: "basic",
  },
  {
    id: "analyze",
    label: "カルテ生成",
    default: { key: "a" },
    modifierDefault: { key: "a", ctrl: true },
    group: "basic",
  },
  { id: "clear", label: "すべてクリア", default: { key: "c" }, group: "basic" },
  {
    id: "toggleSpeech",
    label: "開始/停止",
    default: { key: "v" },
    modifierDefault: { key: "v", ctrl: true },
    group: "speech",
  },
  {
    id: "increaseSpeechRate",
    label: "速度を上げる",
    default: { key: "=" },
    group: "speech",
  },
  {
    id: "decreaseSpeechRate",
    label: "速度を下げる",
    default: { key: "-" },
    group: "speech",
  },
  { id: "import", label: "インポート", default: { key: "i" }, group: "file" },
  { id: "exportJson", label: "JSON", default: { key: "j" }, group: "file" },
  { id: "exportCsv", label: "CSV", default: { key: "e" }, group: "file" },
  { id: "themeLight", label: "ライト", default: { key: "l" }, group: "theme" },
  { id: "themeDark", label: "ダーク", default: { key: "d" }, group: "theme" },
  { id: "themeSystem", label: "自動", default: { key: "m" }, group: "theme" },
  { id: "layoutLeft", label: "左重視", default: { key: "1" }, group: "layout" },
  { id: "layoutEqual", label: "均等", default: { key: "2" }, group: "layout" },
  {
    id: "layoutRight",
    label: "右重視",
    default: { key: "3" },
    group: "layout",
  },
  {
    id: "toggleSettings",
    label: "ショートカット設定",
    default: { key: "k" },
    group: "other",
  },
  { id: "toggleHelp", label: "ヘルプ", default: { key: "h" }, group: "other" },
];

// Constants
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Helper functions
const getTimestampForFilename = (): string => {
  // Returns format: 2026-02-03T14-30-45
  return new Date().toISOString().split(".")[0].replace(/:/g, "-");
};

const escapeCsvCell = (value: unknown): string => {
  return `"${String(value).replace(/"/g, '""')}"`;
};

// Web Speech API type definitions
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
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

// Helper to detect platform
const isMacPlatform = (): boolean => {
  if (typeof navigator === "undefined") return false;
  // Check both userAgent and platform for better compatibility
  return (
    /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  );
};

// Helper to get platform-specific defaults
const getPlatformDefaultShortcuts = (
  useModifiers: boolean = false
): Record<ActionId, ShortcutKey> => {
  const isMac = isMacPlatform();

  return SHORTCUT_DEFS.reduce((acc, def) => {
    // If useModifiers is true and a modifierDefault exists, use it. Otherwise use default.
    const sourceKey =
      useModifiers && def.modifierDefault ? def.modifierDefault : def.default;
    const key = { ...sourceKey };

    // Swap Ctrl for Meta on Mac for actions defined with Ctrl
    if (isMac && key.ctrl) {
      key.ctrl = false;
      key.meta = true;
    }
    return { ...acc, [def.id]: key };
  }, {} as Record<ActionId, ShortcutKey>);
};

// Shortcut helper
const formatShortcut = (
  shortcut: ShortcutKey | undefined,
  compact: boolean = false
): string => {
  if (!shortcut) return "-";

  const isMac = isMacPlatform();
  const parts = [];

  if (shortcut.meta) parts.push(isMac ? (compact ? "Cmd" : "Cmd") : "Win");
  if (shortcut.ctrl) parts.push(isMac ? (compact ? "Cmd" : "Cmd") : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? "Opt" : "Alt");
  if (shortcut.shift) parts.push("Shift");

  let keyDisplay = shortcut.key.toUpperCase();
  if (keyDisplay === " ") keyDisplay = "Space";
  parts.push(keyDisplay);

  return compact ? parts.join("+") : parts.join(" + ");
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SoapNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  // Token usage state
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // Resizable layout state (PC)
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Accordion state (Mobile)
  const [activePanel, setActivePanel] = useState<"transcript" | "result">(
    "transcript"
  );

  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSpeechSettings, setShowSpeechSettings] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);

  // Export/Import state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState<{
    type: "json" | "csv";
    content: string;
    filename: string;
  } | null>(null);

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Theme and settings state
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Clock and timer state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showClock, setShowClock] = useState(true);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  // AI Model selection state
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);

  // Shortcuts state
  const [useModifiers, setUseModifiers] = useState(true); // Default to true (Command+R etc)
  const [shortcuts, setShortcuts] = useState<Record<ActionId, ShortcutKey>>(
    () => {
      // Initial state will be updated in useEffect
      return SHORTCUT_DEFS.reduce(
        (acc, def) => ({ ...acc, [def.id]: def.default }),
        {} as Record<ActionId, ShortcutKey>
      );
    }
  );
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [editingShortcutId, setEditingShortcutId] = useState<ActionId | null>(
    null
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechCurrentIndexRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme management - Load from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("medical-scribe-theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Load modifier setting
    const savedUseModifiers = localStorage.getItem(
      "medical-scribe-use-modifiers"
    );
    if (savedUseModifiers !== null) {
      setUseModifiers(savedUseModifiers === "true");
    }

    // Load AI model setting
    const savedModel = localStorage.getItem(
      "medical-scribe-model"
    ) as ModelId | null;
    if (savedModel && AVAILABLE_MODELS.some((m) => m.id === savedModel)) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Save modifier setting
  useEffect(() => {
    localStorage.setItem("medical-scribe-use-modifiers", String(useModifiers));
  }, [useModifiers]);

  // Save AI model setting
  useEffect(() => {
    localStorage.setItem("medical-scribe-model", selectedModel);
  }, [selectedModel]);

  // Clock update - every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recording elapsed time update
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording && recordingStartTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime.getTime()) / 1000);
        setRecordingElapsed(elapsed);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, recordingStartTime]);

  // Load/Save clock visibility setting
  useEffect(() => {
    const savedShowClock = localStorage.getItem("medical-scribe-show-clock");
    if (savedShowClock !== null) {
      setShowClock(savedShowClock === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("medical-scribe-show-clock", String(showClock));
  }, [showClock]);

  // Theme management - Apply theme
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;

      if (theme === "system") {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        if (prefersDark) {
          root.setAttribute("data-theme", "dark");
        } else {
          root.removeAttribute("data-theme");
        }
      } else if (theme === "dark") {
        root.setAttribute("data-theme", "dark");
      } else {
        root.removeAttribute("data-theme");
      }

      localStorage.setItem("medical-scribe-theme", theme);
    };

    applyTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Shortcuts management - Load/Save
  useEffect(() => {
    // Clear old legacy shortcuts
    localStorage.removeItem("medical-scribe-shortcuts");
    localStorage.removeItem("medical-scribe-shortcuts-v2");
    localStorage.removeItem("medical-scribe-shortcuts-v3");

    const savedShortcuts = localStorage.getItem("medical-scribe-shortcuts-v4");
    const defaults = getPlatformDefaultShortcuts(useModifiers);

    if (savedShortcuts) {
      try {
        const parsed = JSON.parse(savedShortcuts);
        // Merge saved shortcuts with defaults to ensure all actions have a shortcut
        // If the saved shortcuts don't match the current mode (modifiers vs simple), we might want to reset
        // For now, we trust the user's saved preferences if they exist, but apply defaults for missing keys
        setShortcuts({ ...defaults, ...parsed });
      } catch (e) {
        console.error("Failed to parse shortcuts:", e);
        setShortcuts(defaults);
      }
    } else {
      setShortcuts(defaults);
    }
  }, [useModifiers]); // Re-load defaults when useModifiers changes

  useEffect(() => {
    localStorage.setItem(
      "medical-scribe-shortcuts-v4",
      JSON.stringify(shortcuts)
    );
  }, [shortcuts]);

  // Close shortcuts modal with Escape key
  useEffect(() => {
    if (!showShortcutsModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowShortcutsModal(false);
        setEditingShortcutId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showShortcutsModal]);

  // Close help modal with Escape key
  useEffect(() => {
    if (!showHelp) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowHelp(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showHelp]);

  useEffect(() => {
    setMounted(true);

    // Check screen size for responsive layout
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    const { webkitSpeechRecognition, SpeechRecognition } =
      window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;

    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ja-JP";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript + "。\n");
        }
      };

      recognitionRef.current = recognition;
    }

    // Load available voices for text-to-speech
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const japaneseVoices = voices.filter((voice) =>
        voice.lang.startsWith("ja")
      );
      setAvailableVoices(japaneseVoices);
      if (japaneseVoices.length > 0 && selectedVoiceIndex === 0) {
        setSelectedVoiceIndex(0);
      }
    };

    loadVoices();
    // Voices may load asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.removeEventListener("resize", checkScreenSize);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      // Stop speech synthesis on unmount
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
        } else if (showExportPreview) {
          setShowExportPreview(false);
          setExportPreviewData(null);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showHelp, showExportPreview]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu) {
        const target = event.target as HTMLElement;
        // Check if click is outside the export menu container
        if (!target.closest("[data-export-menu]")) {
          setShowExportMenu(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showExportMenu]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setRecordingStartTime(null);
      setRecordingElapsed(0);
    } else {
      recognitionRef.current?.start();
      setRecordingStartTime(new Date());
      setRecordingElapsed(0);
    }
    setIsRecording(!isRecording);
  };

  // Format time as HH:MM:SS
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // Format elapsed time as MM:SS or HH:MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleAnalyze = async () => {
    if (!transcript) return;
    setLoading(true);
    setIsStreaming(true);
    setStreamingText("");
    setError(null);
    setResult(null);
    setTokenUsage(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          stream: true,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "APIエラーが発生しました");
        setIsStreaming(false);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("ストリーミングレスポンスの取得に失敗しました");
        setIsStreaming(false);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = ""; // Buffer for incomplete SSE lines
      let streamCompleted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split by double newline (SSE message delimiter)
        const messages = buffer.split("\n\n");
        // Keep the last incomplete message in the buffer
        buffer = messages.pop() || "";

        for (const message of messages) {
          const lines = message.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  setError(data.error);
                  setIsStreaming(false);
                  setLoading(false);
                  return;
                }

                if (data.done) {
                  streamCompleted = true;
                  // Parse the accumulated JSON
                  try {
                    const parsedResult = JSON.parse(accumulatedText);
                    if (!parsedResult.soap) {
                      setError(
                        "AIの応答形式が不正です。もう一度お試しください。"
                      );
                    } else {
                      setResult(parsedResult);
                    }
                  } catch (parseError) {
                    console.error("JSON parse error:", parseError);
                    setError("AIの応答を解析できませんでした。");
                  }
                  // Save token usage if available
                  if (data.usage) {
                    setTokenUsage(data.usage);
                  }
                  setIsStreaming(false);
                  setLoading(false);
                  return;
                }

                if (data.content) {
                  accumulatedText += data.content;
                  setStreamingText(accumulatedText);
                }
              } catch {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }

      // Handle stream termination without explicit data.done
      if (!streamCompleted && accumulatedText) {
        try {
          const parsedResult = JSON.parse(accumulatedText);
          if (parsedResult.soap) {
            setResult(parsedResult);
          } else {
            setError("ストリームが予期せず終了しました。");
          }
        } catch {
          setError("ストリームが予期せず終了しました。");
        }
      }
    } catch (e) {
      console.error(e);
      setError(
        "エラーが発生しました。APIキーとネットワーク接続を確認してください。"
      );
    } finally {
      setIsStreaming(false);
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (!transcript && !result) return;

    const hasContent = transcript.length > 0 || result !== null;
    if (hasContent) {
      const confirmed = window.confirm(
        "入力内容と生成結果をすべて削除しますか？\nこの操作は取り消せません。"
      );
      if (!confirmed) return;
    }

    // Stop speech if speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    setTranscript("");
    setResult(null);
    setError(null);
  };

  // Theme and settings functions
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
  };

  const handleThemeCycle = () => {
    setTheme((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const handleResetSettings = () => {
    const confirmed = window.confirm(
      "すべての設定（テーマ・ショートカット）をリセットしますか？"
    );
    if (confirmed) {
      setTheme("system");
      localStorage.removeItem("medical-scribe-theme");

      // Reset shortcuts with platform defaults
      // Default to useModifiers = true on reset as per requirement
      setUseModifiers(true);
      localStorage.setItem("medical-scribe-use-modifiers", "true");

      const defaults = getPlatformDefaultShortcuts(true);
      setShortcuts(defaults);
      localStorage.removeItem("medical-scribe-shortcuts-v2");
      localStorage.removeItem("medical-scribe-shortcuts-v3");
      localStorage.removeItem("medical-scribe-shortcuts-v4");

      setSpeechRate(1.0);
      setSelectedVoiceIndex(0);
    }
  };

  const handleUseModifiersChange = (enabled: boolean) => {
    setUseModifiers(enabled);
    // When toggling, reset shortcuts to the defaults for that mode
    // Clear localStorage so useEffect doesn't restore old shortcuts
    localStorage.removeItem("medical-scribe-shortcuts-v4");
    const defaults = getPlatformDefaultShortcuts(enabled);
    setShortcuts(defaults);
  };

  const handleShortcutChange = (id: ActionId, key: ShortcutKey) => {
    setShortcuts((prev) => ({ ...prev, [id]: key }));
    setEditingShortcutId(null);
  };

  // Export/Import functions
  const exportAsJson = () => {
    if (!result) return;

    const dataStr = JSON.stringify(result, null, 2);
    const filename = `soap_note_${getTimestampForFilename()}.json`;

    setExportPreviewData({
      type: "json",
      content: dataStr,
      filename,
    });
    setShowExportPreview(true);
    setShowExportMenu(false);
  };

  const confirmExport = () => {
    if (!exportPreviewData) return;

    if (exportPreviewData.type === "json") {
      const blob = new Blob([exportPreviewData.content], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportPreviewData.filename;
      link.click();
      URL.revokeObjectURL(url);
    } else if (exportPreviewData.type === "csv") {
      const blob = new Blob(["\uFEFF" + exportPreviewData.content], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportPreviewData.filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    setShowExportPreview(false);
    setExportPreviewData(null);
  };

  const exportAsCsv = () => {
    if (!result) return;

    const csvRows = [
      ["項目", "内容"],
      ["要約", result.summary || ""],
      ["主訴", result.patientInfo?.chiefComplaint || ""],
      ["期間", result.patientInfo?.duration || ""],
      ["現病歴", result.soap.subjective?.presentIllness || ""],
      ["症状", result.soap.subjective?.symptoms?.join(", ") || ""],
      ["重症度", result.soap.subjective?.severity || ""],
      ["発症", result.soap.subjective?.onset || ""],
      [
        "随伴症状",
        result.soap.subjective?.associatedSymptoms?.join(", ") || "",
      ],
      ["既往歴", result.soap.subjective?.pastMedicalHistory || ""],
      ["内服薬", result.soap.subjective?.medications?.join(", ") || ""],
      ["血圧", result.soap.objective?.vitalSigns?.bloodPressure || ""],
      ["脈拍", result.soap.objective?.vitalSigns?.pulse || ""],
      ["体温", result.soap.objective?.vitalSigns?.temperature || ""],
      ["呼吸数", result.soap.objective?.vitalSigns?.respiratoryRate || ""],
      ["身体所見", result.soap.objective?.physicalExam || ""],
      ["検査所見", result.soap.objective?.laboratoryFindings || ""],
      ["診断名", result.soap.assessment?.diagnosis || ""],
      ["ICD-10", result.soap.assessment?.icd10 || ""],
      [
        "鑑別診断",
        result.soap.assessment?.differentialDiagnosis?.join(", ") || "",
      ],
      ["臨床的印象", result.soap.assessment?.clinicalImpression || ""],
      ["治療方針", result.soap.plan?.treatment || ""],
      [
        "処方薬",
        result.soap.plan?.medications
          ?.map((m) => {
            const parts = [
              m?.name,
              m?.dosage,
              m?.frequency,
              m?.duration,
            ].filter((p) => p !== undefined && p !== null && p !== "");
            return parts.join(" ");
          })
          .join("; ") || "",
      ],
      ["検査", result.soap.plan?.tests?.join(", ") || ""],
      ["紹介", result.soap.plan?.referral || ""],
      ["フォローアップ", result.soap.plan?.followUp || ""],
      ["患者教育", result.soap.plan?.patientEducation || ""],
    ];

    const csvContent = csvRows
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const filename = `soap_note_${getTimestampForFilename()}.csv`;

    setExportPreviewData({
      type: "csv",
      content: csvContent,
      filename,
    });
    setShowExportPreview(true);
    setShowExportMenu(false);
  };

  // Copy functions
  const copyToClipboard = async (text: string, label: string = "カルテ") => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label}をクリップボードにコピーしました`);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("コピーに失敗しました");
    }
  };

  const copyFullChart = () => {
    if (!result) return;
    const fullText = extractTextFromSoap(result);
    copyToClipboard(fullText, "全体カルテ");
  };

  const copySectionS = () => {
    if (!result) return;
    let text = "【主観的情報 (Subjective)】\n\n";
    if (result.soap.subjective?.presentIllness) {
      text += `現病歴:\n${result.soap.subjective.presentIllness}\n\n`;
    }
    if (
      result.soap.subjective?.symptoms &&
      result.soap.subjective.symptoms.length > 0
    ) {
      text += `症状:\n${result.soap.subjective.symptoms
        .map((s) => `• ${s}`)
        .join("\n")}\n\n`;
    }
    if (result.soap.subjective?.severity) {
      text += `重症度: ${result.soap.subjective.severity}\n\n`;
    }
    if (result.soap.subjective?.pastMedicalHistory) {
      text += `既往歴:\n${result.soap.subjective.pastMedicalHistory}\n`;
    }
    copyToClipboard(text, "Sセクション");
  };

  const copySectionO = () => {
    if (!result) return;
    let text = "【客観的情報 (Objective)】\n\n";
    if (result.soap.objective?.vitalSigns) {
      text += "バイタルサイン:\n";
      const vs = result.soap.objective.vitalSigns;
      if (vs.bloodPressure) text += `• 血圧: ${vs.bloodPressure}\n`;
      if (vs.pulse) text += `• 脈拍: ${vs.pulse}\n`;
      if (vs.temperature) text += `• 体温: ${vs.temperature}\n`;
      if (vs.respiratoryRate) text += `• 呼吸数: ${vs.respiratoryRate}\n`;
      text += "\n";
    }
    if (result.soap.objective?.physicalExam) {
      text += `身体所見:\n${result.soap.objective.physicalExam}\n`;
    }
    copyToClipboard(text, "Oセクション");
  };

  const copySectionA = () => {
    if (!result) return;
    let text = "【評価・診断 (Assessment)】\n\n";
    if (result.soap.assessment?.diagnosis) {
      text += `診断名: ${result.soap.assessment.diagnosis}\n`;
      if (result.soap.assessment.icd10) {
        text += `ICD-10: ${result.soap.assessment.icd10}\n`;
      }
      text += "\n";
    }
    if (
      result.soap.assessment?.differentialDiagnosis &&
      result.soap.assessment.differentialDiagnosis.length > 0
    ) {
      text += `鑑別診断:\n${result.soap.assessment.differentialDiagnosis
        .map((d) => `• ${d}`)
        .join("\n")}\n\n`;
    }
    if (result.soap.assessment?.clinicalImpression) {
      text += `臨床的評価:\n${result.soap.assessment.clinicalImpression}\n`;
    }
    copyToClipboard(text, "Aセクション");
  };

  const copySectionP = () => {
    if (!result) return;
    let text = "【計画 (Plan)】\n\n";
    if (result.soap.plan?.treatment) {
      text += `治療方針:\n${result.soap.plan.treatment}\n\n`;
    }
    if (
      result.soap.plan?.medications &&
      result.soap.plan.medications.length > 0
    ) {
      text += "処方:\n";
      result.soap.plan.medications.forEach((med, i) => {
        text += `${i + 1}. ${med.name || ""}\n`;
        if (med.dosage) text += `   用量: ${med.dosage}\n`;
        if (med.frequency) text += `   頻度: ${med.frequency}\n`;
        if (med.duration) text += `   期間: ${med.duration}\n`;
      });
      text += "\n";
    }
    if (result.soap.plan?.followUp) {
      text += `フォローアップ:\n${result.soap.plan.followUp}\n`;
    }
    copyToClipboard(text, "Pセクション");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。"
      );
      return;
    }

    // Only accept JSON files
    if (!file.name.endsWith(".json")) {
      setError("JSON形式のファイルのみインポート可能です。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error("ファイルの内容が空です。");
        }

        const imported = JSON.parse(content);

        // Validate that imported is an object
        if (typeof imported !== "object" || imported === null) {
          throw new Error("無効なJSON形式です。");
        }

        // Schema validation
        if (!imported.soap || !imported.patientInfo) {
          throw new Error(
            "SOAPノート形式が正しくありません。soapまたはpatientInfoが見つかりません。"
          );
        }

        // Validate required SOAP sections
        if (
          !imported.soap.subjective ||
          !imported.soap.objective ||
          !imported.soap.assessment ||
          !imported.soap.plan
        ) {
          throw new Error("必須のSOAPセクション（S/O/A/P）が不足しています。");
        }

        // Validate that SOAP sections have the correct structure
        if (
          typeof imported.soap.subjective !== "object" ||
          typeof imported.soap.objective !== "object" ||
          typeof imported.soap.assessment !== "object" ||
          typeof imported.soap.plan !== "object"
        ) {
          throw new Error("SOAPセクションの構造が正しくありません。");
        }

        setResult(imported as SoapNote);
        setError(null);

        // Switch to result panel on mobile
        if (!isLargeScreen) {
          setActivePanel("result");
        }
      } catch (err) {
        console.error("Import error:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "ファイルの読み込みに失敗しました。";

        // Handle JSON syntax errors specifically
        if (err instanceof SyntaxError) {
          setError(
            "ファイルの読み込みに失敗しました。正しいJSON形式のSOAPカルテファイルか確認してください。"
          );
        } else {
          setError(errorMessage);
        }
      }
    };

    reader.onerror = () => {
      setError("ファイルの読み込みに失敗しました。");
    };

    reader.readAsText(file);

    // Reset input to allow re-importing the same file
    event.target.value = "";
  };

  // Text-to-speech functions
  const extractTextFromSoap = (soapNote: SoapNote): string => {
    let text = "";

    // Summary
    if (soapNote.summary) {
      text += `要約。${soapNote.summary}\n\n`;
    }

    // Patient Info
    if (soapNote.patientInfo) {
      text += "患者情報。";
      if (soapNote.patientInfo.chiefComplaint) {
        text += `主訴、${soapNote.patientInfo.chiefComplaint}。`;
      }
      if (soapNote.patientInfo.duration) {
        text += `期間、${soapNote.patientInfo.duration}。`;
      }
      text += "\n\n";
    }

    // Subjective
    text += "S、主観的情報。";
    if (soapNote.soap.subjective?.presentIllness) {
      text += `現病歴、${soapNote.soap.subjective.presentIllness}。`;
    }
    if (soapNote.soap.subjective?.symptoms?.length > 0) {
      text += `症状、${soapNote.soap.subjective.symptoms.join("、")}。`;
    }
    if (soapNote.soap.subjective?.severity) {
      text += `重症度、${soapNote.soap.subjective.severity}。`;
    }
    text += "\n\n";

    // Objective
    text += "O、客観的情報。";
    if (soapNote.soap.objective?.vitalSigns) {
      const vs = soapNote.soap.objective.vitalSigns;
      text += `バイタルサイン、血圧${vs.bloodPressure}、脈拍${vs.pulse}、体温${vs.temperature}、呼吸数${vs.respiratoryRate}。`;
    }
    if (soapNote.soap.objective?.physicalExam) {
      text += `身体所見、${soapNote.soap.objective.physicalExam}。`;
    }
    text += "\n\n";

    // Assessment
    text += "A、評価・診断。";
    if (soapNote.soap.assessment?.diagnosis) {
      text += `診断名、${soapNote.soap.assessment.diagnosis}。`;
    }
    if (soapNote.soap.assessment?.differentialDiagnosis?.length > 0) {
      text += `鑑別診断、${soapNote.soap.assessment.differentialDiagnosis.join(
        "、"
      )}。`;
    }
    text += "\n\n";

    // Plan
    text += "P、治療計画。";
    if (soapNote.soap.plan?.treatment) {
      text += `治療方針、${soapNote.soap.plan.treatment}。`;
    }
    if (soapNote.soap.plan?.medications?.length > 0) {
      text += "処方、";
      soapNote.soap.plan.medications.forEach((med, i) => {
        text += `${i + 1}、${med.name}、用量${med.dosage}、用法${
          med.frequency
        }、期間${med.duration}。`;
      });
    }
    if (soapNote.soap.plan?.followUp) {
      text += `フォローアップ、${soapNote.soap.plan.followUp}。`;
    }

    return text;
  };

  // Helper to play System TTS from a specific index
  const playSystemTTS = (text: string, startIndex: number = 0) => {
    // Prevent existing utterance from triggering onend/onerror which might disable isSpeaking unexpectedly
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.onend = null;
      speechSynthesisRef.current.onerror = null;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    const textToSpeak = text.substring(startIndex);
    if (!textToSpeak) {
      setIsSpeaking(false);
      speechCurrentIndexRef.current = 0;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ja-JP";
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    if (availableVoices.length > 0 && availableVoices[selectedVoiceIndex]) {
      utterance.voice = availableVoices[selectedVoiceIndex];
    }

    utterance.onboundary = (event) => {
      // Update current index (absolute position in original text)
      // event.charIndex is relative to the text segment being spoken
      speechCurrentIndexRef.current = startIndex + event.charIndex;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
      speechCurrentIndexRef.current = 0;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const toggleSpeech = () => {
    if (!result) return;

    if (isSpeaking) {
      // Stop speaking
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
      speechCurrentIndexRef.current = 0;
    } else {
      const text = extractTextFromSoap(result);
      speechCurrentIndexRef.current = 0;
      playSystemTTS(text, 0);
    }
  };

  // Effect: Handle real-time Speech Rate changes
  useEffect(() => {
    if (!isSpeaking || !result) return;

    // Restart System TTS from current position with new rate
    const text = extractTextFromSoap(result);
    playSystemTTS(text, speechCurrentIndexRef.current);
  }, [speechRate]);

  // Effect: Handle real-time Voice changes (System)
  useEffect(() => {
    if (!isSpeaking || !result) return;

    // Restart System TTS from current position with new voice
    // Add a small delay to ensure previous speech is cancelled properly
    const text = extractTextFromSoap(result);
    const currentIndex = speechCurrentIndexRef.current;

    const timer = setTimeout(() => {
      playSystemTTS(text, currentIndex);
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedVoiceIndex, availableVoices]);

  // Layout presets
  const setLayoutPreset = (preset: "equal" | "left" | "right") => {
    setIsTransitioning(true);
    switch (preset) {
      case "equal":
        setLeftWidth(50);
        break;
      case "left":
        setLeftWidth(65);
        break;
      case "right":
        setLeftWidth(35);
        break;
    }
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Shortcut editing listener
  useEffect(() => {
    if (!editingShortcutId) return;

    const handleEditKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape
      if (e.key === "Escape") {
        setEditingShortcutId(null);
        return;
      }

      // Ignore modifier keys alone
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      const newShortcut: ShortcutKey = {
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      };

      setShortcuts((prev) => ({
        ...prev,
        [editingShortcutId]: newShortcut,
      }));
      setEditingShortcutId(null);
    };

    window.addEventListener("keydown", handleEditKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleEditKeyDown, {
        capture: true,
      });
  }, [editingShortcutId]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ignore if editing a shortcut
      if (editingShortcutId) return;

      // Find matching shortcut
      const actionId = (Object.keys(shortcuts) as ActionId[]).find((id) => {
        const s = shortcuts[id];
        return (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          !!e.ctrlKey === !!s.ctrl &&
          !!e.altKey === !!s.alt &&
          !!e.shiftKey === !!s.shift &&
          !!e.metaKey === !!s.meta
        );
      });

      if (actionId) {
        // Validation for input fields:
        // If in input/textarea, ONLY allow shortcuts that use modifiers (Ctrl/Alt/Meta)
        // AND specifically allow the user's requested actions even in inputs
        const s = shortcuts[actionId];
        const hasModifier = s.ctrl || s.alt || s.meta;

        if (isInput && !hasModifier) {
          // If typing and shortcut has no modifiers, ignore shortcut to allow typing
          return;
        }

        // Prevent default browser actions for specific shortcuts that conflict
        // e.g., Cmd+R (Reload) or Cmd+A (Select All) if they are mapped to actions
        // Only prevent if we are actually handling the shortcut
        e.preventDefault();

        switch (actionId) {
          case "toggleRecording":
            toggleRecording();
            break;
          case "analyze":
            handleAnalyze();
            break;
          case "clear":
            handleClear();
            break;
          case "toggleSpeech":
            toggleSpeech();
            break;
          case "increaseSpeechRate": {
            const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIndex = rates.indexOf(speechRate);
            if (currentIndex < rates.length - 1) {
              setSpeechRate(rates[currentIndex + 1]);
            }
            break;
          }
          case "decreaseSpeechRate": {
            const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIndex = rates.indexOf(speechRate);
            if (currentIndex > 0) {
              setSpeechRate(rates[currentIndex - 1]);
            }
            break;
          }
          case "import":
            fileInputRef.current?.click();
            break;
          case "exportJson":
            exportAsJson();
            break;
          case "exportCsv":
            exportAsCsv();
            break;
          case "themeLight":
            handleThemeChange("light");
            break;
          case "themeDark":
            handleThemeChange("dark");
            break;
          case "themeSystem":
            handleThemeChange("system");
            break;
          case "layoutLeft":
            if (isLargeScreen) setLayoutPreset("left");
            break;
          case "layoutEqual":
            if (isLargeScreen) setLayoutPreset("equal");
            break;
          case "layoutRight":
            if (isLargeScreen) setLayoutPreset("right");
            break;
          case "toggleSettings":
            setShowShortcutsModal((prev) => !prev);
            break;
          case "toggleHelp":
            setShowHelp((prev) => !prev);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shortcuts,
    editingShortcutId,
    isRecording,
    transcript,
    loading,
    result,
    isSpeaking,
    showShortcutsModal,
    showHelp,
    isLargeScreen,
    theme,
    availableVoices,
    selectedVoiceIndex,
    speechRate,
  ]); // Add all dependencies used in actions

  // Resizer handlers
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 30% and 70%
      if (newLeftWidth >= 30 && newLeftWidth <= 70) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Minimal header - sticky */}
      <header className="app-header flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-12 sm:h-14">
            {/* Branding + Clock */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <MicrophoneIcon
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <h1 className="text-sm sm:text-lg font-bold text-theme-primary leading-none truncate">
                    Medical Voice Scribe
                  </h1>
                  <p className="text-xs text-theme-secondary font-medium mt-0.5">
                    AI音声問診・カルテ自動生成
                  </p>
                </div>
              </div>

              {/* Clock and Recording Timer - next to logo */}
              {mounted && showClock && (
                <div className="flex flex-col items-center">
                  <time
                    className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400 dark:text-gray-500 font-mono tabular-nums"
                    dateTime={currentTime.toISOString()}
                    aria-label="現在時刻"
                    suppressHydrationWarning
                  >
                    {formatTime(currentTime)}
                  </time>
                  {isRecording && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-xs font-mono text-orange-500 tabular-nums">
                        {formatElapsedTime(recordingElapsed)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-3">
              <div
                className={`status-badge ${isRecording ? "recording" : "idle"}`}
              >
                <div
                  className={`status-indicator ${
                    isRecording ? "recording" : "idle"
                  } ${isRecording ? "recording-pulse" : ""}`}
                />
                {isRecording ? "録音中" : "待機中"}
              </div>

              {/* AI Model selector */}
              <div className="relative group">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                  className="appearance-none bg-theme-card border border-theme-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-theme-primary cursor-pointer hover:border-theme-border-hover focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="AIモデル選択"
                  title={(() => {
                    const m = AVAILABLE_MODELS.find(m => m.id === selectedModel);
                    return m ? `${m.name}\n${m.description}\n速度: ${'⚡'.repeat(m.speed)} 品質: ${'★'.repeat(m.quality)}` : '';
                  })()}
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id} title={`${model.description} | 速度:${model.speed}/5 品質:${model.quality}/5`}>
                      {model.name} ({model.description})
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary pointer-events-none"
                  aria-hidden="true"
                />
                {/* Model info tooltip */}
                <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-3 bg-theme-card border border-theme-border rounded-lg shadow-lg text-xs">
                  <div className="font-semibold text-theme-primary mb-2">モデル比較</div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-theme-tertiary">
                        <th className="text-left pb-1">モデル</th>
                        <th className="text-center pb-1">速度</th>
                        <th className="text-center pb-1">品質</th>
                      </tr>
                    </thead>
                    <tbody className="text-theme-secondary">
                      {AVAILABLE_MODELS.map((m) => (
                        <tr key={m.id} className={m.id === selectedModel ? 'text-theme-primary font-medium' : ''}>
                          <td className="py-0.5">{m.name.replace('GPT-', '')}</td>
                          <td className="text-center">{'⚡'.repeat(m.speed)}</td>
                          <td className="text-center">{'★'.repeat(m.quality)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Icon buttons - unified grid */}
              <div className="flex items-center">
                {/* Shortcut settings button */}
                <button
                  onClick={() => setShowShortcutsModal(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-theme-tertiary btn-theme-hover"
                  aria-label="キーボード設定"
                  data-tooltip="ショートカット設定"
                >
                  <KeyboardIcon className="w-6 h-6" aria-hidden="true" />
                </button>

                {/* Theme toggle button */}
                <button
                  onClick={handleThemeCycle}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-theme-tertiary btn-theme-hover"
                  aria-label="テーマ切り替え"
                  data-tooltip={`テーマ: ${
                    theme === "system"
                      ? "自動"
                      : theme === "light"
                      ? "ライト"
                      : "ダーク"
                  }`}
                >
                  {theme === "light" && (
                    <SunIcon className="w-6 h-6" aria-hidden="true" />
                  )}
                  {theme === "dark" && (
                    <MoonIcon className="w-6 h-6" aria-hidden="true" />
                  )}
                  {theme === "system" && (
                    <ComputerDesktopIcon
                      className="w-6 h-6"
                      aria-hidden="true"
                    />
                  )}
                </button>

                {/* Help button */}
                <button
                  onClick={() => setShowHelp(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-theme-tertiary btn-theme-hover"
                  aria-label="ヘルプを表示"
                  data-tooltip="ヘルプ"
                >
                  <QuestionMarkCircleIcon
                    className="w-6 h-6"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Mobile menu */}
            <div className="sm:hidden flex items-center gap-1">
              <div
                className={`status-indicator flex-shrink-0 ${
                  isRecording ? "recording recording-pulse" : "idle"
                }`}
              />

              {/* AI Model selector (Mobile) - compact */}
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                  className="appearance-none bg-theme-card border border-theme-border rounded-lg pl-2 pr-6 py-1 text-sm text-theme-primary cursor-pointer"
                  aria-label="AIモデル選択"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name.replace('GPT-', '')}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-tertiary pointer-events-none"
                  aria-hidden="true"
                />
              </div>

              {/* Theme toggle button (Mobile) */}
              <button
                onClick={handleThemeCycle}
                className="p-1 rounded-lg text-theme-tertiary btn-theme-hover"
                aria-label="テーマ切り替え"
              >
                {theme === "light" && (
                  <SunIcon className="w-4 h-4" aria-hidden="true" />
                )}
                {theme === "dark" && (
                  <MoonIcon className="w-4 h-4" aria-hidden="true" />
                )}
                {theme === "system" && (
                  <ComputerDesktopIcon className="w-4 h-4" aria-hidden="true" />
                )}
              </button>

              <button
                onClick={() => setShowHelp(true)}
                className="p-1 rounded-lg text-theme-tertiary btn-theme-hover"
                aria-label="ヘルプ"
              >
                <QuestionMarkCircleIcon
                  className="w-4 h-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col flex-1 overflow-hidden w-full">
          {/* Control panel */}
          <div className={`mb-2 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={toggleRecording}
                  className={`btn btn-record ${isRecording ? "recording" : ""}`}
                  aria-label={isRecording ? "録音を停止" : "録音を開始"}
                  aria-pressed={isRecording}
                  data-tooltip={isRecording ? "録音を停止" : "音声入力を開始"}
                >
                  {isRecording ? (
                    <StopIcon className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4" aria-hidden="true" />
                  )}
                  {isRecording ? "停止" : "録音"}
                  <span className="hidden sm:inline text-xs opacity-70 ml-1">
                    [{formatShortcut(shortcuts.toggleRecording, true)}]
                  </span>
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !transcript}
                  className="btn btn-primary"
                  aria-label="SOAPカルテを生成"
                  data-tooltip="AIでSOAP形式カルテを生成"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" aria-hidden="true" />
                      カルテ生成
                      <span className="hidden sm:inline text-xs opacity-70 ml-1">
                        [{formatShortcut(shortcuts.analyze, true)}]
                      </span>
                    </>
                  )}
                </button>

                {/* Clear button - モバイルでは横並び */}
                <button
                  onClick={handleClear}
                  disabled={!transcript && !result}
                  className="btn btn-secondary"
                  aria-label="すべてクリア"
                  data-tooltip="入力とカルテをすべて削除"
                >
                  <TrashIcon className="w-4 h-4" aria-hidden="true" />
                  クリア
                  <span className="hidden sm:inline text-xs opacity-70 ml-1">
                    [{formatShortcut(shortcuts.clear, true)}]
                  </span>
                </button>

                {/* Character count - デスクトップのみ */}
                {transcript && (
                  <div className="hidden sm:block text-sm text-theme-tertiary font-mono ml-2">
                    {transcript.length} 文字
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Two-column layout - Desktop: Resizable, Mobile: Accordion */}
          <div
            ref={containerRef}
            className="relative flex flex-col lg:flex-row gap-0 flex-1 overflow-hidden"
          >
            {/* Left: Transcript input */}
            <section
              className={`${
                mounted ? "animate-fade-in delay-100" : "opacity-0"
              } flex-shrink-0 overflow-hidden flex flex-col ${
                !isLargeScreen && activePanel !== "transcript"
                  ? "hidden"
                  : "flex"
              }`}
              style={{
                width: isLargeScreen ? `${leftWidth}%` : "100%",
                transition: isTransitioning
                  ? "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              }}
              aria-label="会話入力"
            >
              <div className="panel h-full flex flex-col lg:mr-0 overflow-hidden">
                <div className="panel-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="panel-title">会話テキスト</h2>
                      {/* Shortcut mode toggle - デスクトップのみ */}
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-theme-secondary">
                        <button
                          onClick={() =>
                            handleUseModifiersChange(!useModifiers)
                          }
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
                            useModifiers
                              ? "bg-teal-600"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                          role="switch"
                          aria-checked={useModifiers}
                          aria-label="入力中もショートカット有効"
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              useModifiers ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-theme-tertiary">
                          {useModifiers ? (
                            <>入力中もショートカット有効</>
                          ) : (
                            <>入力中はショートカット無効</>
                          )}
                        </span>
                      </div>
                    </div>
                    {/* Mobile accordion toggle */}
                    {!isLargeScreen && (
                      <button
                        onClick={() => setActivePanel("result")}
                        className="btn btn-secondary py-1 px-3 text-xs"
                        aria-label="SOAPカルテを表示"
                        data-tooltip="カルテ表示に切り替え"
                      >
                        <ArrowRightIcon className="w-4 h-4" />
                        カルテ表示
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 p-0 relative overflow-hidden">
                  <label htmlFor="transcript-input" className="sr-only">
                    音声文字起こし - 音声入力または直接入力
                  </label>
                  <textarea
                    id="transcript-input"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="transcript-textarea h-full p-6"
                    placeholder="録音ボタンを押して会話を記録...&#10;&#10;または直接入力:&#10;医師: 今日はどうされましたか？&#10;患者: 最近、頭痛がひどくて..."
                    spellCheck={false}
                    aria-describedby="transcript-help"
                  />
                  <span id="transcript-help" className="sr-only">
                    この領域は音声文字起こしを記録するか、手動でのテキスト入力を受け付けます
                  </span>
                </div>
              </div>
            </section>

            {/* Resizer handle - Desktop only */}
            {isLargeScreen && (
              <div
                className="relative flex-shrink-0"
                style={{ width: "48px" }}
                role="separator"
                aria-label="レイアウト調整"
              >
                {/* Layout preset buttons - Top positioned */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-10">
                  <button
                    onClick={() => setLayoutPreset("left")}
                    className="layout-btn group"
                    title="左側を広く"
                    aria-label="左側を広くする"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="10"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                      <rect
                        x="15"
                        y="5"
                        width="6"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => setLayoutPreset("equal")}
                    className="layout-btn group"
                    title="均等"
                    aria-label="左右を均等にする"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="8"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                      <rect
                        x="13"
                        y="5"
                        width="8"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => setLayoutPreset("right")}
                    className="layout-btn group"
                    title="右側を広く"
                    aria-label="右側を広くする"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="6"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                      <rect
                        x="11"
                        y="5"
                        width="10"
                        height="14"
                        className="group-hover:fill-teal-50"
                      />
                    </svg>
                  </button>
                </div>

                {/* Draggable divider - Full height */}
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-col-resize group"
                  onMouseDown={handleMouseDown}
                  style={{ pointerEvents: isTransitioning ? "none" : "auto" }}
                >
                  {/* Visual line */}
                  <div className="resize-handle-line">
                    {/* Grip dots in center */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
                      <div className="resize-handle-dot" />
                      <div className="resize-handle-dot" />
                      <div className="resize-handle-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right: SOAP results */}
            <section
              className={`${
                mounted ? "animate-fade-in delay-200" : "opacity-0"
              } flex-1 overflow-hidden flex flex-col ${
                !isLargeScreen && activePanel !== "result" ? "hidden" : "flex"
              }`}
              style={{
                transition: isTransitioning
                  ? "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              }}
              aria-label="SOAPカルテ結果"
            >
              <div className="panel h-full flex flex-col lg:ml-0 overflow-hidden">
                <div className="panel-header">
                  <div className="flex items-center justify-between">
                    {/* Mobile layout - 1行に横並び */}
                    {!isLargeScreen ? (
                      <div className="w-full flex items-center justify-between gap-2">
                        {/* 左: 戻るボタン */}
                        <button
                          onClick={() => setActivePanel("transcript")}
                          className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1 shrink-0"
                          aria-label="会話テキストに戻る"
                          data-tooltip="会話テキストに戻る"
                        >
                          <ArrowLeftIcon className="w-4 h-4" />
                          <span>会話</span>
                        </button>
                        {/* 右: アクションボタン群 */}
                        <div className="flex items-center gap-1">
                          {/* Import button */}
                          <button
                            onClick={handleImportClick}
                            className="btn btn-secondary py-1 px-2 text-xs"
                            aria-label="インポート"
                            data-tooltip="JSON形式でインポート"
                          >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                          </button>

                          {/* Export dropdown */}
                          <div className="relative" data-export-menu>
                            <button
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              disabled={!result}
                              className="btn btn-secondary py-1 px-2 text-xs"
                              aria-label="エクスポート"
                              data-tooltip="JSON/CSV形式でエクスポート"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" />
                            </button>

                            {showExportMenu && result && (
                              <div className="absolute right-0 mt-2 w-40 bg-theme-surface rounded-md shadow-lg border border-theme-glass z-50">
                                <div className="py-1">
                                  <button
                                    onClick={exportAsJson}
                                    className="w-full text-left px-3 py-2 text-xs text-theme-primary hover:bg-theme-card flex items-center gap-2"
                                  >
                                    <DocumentIcon className="w-3 h-3" />
                                    JSON
                                  </button>
                                  <button
                                    onClick={exportAsCsv}
                                    className="w-full text-left px-3 py-2 text-xs text-theme-primary hover:bg-theme-card flex items-center gap-2"
                                  >
                                    <DocumentChartBarIcon className="w-3 h-3" />
                                    CSV
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={toggleSpeech}
                            disabled={!result}
                            className="btn btn-secondary py-1 px-2 text-xs"
                            aria-label={
                              isSpeaking ? "読み上げを停止" : "カルテを読み上げ"
                            }
                            data-tooltip={
                              isSpeaking
                                ? "読み上げ停止"
                                : "カルテを音声で読み上げ"
                            }
                          >
                            {isSpeaking ? (
                              <StopIconSolid className="w-4 h-4" />
                            ) : (
                              <SpeakerWaveIcon className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setShowSpeechSettings(!showSpeechSettings)
                            }
                            disabled={!result}
                            className="btn btn-secondary py-1 px-2 text-xs"
                            aria-label="音声設定"
                            data-tooltip="音声・速度設定"
                          >
                            <ChevronDownIcon
                              className={`w-4 h-4 transition-transform ${
                                showSpeechSettings ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-between">
                        {/* 左: 見出し - デスクトップのみ表示 */}
                        <h2 className="hidden sm:block panel-title whitespace-nowrap text-sm">カルテ</h2>

                        {/* 中央: Voice */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={toggleSpeech}
                            disabled={!result}
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            aria-label={isSpeaking ? "読み上げを停止" : "カルテを読み上げ"}
                            data-tooltip={`読み上げ [${formatShortcut(shortcuts.toggleSpeech, true)}]`}
                          >
                            {isSpeaking ? (
                              <StopIconSolid className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <SpeakerWaveIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span className="text-xs">Voice</span>
                            <span className="hidden sm:inline text-xs opacity-70 ml-0.5">
                              [{formatShortcut(shortcuts.toggleSpeech, true)}]
                            </span>
                          </button>
                          <button
                            onClick={() => setShowSpeechSettings(!showSpeechSettings)}
                            disabled={!result}
                            className="btn btn-secondary text-xs p-1"
                            aria-label="音声設定"
                            data-tooltip="音声設定"
                          >
                            <ChevronDownIcon
                              className={`w-3 h-3 transition-transform ${showSpeechSettings ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        {/* 右: ファイル操作 + コピー */}
                        <div className="flex items-center gap-1">
                          {/* Import button */}
                          <button
                            onClick={handleImportClick}
                            className="btn btn-secondary text-xs py-0.5 px-1.5"
                            aria-label="カルテをインポート"
                            data-tooltip="インポート"
                          >
                            <ArrowUpTrayIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          {/* Export dropdown */}
                          <div className="relative" data-export-menu>
                            <button
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              disabled={!result}
                              className="btn btn-secondary text-xs py-0.5 px-1.5"
                              aria-label="カルテをエクスポート"
                              data-tooltip="エクスポート"
                            >
                              <ArrowDownTrayIcon className="w-3.5 h-3.5" aria-hidden="true" />
                              <ChevronDownIcon
                                className={`w-3 h-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                                aria-hidden="true"
                              />
                            </button>

                            {/* Export menu dropdown */}
                            {showExportMenu && result && (
                              <div className="absolute right-0 mt-2 w-40 bg-theme-surface rounded-md shadow-lg border border-theme-glass z-50">
                                <div className="py-1">
                                  <button
                                    onClick={exportAsJson}
                                    className="w-full text-left px-4 py-2 text-sm text-theme-primary hover:bg-theme-card flex items-center gap-2"
                                  >
                                    <DocumentIcon className="w-4 h-4" />
                                    JSON
                                  </button>
                                  <button
                                    onClick={exportAsCsv}
                                    className="w-full text-left px-4 py-2 text-sm text-theme-primary hover:bg-theme-card flex items-center gap-2"
                                  >
                                    <DocumentChartBarIcon className="w-4 h-4" />
                                    CSV
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Copy button */}
                          <button
                            onClick={copyFullChart}
                            disabled={!result}
                            className="btn btn-secondary text-xs py-0.5 px-1.5"
                            aria-label="カルテ全体をコピー"
                            data-tooltip="コピー"
                          >
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Speech settings panel */}
                  {showSpeechSettings && result && (
                    <div className="border-b border-theme-border bg-theme-card px-6 py-4">
                      <div className="space-y-4">
                        {/* Service Selection */}
                        {/* Speed selection */}
                        <div>
                          <label className="block text-xs font-semibold text-theme-secondary mb-2">
                            読み上げスピード
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => setSpeechRate(rate)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                  speechRate === rate
                                    ? "bg-theme-active"
                                    : "bg-theme-surface text-theme-primary border border-theme-border hover:bg-theme-card"
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Voice selection */}
                        {availableVoices.length > 0 && (
                          <div>
                            <label
                              htmlFor="voice-select"
                              className="block text-xs font-semibold text-theme-secondary mb-2"
                            >
                              システム音声の選択
                            </label>
                            <select
                              id="voice-select"
                              value={selectedVoiceIndex}
                              onChange={(e) =>
                                setSelectedVoiceIndex(Number(e.target.value))
                              }
                              className="w-full px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-primary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                              {availableVoices.map((voice, index) => (
                                <option key={index} value={index}>
                                  {voice.name} ({voice.lang})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Error state */}
                  {error && (
                    <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-red-900 mb-1">
                            エラー
                          </h4>
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="text-red-600 hover:text-red-800"
                          aria-label="エラーメッセージを閉じる"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!result && !loading && !error && (
                    <div className="empty-state">
                      <DocumentTextIcon
                        className="empty-state-icon"
                        aria-hidden="true"
                      />
                      <p className="empty-state-text">
                        まだ解析されていません
                        <br />
                        会話を録音してSOAPカルテを生成してください
                      </p>
                    </div>
                  )}

                  {/* Loading/Streaming state */}
                  {loading && (
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="loading-spinner animate-spin"
                          style={{
                            width: "1.5rem",
                            height: "1.5rem",
                            borderWidth: "2px",
                          }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {isStreaming
                            ? "リアルタイム生成中..."
                            : "解析準備中..."}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                        </span>
                      </div>
                      {isStreaming && streamingText && (
                        <div
                          className="rounded-lg p-4 border"
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            borderColor: "var(--border-primary)",
                          }}
                        >
                          <pre
                            className="text-xs font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {streamingText}
                            <span
                              className="inline-block w-2 h-4 animate-pulse ml-0.5"
                              style={{
                                backgroundColor: "var(--accent-primary)",
                              }}
                            />
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Results */}
                  {result && (
                    <div className="space-y-3 p-6">
                      {/* Summary */}
                      {result.summary && (
                        <div className="p-6 rounded-lg shadow-sm border-l-4 border-amber-600 dark:border-amber-500 border border-amber-200 dark:border-amber-600/40">
                          <div className="flex items-center gap-2 mb-2">
                            <svg
                              className="w-5 h-5 text-amber-600 dark:text-amber-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wide">
                              要約
                            </h3>
                          </div>
                          <p className="text-sm text-theme-primary leading-relaxed">
                            {result.summary}
                          </p>
                        </div>
                      )}

                      {/* Patient Info */}
                      {result.patientInfo && (
                        <div className="p-6 rounded-lg shadow-sm border-l-4 border-blue-600 dark:border-blue-500 border border-blue-200 dark:border-blue-600/40">
                          <div className="flex items-center gap-2 mb-3">
                            <svg
                              className="w-5 h-5 text-blue-600 dark:text-blue-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wide">
                              患者情報
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {result.patientInfo.chiefComplaint && (
                              <>
                                <div className="text-theme-secondary font-semibold">
                                  主訴:
                                </div>
                                <div className="text-theme-primary">
                                  {result.patientInfo.chiefComplaint}
                                </div>
                              </>
                            )}
                            {result.patientInfo.duration && (
                              <>
                                <div className="text-theme-secondary font-semibold">
                                  期間:
                                </div>
                                <div className="text-theme-primary">
                                  {result.patientInfo.duration}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SOAP sections */}
                      <div className="soap-section subjective">
                        <button
                          onClick={copySectionS}
                          className="absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors"
                          aria-label="Sセクションをコピー"
                          title="このセクションをコピー"
                        >
                          <ClipboardDocumentIcon className="w-5 h-5 text-current opacity-60 hover:opacity-100" />
                        </button>
                        <div className="soap-label">
                          <div className="flex items-center gap-2">
                            <div
                              className="soap-badge"
                              style={{ background: "var(--soap-s)" }}
                            >
                              S
                            </div>
                            主観的情報
                          </div>
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.subjective?.presentIllness && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                現病歴
                              </div>
                              <div className="soap-content">
                                {result.soap.subjective.presentIllness}
                              </div>
                            </div>
                          )}
                          {result.soap.subjective?.symptoms &&
                            result.soap.subjective.symptoms.length > 0 && (
                              <div>
                                <div className="font-bold text-xs text-theme-secondary mb-1">
                                  症状
                                </div>
                                <ul className="list-disc list-inside soap-content space-y-1">
                                  {result.soap.subjective.symptoms.map(
                                    (s: string, i: number) => (
                                      <li key={i}>{s}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          {result.soap.subjective?.severity && (
                            <div>
                              <span className="font-bold text-xs text-theme-secondary">
                                重症度:{" "}
                              </span>
                              <span className="soap-content">
                                {result.soap.subjective.severity}
                              </span>
                            </div>
                          )}
                          {result.soap.subjective?.pastMedicalHistory && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                既往歴
                              </div>
                              <div className="soap-content">
                                {result.soap.subjective.pastMedicalHistory}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section objective">
                        <button
                          onClick={copySectionO}
                          className="absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors"
                          aria-label="Oセクションをコピー"
                          title="このセクションをコピー"
                        >
                          <ClipboardDocumentIcon className="w-5 h-5 text-current opacity-60 hover:opacity-100" />
                        </button>
                        <div className="soap-label">
                          <div className="flex items-center gap-2">
                            <div
                              className="soap-badge"
                              style={{ background: "var(--soap-o)" }}
                            >
                              O
                            </div>
                            客観的情報
                          </div>
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.objective?.vitalSigns && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-2">
                                バイタルサイン
                              </div>
                              <div className="rounded border border-theme-soft overflow-hidden">
                                <table className="w-full text-xs">
                                  <tbody className="divide-y divide-theme-soft">
                                    <tr>
                                      <td className="px-3 py-2 bg-theme-table-header font-semibold text-theme-tertiary">
                                        血圧
                                      </td>
                                      <td className="px-3 py-2 text-theme-secondary">
                                        {
                                          result.soap.objective.vitalSigns
                                            .bloodPressure
                                        }
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-theme-table-header font-semibold text-theme-tertiary">
                                        脈拍
                                      </td>
                                      <td className="px-3 py-2 text-theme-secondary">
                                        {result.soap.objective.vitalSigns.pulse}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-theme-table-header font-semibold text-theme-tertiary">
                                        体温
                                      </td>
                                      <td className="px-3 py-2 text-theme-secondary">
                                        {
                                          result.soap.objective.vitalSigns
                                            .temperature
                                        }
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-theme-table-header font-semibold text-theme-tertiary">
                                        呼吸数
                                      </td>
                                      <td className="px-3 py-2 text-theme-secondary">
                                        {
                                          result.soap.objective.vitalSigns
                                            .respiratoryRate
                                        }
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {result.soap.objective?.physicalExam && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                身体所見
                              </div>
                              <div className="soap-content">
                                {result.soap.objective.physicalExam}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section assessment">
                        <button
                          onClick={copySectionA}
                          className="absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors"
                          aria-label="Aセクションをコピー"
                          title="このセクションをコピー"
                        >
                          <ClipboardDocumentIcon className="w-5 h-5 text-current opacity-60 hover:opacity-100" />
                        </button>
                        <div className="soap-label">
                          <div className="flex items-center gap-2">
                            <div
                              className="soap-badge"
                              style={{ background: "var(--soap-a)" }}
                            >
                              A
                            </div>
                            評価・診断
                          </div>
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.assessment?.diagnosis && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="font-bold text-xs text-theme-secondary">
                                診断名:
                              </span>
                              <span className="soap-content font-bold">
                                {result.soap.assessment.diagnosis}
                              </span>
                              {result.soap.assessment?.icd10 && (
                                <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-mono">
                                  {result.soap.assessment.icd10}
                                </span>
                              )}
                            </div>
                          )}
                          {result.soap.assessment?.differentialDiagnosis &&
                            result.soap.assessment.differentialDiagnosis
                              .length > 0 && (
                              <div>
                                <div className="font-bold text-xs text-theme-secondary mb-1">
                                  鑑別診断
                                </div>
                                <ul className="list-disc list-inside soap-content space-y-1">
                                  {result.soap.assessment.differentialDiagnosis.map(
                                    (d: string, i: number) => (
                                      <li key={i}>{d}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          {result.soap.assessment?.clinicalImpression && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                臨床的評価
                              </div>
                              <div className="soap-content">
                                {result.soap.assessment.clinicalImpression}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section plan">
                        <button
                          onClick={copySectionP}
                          className="absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors"
                          aria-label="Pセクションをコピー"
                          title="このセクションをコピー"
                        >
                          <ClipboardDocumentIcon className="w-5 h-5 text-current opacity-60 hover:opacity-100" />
                        </button>
                        <div className="soap-label">
                          <div className="flex items-center gap-2">
                            <div
                              className="soap-badge"
                              style={{ background: "var(--soap-p)" }}
                            >
                              P
                            </div>
                            治療計画
                          </div>
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.plan?.treatment && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                治療方針
                              </div>
                              <div className="soap-content">
                                {result.soap.plan.treatment}
                              </div>
                            </div>
                          )}
                          {result.soap.plan?.medications &&
                            result.soap.plan.medications.length > 0 && (
                              <div>
                                <div className="font-bold text-xs text-theme-secondary mb-2">
                                  処方
                                </div>
                                <div className="space-y-2">
                                  {result.soap.plan.medications.map(
                                    (med, i: number) => (
                                      <div
                                        key={i}
                                        className="bg-theme-surface rounded border border-theme-glass p-3"
                                      >
                                        <div className="font-bold text-sm text-theme-primary mb-1">
                                          {med.name}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs text-theme-secondary">
                                          <div>
                                            <span className="font-semibold">
                                              用量:
                                            </span>{" "}
                                            {med.dosage}
                                          </div>
                                          <div>
                                            <span className="font-semibold">
                                              用法:
                                            </span>{" "}
                                            {med.frequency}
                                          </div>
                                          <div>
                                            <span className="font-semibold">
                                              期間:
                                            </span>{" "}
                                            {med.duration}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          {result.soap.plan?.tests &&
                            result.soap.plan.tests.length > 0 && (
                              <div>
                                <div className="font-bold text-xs text-theme-secondary mb-1">
                                  追加検査
                                </div>
                                <ul className="list-disc list-inside soap-content space-y-1">
                                  {result.soap.plan.tests.map(
                                    (t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          {result.soap.plan?.followUp && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                フォローアップ
                              </div>
                              <div className="soap-content">
                                {result.soap.plan.followUp}
                              </div>
                            </div>
                          )}
                          {result.soap.plan?.patientEducation && (
                            <div>
                              <div className="font-bold text-xs text-theme-secondary mb-1">
                                患者指導
                              </div>
                              <div className="soap-content">
                                {result.soap.plan.patientEducation}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Generated timestamp and token usage */}
                      <div className="px-6 py-3 bg-theme-card text-xs text-theme-tertiary font-mono border-t border-theme-border flex items-center justify-between">
                        <span>生成時刻: {new Date().toLocaleTimeString("ja-JP")}</span>
                        {tokenUsage && (
                          <span className="opacity-60" title={`入力: ${tokenUsage.promptTokens} / 出力: ${tokenUsage.completionTokens}`}>
                            {tokenUsage.totalTokens.toLocaleString()} tokens ≈ ¥{tokenUsage.estimatedCostJPY.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Export Preview Modal */}
          {showExportPreview && exportPreviewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-overlay backdrop-blur-sm">
              <div className="bg-theme-modal backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-theme-modal">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme-soft bg-theme-modal-header rounded-t-2xl">
                  <h3 className="text-lg font-semibold text-theme-primary">
                    エクスポートプレビュー (
                    {exportPreviewData.type.toUpperCase()})
                  </h3>
                  <button
                    onClick={() => {
                      setShowExportPreview(false);
                      setExportPreviewData(null);
                    }}
                    className="text-theme-tertiary hover:text-theme-primary transition-colors"
                    aria-label="プレビューを閉じる"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 bg-theme-modal-content">
                  <div className="mb-4 flex items-center gap-2 text-sm text-theme-secondary">
                    <DocumentIcon className="w-4 h-4" />
                    <span className="font-mono">
                      {exportPreviewData.filename}
                    </span>
                  </div>
                  <pre className="bg-theme-modal-card border border-theme-border rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words text-theme-primary">
                    {exportPreviewData.content}
                  </pre>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-soft bg-theme-modal-footer rounded-b-2xl">
                  <button
                    onClick={() => {
                      setShowExportPreview(false);
                      setExportPreviewData(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-theme-primary bg-theme-interactive border border-theme-border rounded-md hover:bg-theme-interactive-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={confirmExport}
                    className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 transition-all hover:brightness-110"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    ダウンロード
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-overlay backdrop-blur-sm">
              <div className="bg-theme-modal backdrop-blur-xl rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-theme-modal">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-modal-header rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <QuestionMarkCircleIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-theme-primary">
                      使い方ガイド
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="text-theme-tertiary hover:text-theme-primary transition-colors"
                    aria-label="ヘルプを閉じる"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 bg-theme-modal-content">
                  <div className="space-y-6">
                    {/* Overview */}
                    <div>
                      <h4 className="text-lg font-bold text-theme-primary mb-2 flex items-center gap-2">
                        <InformationCircleIcon className="w-5 h-5 text-theme-help-icon" />
                        このアプリについて
                      </h4>
                      <p className="text-sm text-theme-secondary leading-relaxed">
                        Medical Voice
                        Scribeは、音声による医療問診を自動的にSOAPカルテ形式に変換するデモアプリケーションです。
                        医療現場での記録業務の効率化を目的としています。
                      </p>
                    </div>

                    {/* How to Use */}
                    <div>
                      <h4 className="text-lg font-bold text-theme-primary mb-3 flex items-center gap-2">
                        <ClipboardDocumentIcon className="w-5 h-5 text-theme-help-icon" />
                        基本的な使い方
                      </h4>
                      <ol className="space-y-3 text-sm text-theme-secondary">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-theme-help-number text-white rounded-full flex items-center justify-center text-xs font-bold">
                            1
                          </span>
                          <div>
                            <span className="font-semibold">
                              録音ボタンをクリック
                            </span>
                            して、音声入力を開始します。マイクの使用許可を求められた場合は許可してください。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-theme-help-number text-white rounded-full flex items-center justify-center text-xs font-bold">
                            2
                          </span>
                          <div>
                            医師と患者の会話を
                            <span className="font-semibold">
                              自然に話します
                            </span>
                            。問診内容、症状、診察結果などを含めてください。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-theme-help-number text-white rounded-full flex items-center justify-center text-xs font-bold">
                            3
                          </span>
                          <div>
                            録音が完了したら
                            <span className="font-semibold">停止ボタン</span>
                            をクリックし、テキスト化された内容を確認します。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-theme-help-number text-white rounded-full flex items-center justify-center text-xs font-bold">
                            4
                          </span>
                          <div>
                            必要に応じてテキストを編集し、
                            <span className="font-semibold">
                              「SOAP生成」ボタン
                            </span>
                            をクリックします。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-theme-help-number text-white rounded-full flex items-center justify-center text-xs font-bold">
                            5
                          </span>
                          <div>
                            AIが自動的に
                            <span className="font-semibold">
                              SOAP形式のカルテ
                            </span>
                            を生成します。
                          </div>
                        </li>
                      </ol>
                    </div>

                    {/* Features */}
                    <div>
                      <h4 className="text-lg font-bold text-theme-primary mb-3 flex items-center gap-2">
                        <PuzzlePieceIcon className="w-5 h-5 text-theme-help-icon" />
                        主な機能
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-theme-modal-card rounded-lg p-3 border border-theme-border">
                          <div className="font-semibold text-theme-primary mb-1">
                            🎤 音声入力
                          </div>
                          <div className="text-theme-secondary text-xs">
                            ブラウザの音声認識機能を使用してリアルタイムに文字起こし
                          </div>
                        </div>
                        <div className="bg-theme-modal-card rounded-lg p-3 border border-theme-border">
                          <div className="font-semibold text-theme-primary mb-1">
                            🤖 AI生成
                          </div>
                          <div className="text-theme-secondary text-xs">
                            OpenAI GPT-4oを使用したSOAPカルテの自動生成
                          </div>
                        </div>
                        <div className="bg-theme-modal-card rounded-lg p-3 border border-theme-border">
                          <div className="font-semibold text-theme-primary mb-1">
                            🔊 読み上げ
                          </div>
                          <div className="text-theme-secondary text-xs">
                            生成されたカルテをシステム音声で読み上げ（速度・音声調整可能）
                          </div>
                        </div>
                        <div className="bg-theme-modal-card rounded-lg p-3 border border-theme-border">
                          <div className="font-semibold text-theme-primary mb-1">
                            💾 保存・共有
                          </div>
                          <div className="text-theme-secondary text-xs">
                            JSON/CSV形式でエクスポート、インポートが可能
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SOAP Format */}
                    <div>
                      <h4 className="text-lg font-bold text-theme-primary mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5 text-theme-help-icon" />
                        SOAP形式とは
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-3">
                          <div
                            className="flex-shrink-0 w-6 h-6 text-white rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--soap-s)" }}
                          >
                            S
                          </div>
                          <div>
                            <span className="font-semibold text-theme-primary">
                              Subjective（主観的情報）
                            </span>
                            <p className="text-theme-secondary text-xs mt-0.5">
                              患者が訴える症状や感じていること
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div
                            className="flex-shrink-0 w-6 h-6 text-white rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--soap-o)" }}
                          >
                            O
                          </div>
                          <div>
                            <span className="font-semibold text-theme-primary">
                              Objective（客観的情報）
                            </span>
                            <p className="text-theme-secondary text-xs mt-0.5">
                              測定可能な検査結果やバイタルサイン
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div
                            className="flex-shrink-0 w-6 h-6 text-white rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--soap-a)" }}
                          >
                            A
                          </div>
                          <div>
                            <span className="font-semibold text-theme-primary">
                              Assessment（評価）
                            </span>
                            <p className="text-theme-secondary text-xs mt-0.5">
                              診断名や臨床的な評価・判断
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div
                            className="flex-shrink-0 w-6 h-6 text-white rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--soap-p)" }}
                          >
                            P
                          </div>
                          <div>
                            <span className="font-semibold text-theme-primary">
                              Plan（計画）
                            </span>
                            <p className="text-theme-secondary text-xs mt-0.5">
                              治療方針、処方、追加検査、フォローアップ
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Important Notes */}
                    <div className="bg-theme-warning border border-theme-warning rounded-lg p-4">
                      <h4 className="text-sm font-bold text-theme-warning mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5" />
                        重要な注意事項
                      </h4>
                      <ul className="space-y-1 text-xs text-theme-warning">
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>
                            このアプリは
                            <strong>デモンストレーション用途</strong>
                            です。実際の臨床現場での使用は想定していません。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>
                            生成されたカルテ内容は必ず
                            <strong>医療従事者が確認・修正</strong>
                            してください。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>
                            個人情報や機密情報を含むデータの入力は
                            <strong>避けてください</strong>。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>
                            音声認識の精度はブラウザやマイクの品質に依存します。
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-theme-soft bg-theme-modal-footer flex justify-end rounded-b-2xl">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="px-5 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors whitespace-nowrap"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shortcuts Modal */}
          {showShortcutsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-overlay backdrop-blur-sm">
              <div className="bg-theme-modal backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-theme-modal">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme-soft bg-theme-modal-header rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-theme-card flex items-center justify-center">
                      <KeyboardIcon className="w-6 h-6 text-theme-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-theme-primary">
                        ショートカット設定
                      </h3>
                      <p className="text-xs text-theme-secondary">
                        クリックしてキー割り当てを変更できます
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowShortcutsModal(false);
                      setEditingShortcutId(null);
                    }}
                    className="text-theme-tertiary hover:text-theme-primary transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0 bg-theme-modal-content">
                  {/* Mode Toggle */}
                  <div className="px-6 py-4 border-b border-theme-soft bg-theme-modal-content-alt">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-theme-primary">
                          修飾キーショートカットを使用
                        </div>
                        <div className="text-xs text-theme-secondary mt-0.5">
                          オンにすると、テキスト入力中でも{" "}
                          <span className="font-mono bg-theme-highlight px-1 rounded">
                            Cmd+R
                          </span>{" "}
                          などで操作できます
                        </div>
                      </div>
                      <button
                        onClick={() => handleUseModifiersChange(!useModifiers)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                          useModifiers
                            ? "bg-teal-600"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                        role="switch"
                        aria-checked={useModifiers}
                        aria-label="修飾キーショートカットを使用"
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            useModifiers ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Clock Toggle */}
                  <div className="px-6 py-4 border-b border-theme-soft bg-theme-modal-content-alt">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-theme-primary">
                          時計を表示
                        </div>
                        <div className="text-xs text-theme-secondary mt-0.5">
                          ヘッダーに現在時刻と録音経過時間を表示します
                        </div>
                      </div>
                      <button
                        onClick={() => setShowClock(!showClock)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                          showClock
                            ? "bg-teal-600"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                        role="switch"
                        aria-checked={showClock}
                        aria-label="時計を表示"
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            showClock ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-theme-soft">
                    {SHORTCUT_GROUPS.map((group) => {
                      const groupShortcuts = SHORTCUT_DEFS.filter(
                        (def) => def.group === group.id
                      );
                      if (groupShortcuts.length === 0) return null;

                      return (
                        <div key={group.id}>
                          {/* Group Header */}
                          <div className="px-6 py-2 bg-theme-card sticky top-0">
                            <span className="text-xs font-semibold text-theme-accent uppercase tracking-wider">
                              {group.label}
                            </span>
                          </div>

                          {/* Group Items */}
                          {groupShortcuts.map((def) => {
                            const isEditing = editingShortcutId === def.id;
                            const current = shortcuts[def.id] || def.default;
                            const platformDefault =
                              getPlatformDefaultShortcuts(useModifiers)[def.id];

                            return (
                              <div
                                key={def.id}
                                className={`flex items-center justify-between px-6 py-3 transition-colors ${
                                  isEditing
                                    ? "bg-theme-highlight"
                                    : "hover:bg-theme-card"
                                }`}
                              >
                                <span className="text-sm text-theme-primary pl-2">
                                  {def.label}
                                </span>

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => setEditingShortcutId(def.id)}
                                    className={`
                                      min-w-[100px] px-3 py-1.5 rounded-md text-sm font-mono border transition-all
                                      ${
                                        isEditing
                                          ? "bg-theme-surface border-teal-500 text-theme-accent ring-2 ring-teal-500/20"
                                          : "bg-theme-card border-transparent text-theme-primary hover:border-theme-light"
                                      }
                                    `}
                                  >
                                    {isEditing
                                      ? "キーを入力..."
                                      : formatShortcut(current)}
                                  </button>

                                  {JSON.stringify(current) !==
                                    JSON.stringify(platformDefault) && (
                                    <button
                                      onClick={() =>
                                        handleShortcutChange(
                                          def.id,
                                          platformDefault
                                        )
                                      }
                                      className="p-1.5 text-theme-tertiary hover:text-red-500 transition-colors"
                                      title="デフォルトに戻す"
                                    >
                                      <ArrowLeftIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-theme-soft bg-theme-modal-footer flex justify-between items-center">
                  <button
                    onClick={handleResetSettings}
                    className="text-xs text-theme-tertiary hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    設定をリセット
                  </button>
                  <button
                    onClick={() => {
                      setShowShortcutsModal(false);
                      setEditingShortcutId(null);
                    }}
                    className="px-5 py-2 text-sm font-medium text-white bg-theme-primary rounded-md hover:opacity-90 transition-opacity"
                  >
                    完了
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer disclaimer */}
          <footer
            className={`mt-2 pt-2 border-t border-theme-soft ${
              mounted ? "animate-fade-in" : "opacity-0"
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-theme-tertiary">
              <div className="font-mono">
                Next.js 14 / OpenAI API / Web Speech API で構築
              </div>
              <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>デモンストレーション用途のみ - 臨床使用不可</span>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
        aria-label="JSONファイルを選択"
      />
    </div>
  );
}
