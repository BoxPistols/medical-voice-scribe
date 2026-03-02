"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  HeartIcon,
  BeakerIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { SoapNote, ModelId, ChatMessage } from "../api/analyze/types";

// レコメンドアイテムの型
interface Recommendation {
  id: string;
  type: "differential" | "test" | "followup" | "education" | "warning";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  icon: React.ComponentType<{ className?: string }>;
}

// クイックアクションの型
interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

// ヘルプトピックの型
interface HelpTopic {
  id: string;
  question: string;
  answer: string;
  category: "recording" | "analysis" | "export" | "general";
}

interface ChatSupportWidgetProps {
  soapNote: SoapNote | null;
  transcript: string;
  selectedModel: ModelId;
  isRecording: boolean;
  isAnalyzing: boolean;
}

// ヘルプトピック定義
const HELP_TOPICS: HelpTopic[] = [
  {
    id: "recording-start",
    question: "音声録音はどうやって開始しますか？",
    answer:
      "左パネルの「録音開始」ボタンをクリックするか、キーボードショートカット（デフォルト: R）を押してください。マイクへのアクセス許可が求められた場合は「許可」を選択してください。",
    category: "recording",
  },
  {
    id: "recording-tips",
    question: "きれいに録音するコツはありますか？",
    answer:
      "・静かな環境で録音する\n・マイクに近づいて話す\n・はっきりとした声で話す\n・一度に長すぎる録音は避ける\nこれらを心がけると認識精度が向上します。",
    category: "recording",
  },
  {
    id: "analysis-how",
    question: "カルテはどうやって生成されますか？",
    answer:
      "「カルテ生成」ボタンを押すと、入力されたテキストをAIが分析し、SOAP形式のカルテを自動生成します。S（主観的情報）、O（客観的情報）、A（評価）、P（計画）の各セクションに整理されます。",
    category: "analysis",
  },
  {
    id: "analysis-model",
    question: "AIモデルの違いは何ですか？",
    answer:
      "・GPT-4.1 Mini: バランス型（推奨）\n・GPT-4.1 Nano: 最速・最安\n・GPT-5 Mini: 最高品質（複雑な症例向け）\n・GPT-5 Nano: 高速かつ高品質\n症例の複雑さに応じて選択してください。",
    category: "analysis",
  },
  {
    id: "export-json",
    question: "カルテをエクスポートするには？",
    answer:
      "右パネル上部の「エクスポート」ボタンからJSON形式またはCSV形式でダウンロードできます。JSONは完全なデータ保存に、CSVは他システムとの連携に適しています。",
    category: "export",
  },
  {
    id: "export-import",
    question: "以前のカルテを読み込めますか？",
    answer:
      "はい、「インポート」ボタンから以前エクスポートしたJSONファイルを読み込めます。テキストとSOAPノートの両方が復元されます。",
    category: "export",
  },
  {
    id: "shortcuts",
    question: "キーボードショートカットは使えますか？",
    answer:
      "はい、多数のショートカットが利用可能です。ヘルプボタン（?）からショートカット一覧を確認できます。また、設定からショートカットのカスタマイズも可能です。",
    category: "general",
  },
  {
    id: "theme",
    question: "ダークモードに切り替えられますか？",
    answer:
      "はい、ヘッダー右上のテーマ切り替えボタンから、ライトモード・ダークモード・システム設定に合わせる、の3つから選択できます。",
    category: "general",
  },
  {
    id: "speech",
    question: "カルテを読み上げる機能はありますか？",
    answer:
      "はい、各SOAPセクションのスピーカーアイコンをクリックすると音声で読み上げます。音声設定から読み上げ速度や音声の種類を変更できます。",
    category: "general",
  },
  {
    id: "privacy",
    question: "患者データの取り扱いは？",
    answer:
      "本アプリは医療従事者の業務支援ツールです。入力データはAPI経由で処理されますが、ローカルには保存されません。患者の個人情報取り扱いには十分ご注意ください。",
    category: "general",
  },
];

