"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  PaperAirplaneIcon,
  MicrophoneIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import type { ModelId } from "../api/analyze/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/analyze/types";

// メッセージの型
interface MentoringMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Web Speech API型定義
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

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substring(2);

export default function MentoringMode() {
  const [messages, setMessages] = useState<MentoringMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // textareaの自動リサイズ
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 128);
      textarea.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  // 音声認識の初期化
  const startListening = useCallback(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ja-JP";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue((prev) => {
        // 暫定結果は上書き、確定結果は追加
        const lastFinal = event.results[event.results.length - 1].isFinal;
        if (lastFinal) {
          return prev + transcript;
        }
        return prev;
      });
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: MentoringMessage = {
      id: generateId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/mentoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "APIエラーが発生しました");
      }

      const data = await response.json();

      const assistantMessage: MentoringMessage = {
        id: generateId(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: MentoringMessage = {
        id: generateId(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "申し訳ございません。一時的にエラーが発生しました。しばらく経ってから再度お試しください。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, selectedModel]);

  // キーボードイベント（日本語IME対応）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 提案トピック
  const suggestions = [
    "最近仕事のストレスが溜まっている",
    "自分に自信が持てない",
    "将来のことが不安で眠れない",
    "人間関係に疲れてしまった",
  ];

  return (
    <div className="flex flex-col h-full bg-theme-bg">
      {/* ヘッダー */}
      <div className="flex-shrink-0 border-b border-theme-border bg-gradient-to-r from-teal-500/10 to-emerald-500/10 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-theme-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </span>
            メンタリングモード
          </h2>
          <p className="text-sm text-theme-secondary mt-1">
            ポジティブな視点で考えを整理するメンタルコーチング
          </p>
          <p className="text-xs text-theme-tertiary mt-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded px-2 py-1 inline-block">
            このモードは医療行為ではありません
          </p>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            // 空状態: 提案トピック表示
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-teal-500 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-theme-primary mb-1">
                何でも話してみてください
              </p>
              <p className="text-xs text-theme-tertiary mb-6">
                あなたの考えを一緒に整理します
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-teal-500 text-white rounded-br-md"
                        : "bg-theme-surface border border-theme-border text-theme-primary rounded-bl-md"
                    }`}
                  >
                    <div className="text-sm leading-relaxed chat-markdown">
                      {msg.role === "assistant" ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                    <div
                      className={`text-[10px] mt-1 ${
                        msg.role === "user"
                          ? "text-teal-200"
                          : "text-theme-tertiary"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-theme-surface border border-theme-border rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* 入力エリア */}
      <div className="flex-shrink-0 border-t border-theme-border bg-theme-surface px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          {/* モデル選択 */}
          <div className="flex items-center gap-2 mb-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelId)}
              className="text-xs bg-theme-bg border border-theme-border rounded-lg px-2 py-1 text-theme-secondary focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {/* 入力フォーム */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="気持ちや考えを入力してください..."
                className="w-full resize-none rounded-xl border border-theme-border bg-theme-bg px-4 py-2.5 pr-10 text-sm text-theme-primary placeholder-theme-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={isLoading}
                rows={1}
              />
              <span className="absolute right-3 bottom-1.5 text-[10px] text-theme-tertiary pointer-events-none">
                {typeof navigator !== "undefined" &&
                /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
                  ? "⌘+Enter"
                  : "Ctrl+Enter"}
              </span>
            </div>
            {/* 音声入力ボタン */}
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-theme-bg border border-theme-border text-theme-secondary hover:text-teal-500 hover:border-teal-500"
              }`}
              aria-label={isListening ? "音声入力を停止" : "音声入力を開始"}
              title={isListening ? "音声入力を停止" : "音声で入力"}
            >
              {isListening ? (
                <StopIcon className="w-5 h-5" />
              ) : (
                <MicrophoneIcon className="w-5 h-5" />
              )}
            </button>
            {/* 送信ボタン */}
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="送信"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
