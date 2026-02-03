'use client';

import { useState, useEffect, useRef } from 'react';
import type { SoapNote } from './api/analyze/types';

// Web Speech API type definitions
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SoapNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Resizable layout state (PC)
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Accordion state (Mobile)
  const [activePanel, setActivePanel] = useState<'transcript' | 'result'>('transcript');

  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Check screen size for responsive layout
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;

    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript + '。\n');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsRecording(!isRecording);
  };

  const handleAnalyze = async () => {
    if (!transcript) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (!data.soap) {
        console.error('Invalid data structure:', data);
        setError('AIの応答形式が不正です。もう一度お試しください。');
        return;
      }

      setResult(data);
    } catch (e) {
      console.error(e);
      setError('エラーが発生しました。APIキーとネットワーク接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (!transcript && !result) return;

    const hasContent = transcript.length > 0 || result !== null;
    if (hasContent) {
      const confirmed = window.confirm(
        '入力内容と生成結果をすべて削除しますか？\nこの操作は取り消せません。'
      );
      if (!confirmed) return;
    }

    setTranscript('');
    setResult(null);
    setError(null);
  };

  // Layout presets
  const setLayoutPreset = (preset: 'equal' | 'left' | 'right') => {
    setIsTransitioning(true);
    switch (preset) {
      case 'equal':
        setLeftWidth(50);
        break;
      case 'left':
        setLeftWidth(65);
        break;
      case 'right':
        setLeftWidth(35);
        break;
    }
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Resizer handlers
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 30% and 70%
      if (newLeftWidth >= 30 && newLeftWidth <= 70) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Minimal header - sticky on scroll */}
      <header
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200"
        style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-none">
                    Medical Voice Scribe
                  </h1>
                  <p className="text-xs text-gray-500 font-mono">AI音声問診・カルテ自動生成</p>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-3">
              <div className={`status-badge ${isRecording ? 'recording' : 'idle'}`}>
                <div className={`status-indicator ${isRecording ? 'recording' : 'idle'} ${isRecording ? 'recording-pulse' : ''}`} />
                {isRecording ? '録音中' : '待機中'}
              </div>
            </div>

            {/* Mobile menu placeholder */}
            <div className="sm:hidden">
              <div className={`status-indicator ${isRecording ? 'recording recording-pulse' : 'idle'}`} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 relative">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Control panel */}
          <div className={`mb-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={toggleRecording}
                  className={`btn btn-record ${isRecording ? 'recording' : ''}`}
                  aria-label={isRecording ? '録音を停止' : '録音を開始'}
                  aria-pressed={isRecording}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    {isRecording ? (
                      <rect x="6" y="6" width="8" height="8" />
                    ) : (
                      <circle cx="10" cy="10" r="6" />
                    )}
                  </svg>
                  {isRecording ? '停止' : '録音'}
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !transcript}
                  className="btn btn-primary"
                  aria-label="SOAPカルテを生成"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      カルテ生成
                    </>
                  )}
                </button>

                {/* Character count */}
                {transcript && (
                  <div className="text-sm text-gray-500 font-mono ml-2">
                    {transcript.length} 文字
                  </div>
                )}
              </div>

              {/* Clear button - Right side */}
              <button
                onClick={handleClear}
                disabled={!transcript && !result}
                className="btn btn-secondary"
                aria-label="すべてクリア"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                クリア
              </button>
            </div>
          </div>

          {/* Two-column layout - Desktop: Resizable, Mobile: Accordion */}
          <div
            ref={containerRef}
            className="relative flex flex-col lg:flex-row gap-0"
            style={{ minHeight: 'calc(100vh - 220px)' }}
          >

            {/* Left: Transcript input */}
            <section
              className={`${mounted ? 'animate-fade-in delay-100' : 'opacity-0'} flex-shrink-0 ${!isLargeScreen && activePanel !== 'transcript' ? 'hidden' : 'block'}`}
              style={{
                width: isLargeScreen ? `${leftWidth}%` : '100%',
                transition: isTransitioning ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
              }}
              aria-label="会話入力"
            >
              <div className="panel h-full flex flex-col lg:mr-0">
                <div className="panel-header">
                  <div className="flex items-center justify-between">
                    <h2 className="panel-title">会話テキスト</h2>
                    {/* Mobile accordion toggle */}
                    {!isLargeScreen && (
                      <button
                        onClick={() => setActivePanel('result')}
                        className="btn btn-secondary py-1 px-3 text-xs"
                        aria-label="SOAPカルテを表示"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        カルテ表示
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 p-0 relative">
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
                className="relative flex-shrink-0 bg-gray-50"
                style={{ width: '48px' }}
                role="separator"
                aria-label="レイアウト調整"
              >
                {/* Layout preset buttons - Top positioned */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-10">
                  <button
                    onClick={() => setLayoutPreset('left')}
                    className="layout-btn group"
                    title="左側を広く"
                    aria-label="左側を広くする"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="5" width="10" height="14" className="group-hover:fill-teal-50" />
                      <rect x="15" y="5" width="6" height="14" className="group-hover:fill-teal-50" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setLayoutPreset('equal')}
                    className="layout-btn group"
                    title="均等"
                    aria-label="左右を均等にする"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="5" width="8" height="14" className="group-hover:fill-teal-50" />
                      <rect x="13" y="5" width="8" height="14" className="group-hover:fill-teal-50" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setLayoutPreset('right')}
                    className="layout-btn group"
                    title="右側を広く"
                    aria-label="右側を広くする"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="5" width="6" height="14" className="group-hover:fill-teal-50" />
                      <rect x="11" y="5" width="10" height="14" className="group-hover:fill-teal-50" />
                    </svg>
                  </button>
                </div>

                {/* Draggable divider - Full height */}
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-col-resize group"
                  onMouseDown={handleMouseDown}
                  style={{ pointerEvents: isTransitioning ? 'none' : 'auto' }}
                >
                  {/* Visual line */}
                  <div className="w-1 h-full bg-gray-200 group-hover:bg-teal-400 transition-colors duration-200">
                    {/* Grip dots in center */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
                      <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-teal-600" />
                      <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-teal-600" />
                      <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-teal-600" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right: SOAP results */}
            <section
              className={`${mounted ? 'animate-fade-in delay-200' : 'opacity-0'} flex-1 ${!isLargeScreen && activePanel !== 'result' ? 'hidden' : 'block'}`}
              style={{
                transition: isTransitioning ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
              }}
              aria-label="SOAPカルテ結果"
            >
              <div className="panel h-full flex flex-col lg:ml-0">
                <div className="panel-header">
                  <div className="flex items-center justify-between">
                    {/* Mobile back button */}
                    {!isLargeScreen ? (
                      <>
                        <button
                          onClick={() => setActivePanel('transcript')}
                          className="btn btn-secondary py-1 px-3 text-xs"
                          aria-label="会話テキストに戻る"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                          </svg>
                          会話テキスト
                        </button>
                        <h2 className="panel-title">AI生成SOAPカルテ</h2>
                        <div className="w-20" /> {/* Spacer for centering */}
                      </>
                    ) : (
                      <h2 className="panel-title">AI生成SOAPカルテ</h2>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">

                  {/* Error state */}
                  {error && (
                    <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-red-900 mb-1">エラー</h4>
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="text-red-600 hover:text-red-800"
                          aria-label="エラーメッセージを閉じる"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!result && !loading && !error && (
                    <div className="empty-state">
                      <svg
                        className="empty-state-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="empty-state-text">
                        まだ解析されていません<br />
                        会話を録音してSOAPカルテを生成してください
                      </p>
                    </div>
                  )}

                  {/* Loading state */}
                  {loading && (
                    <div className="empty-state">
                      <div className="loading-spinner animate-spin" style={{ width: '3rem', height: '3rem', borderWidth: '3px' }} />
                      <p className="empty-state-text mt-4">
                        会話を解析中...<br />
                        <span className="text-xs">GPT-4o-miniを使用</span>
                      </p>
                    </div>
                  )}

                  {/* Results */}
                  {result && (
                    <div className="space-y-0">
                      {/* Summary */}
                      {result.summary && (
                        <div className="p-6 bg-amber-50 border-b border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wide">要約</h3>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
                        </div>
                      )}

                      {/* Patient Info */}
                      {result.patientInfo && (
                        <div className="p-6 bg-blue-50 border-b border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wide">患者情報</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {result.patientInfo.chiefComplaint && (
                              <>
                                <div className="text-gray-600 font-semibold">主訴:</div>
                                <div className="text-gray-900">{result.patientInfo.chiefComplaint}</div>
                              </>
                            )}
                            {result.patientInfo.duration && (
                              <>
                                <div className="text-gray-600 font-semibold">期間:</div>
                                <div className="text-gray-900">{result.patientInfo.duration}</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SOAP sections */}
                      <div className="soap-section subjective">
                        <div className="soap-label">
                          <div className="soap-badge" style={{ background: 'var(--soap-s)' }}>S</div>
                          主観的情報
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.subjective?.presentIllness && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">現病歴</div>
                              <div className="soap-content">{result.soap.subjective.presentIllness}</div>
                            </div>
                          )}
                          {result.soap.subjective?.symptoms && result.soap.subjective.symptoms.length > 0 && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">症状</div>
                              <ul className="list-disc list-inside soap-content space-y-1">
                                {result.soap.subjective.symptoms.map((s: string, i: number) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.soap.subjective?.severity && (
                            <div>
                              <span className="font-bold text-xs text-gray-600">重症度: </span>
                              <span className="soap-content">{result.soap.subjective.severity}</span>
                            </div>
                          )}
                          {result.soap.subjective?.pastMedicalHistory && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">既往歴</div>
                              <div className="soap-content">{result.soap.subjective.pastMedicalHistory}</div>
                            </div>
                          )}
                          {/* Simple string fallback */}
                          {typeof result.soap.S === 'string' && (
                            <div className="soap-content">{result.soap.S}</div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section objective">
                        <div className="soap-label">
                          <div className="soap-badge" style={{ background: 'var(--soap-o)' }}>O</div>
                          客観的情報
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.objective?.vitalSigns && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-2">バイタルサイン</div>
                              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                                <table className="w-full text-xs">
                                  <tbody className="divide-y divide-gray-200">
                                    <tr>
                                      <td className="px-3 py-2 bg-gray-50 font-semibold text-gray-700">血圧</td>
                                      <td className="px-3 py-2">{result.soap.objective.vitalSigns.bloodPressure}</td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-gray-50 font-semibold text-gray-700">脈拍</td>
                                      <td className="px-3 py-2">{result.soap.objective.vitalSigns.pulse}</td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-gray-50 font-semibold text-gray-700">体温</td>
                                      <td className="px-3 py-2">{result.soap.objective.vitalSigns.temperature}</td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 bg-gray-50 font-semibold text-gray-700">呼吸数</td>
                                      <td className="px-3 py-2">{result.soap.objective.vitalSigns.respiratoryRate}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {result.soap.objective?.physicalExam && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">身体所見</div>
                              <div className="soap-content">{result.soap.objective.physicalExam}</div>
                            </div>
                          )}
                          {/* Simple string fallback */}
                          {typeof result.soap.O === 'string' && (
                            <div className="soap-content">{result.soap.O}</div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section assessment">
                        <div className="soap-label">
                          <div className="soap-badge" style={{ background: 'var(--soap-a)' }}>A</div>
                          評価・診断
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.assessment?.diagnosis && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="font-bold text-xs text-gray-600">診断名:</span>
                              <span className="soap-content font-bold">{result.soap.assessment.diagnosis}</span>
                              {result.soap.assessment?.icd10 && (
                                <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-mono">{result.soap.assessment.icd10}</span>
                              )}
                            </div>
                          )}
                          {result.soap.assessment?.differentialDiagnosis && result.soap.assessment.differentialDiagnosis.length > 0 && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">鑑別診断</div>
                              <ul className="list-disc list-inside soap-content space-y-1">
                                {result.soap.assessment.differentialDiagnosis.map((d: string, i: number) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.soap.assessment?.clinicalImpression && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">臨床的評価</div>
                              <div className="soap-content">{result.soap.assessment.clinicalImpression}</div>
                            </div>
                          )}
                          {/* Simple string fallback */}
                          {typeof result.soap.A === 'string' && (
                            <div className="soap-content">{result.soap.A}</div>
                          )}
                        </div>
                      </div>

                      <div className="soap-section plan">
                        <div className="soap-label">
                          <div className="soap-badge" style={{ background: 'var(--soap-p)' }}>P</div>
                          治療計画
                        </div>
                        <div className="space-y-3 text-sm">
                          {result.soap.plan?.treatment && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">治療方針</div>
                              <div className="soap-content">{result.soap.plan.treatment}</div>
                            </div>
                          )}
                          {result.soap.plan?.medications && result.soap.plan.medications.length > 0 && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-2">処方</div>
                              <div className="space-y-2">
                                {result.soap.plan.medications.map((med: any, i: number) => (
                                  <div key={i} className="bg-white rounded border border-gray-300 p-3">
                                    <div className="font-bold text-sm mb-1">{med.name}</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                      <div><span className="font-semibold">用量:</span> {med.dosage}</div>
                                      <div><span className="font-semibold">用法:</span> {med.frequency}</div>
                                      <div><span className="font-semibold">期間:</span> {med.duration}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {result.soap.plan?.tests && result.soap.plan.tests.length > 0 && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">追加検査</div>
                              <ul className="list-disc list-inside soap-content space-y-1">
                                {result.soap.plan.tests.map((t: string, i: number) => (
                                  <li key={i}>{t}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.soap.plan?.followUp && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">フォローアップ</div>
                              <div className="soap-content">{result.soap.plan.followUp}</div>
                            </div>
                          )}
                          {result.soap.plan?.patientEducation && (
                            <div>
                              <div className="font-bold text-xs text-gray-600 mb-1">患者指導</div>
                              <div className="soap-content">{result.soap.plan.patientEducation}</div>
                            </div>
                          )}
                          {/* Simple string fallback */}
                          {typeof result.soap.P === 'string' && (
                            <div className="soap-content">{result.soap.P}</div>
                          )}
                        </div>
                      </div>

                      {/* Generated timestamp */}
                      <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 font-mono border-t border-gray-200">
                        生成時刻: {new Date().toLocaleTimeString('ja-JP')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Footer disclaimer */}
          <footer className={`mt-4 pt-3 border-t border-gray-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-gray-500">
              <div className="font-mono">Next.js 14 / OpenAI API / Web Speech API で構築</div>
              <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>デモンストレーション用途のみ - 臨床使用不可</span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