// 問診結果からレコメンドを生成する関数
function generateRecommendations(soapNote: SoapNote | null): Recommendation[] {
  if (!soapNote || !soapNote.soap) return [];

  const recommendations: Recommendation[] = [];
  const { soap } = soapNote;

  // 鑑別診断の確認を促す
  if (
    Array.isArray(soap.assessment?.differentialDiagnosis) &&
    soap.assessment.differentialDiagnosis.length > 0
  ) {
    recommendations.push({
      id: "differential-check",
      type: "differential",
      title: "鑑別診断の確認",
      description: `${soap.assessment.differentialDiagnosis.slice(0, 3).join("、")}など${soap.assessment.differentialDiagnosis.length}つの鑑別診断があります。除外診断のための追加情報を検討してください。`,
      priority: "high",
      icon: ClipboardDocumentCheckIcon,
    });
  }

  // 症状の重症度に基づく警告
  if (
    soap.subjective?.severity &&
    (soap.subjective.severity.includes("重") ||
      soap.subjective.severity.includes("強"))
  ) {
    recommendations.push({
      id: "severity-warning",
      type: "warning",
      title: "重症度に注意",
      description: `患者は重度の症状を報告しています。バイタルサインの継続的なモニタリングと、必要に応じて専門医への紹介を検討してください。`,
      priority: "high",
      icon: ExclamationTriangleIcon,
    });
  }

  // 追加検査の提案
  if (Array.isArray(soap.plan?.tests) && soap.plan.tests.length > 0) {
    recommendations.push({
      id: "tests-suggested",
      type: "test",
      title: "追加検査の実施",
      description: `提案された検査: ${soap.plan.tests.slice(0, 3).join("、")}。診断確定のため、これらの検査を検討してください。`,
      priority: "medium",
      icon: BeakerIcon,
    });
  }

  // フォローアップの提案
  if (soap.plan?.followUp) {
    recommendations.push({
      id: "followup-reminder",
      type: "followup",
      title: "フォローアップの設定",
      description: `推奨フォローアップ: ${soap.plan.followUp}。症状の経過観察と治療効果の評価のため、フォローアップ予定を確認してください。`,
      priority: "medium",
      icon: ArrowPathIcon,
    });
  }

  // 患者教育のポイント
  if (soap.plan?.patientEducation) {
    recommendations.push({
      id: "patient-education",
      type: "education",
      title: "患者への説明事項",
      description: soap.plan.patientEducation,
      priority: "low",
      icon: UserGroupIcon,
    });
  }

  // 薬の相互作用チェック
  if (
    Array.isArray(soap.plan?.medications) &&
    soap.plan.medications.length > 0 &&
    Array.isArray(soap.subjective?.medications) &&
    soap.subjective.medications.length > 0
  ) {
    recommendations.push({
      id: "drug-interaction",
      type: "warning",
      title: "薬物相互作用の確認",
      description: `新規処方薬と既存薬の相互作用をご確認ください。現在服用中: ${soap.subjective.medications.slice(0, 2).join("、")}`,
      priority: "high",
      icon: ExclamationTriangleIcon,
    });
  }

  // 随伴症状からの追加チェック
  if (
    Array.isArray(soap.subjective?.associatedSymptoms) &&
    soap.subjective.associatedSymptoms.length > 2
  ) {
    recommendations.push({
      id: "associated-symptoms",
      type: "differential",
      title: "複数症状の包括的評価",
      description: `${soap.subjective.associatedSymptoms.length}つの随伴症状があります。全身性疾患や複合的な病態の可能性を検討してください。`,
      priority: "medium",
      icon: LightBulbIcon,
    });
  }

  // 優先度順にソートして上位5件を返す
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}

export default function ChatSupportWidget({
  soapNote,
  transcript,
  selectedModel,
  isRecording,
  isAnalyzing,
}: ChatSupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "chat" | "recommendations" | "help"
  >("recommendations");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHelpCategory, setSelectedHelpCategory] = useState<
    string | null
  >(null);
  const [windowSize, setWindowSize] = useState({ width: 400, height: 560 });
  const [isResizing, setIsResizing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // レコメンドを生成（メモ化）
  const recommendations = useMemo(
    () => generateRecommendations(soapNote),
    [soapNote],
  );

  // メッセージ追加時に自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ウィジェットを開いた時に入力にフォーカス
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      inputRef.current?.focus();
    }
  }, [isOpen, activeTab]);

  // リサイズ処理
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: windowSize.width,
        startHeight: windowSize.height,
      };
    },
    [windowSize],
  );

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;

      // 左上からリサイズ: 左に引くと幅増、上に引くと高さ増
      const deltaX = resizeRef.current.startX - e.clientX;
      const deltaY = resizeRef.current.startY - e.clientY;

      const newWidth = Math.max(
        288,
        Math.min(600, resizeRef.current.startWidth + deltaX),
      );
      const newHeight = Math.max(
        320,
        Math.min(800, resizeRef.current.startHeight + deltaY),
      );

      setWindowSize({ width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  // textareaの自動リサイズ
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 128); // 最大8rem
      textarea.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  // チャットメッセージ送信
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const generateId = () =>
      Date.now().toString() + Math.random().toString(36).substring(2);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          soapNote,
          transcript,
          model: selectedModel,
          conversationHistory: messages.slice(-10), // 直近10件のコンテキスト
        }),
      });

      if (!response.ok) {
        throw new Error("Chat API error");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        type: data.type || "normal",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content:
          "申し訳ございません。一時的にエラーが発生しました。しばらく経ってから再度お試しください。",
        timestamp: new Date(),
        type: "normal",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, selectedModel, soapNote, transcript]);

  // クイックアクション
  const quickActions: QuickAction[] = [
    {
      id: "summary",
      label: "要約を教えて",
      icon: SparklesIcon,
      action: () => {
        setInputValue("現在の診療内容を簡潔に要約してください");
        setActiveTab("chat");
      },
    },
    {
      id: "check-diagnosis",
      label: "診断を確認",
      icon: ClipboardDocumentCheckIcon,
      action: () => {
        setInputValue("現在の診断に見落としがないか確認してください");
        setActiveTab("chat");
      },
    },
    {
      id: "suggest-tests",
      label: "検査を提案",
      icon: BeakerIcon,
      action: () => {
        setInputValue("追加で実施すべき検査を提案してください");
        setActiveTab("chat");
      },
    },
  ];

  // ヘルプカテゴリ
  const helpCategories = [
    { id: "recording", label: "録音", icon: "🎤" },
    { id: "analysis", label: "分析", icon: "📊" },
    { id: "export", label: "エクスポート", icon: "📁" },
    { id: "general", label: "全般", icon: "💡" },
  ];

  // キーボードイベント（日本語IME対応: Cmd/Ctrl+Enterで送信）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME変換中は何もしない
    if (e.nativeEvent.isComposing) return;

    // Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux) で送信
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 個別メッセージをクリップボードにコピー
  const copyMessageToClipboard = useCallback(
    async (messageId: string, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (err) {
        console.error("Failed to copy message:", err);
      }
    },
    [],
  );

  // チャット履歴全体をテキストファイルとしてダウンロード
  const downloadChatHistory = useCallback(() => {
    if (messages.length === 0) return;

    const lines = messages.map((msg) => {
      const time = msg.timestamp.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const role = msg.role === "user" ? "あなた" : "AIサポート";
      return `[${time}] ${role}:\n${msg.content}`;
    });

    const text = `診療サポート チャット履歴\n${new Date().toLocaleDateString("ja-JP")}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages]);

  // 優先度に応じたカードスタイル（背景・枠線）
  const getCardStyle = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "high":
        return "recommendation-priority-high";
      case "medium":
        return "recommendation-priority-medium";
      case "low":
        return "recommendation-priority-low";
    }
  };

  // 優先度に応じたアイコン色
  const getIconColor = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "high":
        return "recommendation-icon-high";
      case "medium":
        return "recommendation-icon-medium";
      case "low":
        return "recommendation-icon-low";
    }
  };

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`chat-support-fab ${isOpen ? "chat-support-fab-active" : ""} ${
          recommendations.length > 0 && !isOpen ? "chat-support-fab-pulse" : ""
        }`}
        aria-label="チャットサポートを開く"
        title="チャットサポート"
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <>
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
            {recommendations.length > 0 && (
              <span className="chat-support-badge">
                {recommendations.length}
              </span>
            )}
          </>
        )}
      </button>

      {/* チャットウィンドウ */}
      {isOpen && (
        <div
          className={`chat-support-window ${isResizing ? "is-resizing" : ""}`}
          style={{ width: windowSize.width, height: windowSize.height }}
        >
          {/* ヘッダー */}
          <div className="chat-support-header">
            {/* リサイズハンドル（ヘッダー左端） */}
            <button
              className="drag-handle"
              onMouseDown={handleResizeStart}
              aria-label="ドラッグでリサイズ"
              type="button"
            >
              <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M1 7V1H7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M1 1L6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <HeartIcon className="w-5 h-5 text-white" strokeWidth={2.5} />
              <span className="font-semibold">診療サポート</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1 text-[10px] opacity-80">
                {isRecording && (
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    録音中
                  </span>
                )}
                {isAnalyzing && (
                  <span className="flex items-center gap-1 text-white/90">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                    分析中
                  </span>
                )}
              </div>
              {activeTab === "chat" && messages.length > 0 && (
                <button
                  onClick={downloadChatHistory}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                  aria-label="チャット履歴をダウンロード"
                  title="チャット履歴をダウンロード"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* タブ */}
          <div className="chat-support-tabs" role="tablist">
            <button
              onClick={() => setActiveTab("recommendations")}
              className={`chat-support-tab ${activeTab === "recommendations" ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === "recommendations"}
              aria-controls="panel-recommendations"
            >
              <SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>推奨</span>
              {recommendations.length > 0 && (
                <span className="chat-support-tab-badge">
                  {recommendations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`chat-support-tab ${activeTab === "chat" ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === "chat"}
              aria-controls="panel-chat"
            >
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>チャット</span>
            </button>
            <button
              onClick={() => setActiveTab("help")}
              className={`chat-support-tab ${activeTab === "help" ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === "help"}
              aria-controls="panel-help"
            >
              <QuestionMarkCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>ヘルプ</span>
            </button>
          </div>

          {/* コンテンツ */}
          <div className="chat-support-content">
            {/* レコメンドタブ */}
            {activeTab === "recommendations" && (
              <div className="chat-support-recommendations">
                {recommendations.length > 0 ? (
                  <>
                    <div className="text-xs rec-text-secondary mb-3 px-1">
                      問診結果に基づく推奨事項
                    </div>
                    <div className="space-y-2">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className={`chat-support-recommendation ${getCardStyle(rec.priority)}`}
                        >
                          <div className="flex items-start gap-3">
                            <rec.icon
                              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${getIconColor(rec.priority)}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm rec-text-primary">
                                {rec.title}
                              </div>
                              <div className="text-xs rec-text-secondary mt-1 leading-relaxed">
                                {rec.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* クイックアクション */}
                    <div className="mt-4 pt-3 border-t rec-border-color">
                      <div className="text-xs rec-text-secondary mb-2">
                        クイックアクション
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {quickActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={action.action}
                            className="chat-support-quick-action"
                          >
                            <action.icon className="w-3.5 h-3.5" />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="chat-support-empty">
                    <SparklesIcon className="w-12 h-12 opacity-30 mb-3" />
                    <div className="text-sm font-medium mb-1">
                      レコメンドなし
                    </div>
                    <div className="text-xs opacity-70">
                      カルテを生成すると、診療に役立つ
                      <br />
                      レコメンドが表示されます
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* チャットタブ */}
            {activeTab === "chat" && (
              <div className="chat-support-chat">
                <div className="chat-support-messages">
                  {messages.length === 0 ? (
                    <div className="chat-support-empty">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 opacity-30 mb-3" />
                      <div className="text-sm font-medium mb-1">AIサポート</div>
                      <div className="text-xs opacity-70 mb-4">
                        診療に関する質問や
                        <br />
                        アプリの使い方を聞いてください
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {quickActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={action.action}
                            className="chat-support-quick-action"
                          >
                            <action.icon className="w-3.5 h-3.5" />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`chat-support-message ${msg.role === "user" ? "user" : "assistant"}`}
                        >
                          <div className="chat-support-message-content group/msg relative">
                            {msg.content}
                            <button
                              onClick={() =>
                                copyMessageToClipboard(msg.id, msg.content)
                              }
                              className="chat-support-msg-copy-btn"
                              aria-label="メッセージをコピー"
                              title="コピー"
                            >
                              {copiedMessageId === msg.id ? (
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12.75l6 6 9-13.5"
                                  />
                                </svg>
                              ) : (
                                <DocumentDuplicateIcon className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="chat-support-message-time">
                            {msg.timestamp.toLocaleTimeString("ja-JP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="chat-support-message assistant">
                          <div className="chat-support-message-content">
                            <div className="chat-support-typing">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ヘルプタブ */}
            {activeTab === "help" && (
              <div className="chat-support-help">
                {/* カテゴリ選択 */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {helpCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setSelectedHelpCategory(
                          selectedHelpCategory === cat.id ? null : cat.id,
                        )
                      }
                      className={`chat-support-help-category ${
                        selectedHelpCategory === cat.id ? "active" : ""
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* FAQ一覧 */}
                <div className="space-y-2">
                  {HELP_TOPICS.filter(
                    (topic) =>
                      !selectedHelpCategory ||
                      topic.category === selectedHelpCategory,
                  ).map((topic) => (
                    <details key={topic.id} className="chat-support-faq">
                      <summary className="chat-support-faq-question">
                        <QuestionMarkCircleIcon className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        <span>{topic.question}</span>
                      </summary>
                      <div className="chat-support-faq-answer">
                        <div className="whitespace-pre-line">
                          {topic.answer}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>

                {/* その他のヘルプ */}
                <div className="mt-4 pt-3 border-t border-theme-soft">
                  <button
                    onClick={() => {
                      setActiveTab("chat");
                      setInputValue("アプリの使い方を教えてください");
                    }}
                    className="chat-support-help-link"
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    その他の質問はチャットで聞く
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 入力エリア（チャットタブのみ） */}
          {activeTab === "chat" && (
            <div className="chat-support-input">
              <div className="chat-support-input-wrapper">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="質問を入力..."
                  className="chat-support-input-field"
                  disabled={isLoading}
                  rows={2}
                />
                <span className="chat-support-input-hint">
                  {typeof navigator !== "undefined" &&
                  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
                    ? "⌘+Enter で送信 ／ Shift+Enter で改行"
                    : "Ctrl+Enter で送信 ／ Shift+Enter で改行"}
                </span>
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="chat-support-send-btn"
                aria-label="送信"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
