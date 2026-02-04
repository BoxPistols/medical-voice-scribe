'use client';

import { useState, useEffect, useRef } from 'react';
import type { SoapNote } from './api/analyze/types';
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
} from '@heroicons/react/24/outline';
import { StopIcon as StopIconSolid } from '@heroicons/react/24/solid';

// Constants
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Helper functions
const getTimestampForFilename = (): string => {
  // Returns format: 2026-02-03T14-30-45
  return new Date().toISOString().split('.')[0].replace(/:/g, '-');
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

  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSpeechSettings, setShowSpeechSettings] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);

  // Export/Import state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState<{
    type: 'json' | 'csv';
    content: string;
    filename: string;
  } | null>(null);

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Theme and settings state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showSettings, setShowSettings] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechCurrentIndexRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme management - Load from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('medical-scribe-theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Theme management - Apply theme
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;

      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.setAttribute('data-theme', 'dark');
        } else {
          root.removeAttribute('data-theme');
        }
      } else if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }

      localStorage.setItem('medical-scribe-theme', theme);
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-settings-menu]')) {
          setShowSettings(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

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

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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

    // Load available voices for text-to-speech
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const japaneseVoices = voices.filter(voice => voice.lang.startsWith('ja'));
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
      window.removeEventListener('resize', checkScreenSize);
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

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu) {
        const target = event.target as HTMLElement;
        // Check if click is outside the export menu container
        if (!target.closest('[data-export-menu]')) {
          setShowExportMenu(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showExportMenu]);

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

    // Stop speech if speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    setTranscript('');
    setResult(null);
    setError(null);
  };

  // Theme and settings functions
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleResetSettings = () => {
    const confirmed = window.confirm('すべての設定をリセットしますか？');
    if (confirmed) {
      setTheme('system');
      localStorage.removeItem('medical-scribe-theme');
      setSpeechRate(1.0);
      setSelectedVoiceIndex(0);
      setShowSettings(false);
    }
  };

  // Export/Import functions
  const exportAsJson = () => {
    if (!result) return;

    const dataStr = JSON.stringify(result, null, 2);
    const filename = `soap_note_${getTimestampForFilename()}.json`;

    setExportPreviewData({
      type: 'json',
      content: dataStr,
      filename
    });
    setShowExportPreview(true);
    setShowExportMenu(false);
  };

  const confirmExport = () => {
    if (!exportPreviewData) return;

    if (exportPreviewData.type === 'json') {
      const blob = new Blob([exportPreviewData.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportPreviewData.filename;
      link.click();
      URL.revokeObjectURL(url);
    } else if (exportPreviewData.type === 'csv') {
      const blob = new Blob(['\uFEFF' + exportPreviewData.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
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
      ['項目', '内容'],
      ['要約', result.summary || ''],
      ['主訴', result.patientInfo?.chiefComplaint || ''],
      ['期間', result.patientInfo?.duration || ''],
      ['現病歴', result.soap.subjective?.presentIllness || ''],
      ['症状', result.soap.subjective?.symptoms?.join(', ') || ''],
      ['重症度', result.soap.subjective?.severity || ''],
      ['発症', result.soap.subjective?.onset || ''],
      ['随伴症状', result.soap.subjective?.associatedSymptoms?.join(', ') || ''],
      ['既往歴', result.soap.subjective?.pastMedicalHistory || ''],
      ['内服薬', result.soap.subjective?.medications?.join(', ') || ''],
      ['血圧', result.soap.objective?.vitalSigns?.bloodPressure || ''],
      ['脈拍', result.soap.objective?.vitalSigns?.pulse || ''],
      ['体温', result.soap.objective?.vitalSigns?.temperature || ''],
      ['呼吸数', result.soap.objective?.vitalSigns?.respiratoryRate || ''],
      ['身体所見', result.soap.objective?.physicalExam || ''],
      ['検査所見', result.soap.objective?.laboratoryFindings || ''],
      ['診断名', result.soap.assessment?.diagnosis || ''],
      ['ICD-10', result.soap.assessment?.icd10 || ''],
      ['鑑別診断', result.soap.assessment?.differentialDiagnosis?.join(', ') || ''],
      ['臨床的印象', result.soap.assessment?.clinicalImpression || ''],
      ['治療方針', result.soap.plan?.treatment || ''],
      ['処方薬', result.soap.plan?.medications?.map(m => {
        const parts = [m?.name, m?.dosage, m?.frequency, m?.duration].filter(p => p !== undefined && p !== null && p !== '');
        return parts.join(' ');
      }).join('; ') || ''],
      ['検査', result.soap.plan?.tests?.join(', ') || ''],
      ['紹介', result.soap.plan?.referral || ''],
      ['フォローアップ', result.soap.plan?.followUp || ''],
      ['患者教育', result.soap.plan?.patientEducation || ''],
    ];

    const csvContent = csvRows.map(row =>
      row.map(escapeCsvCell).join(',')
    ).join('\n');

    const filename = `soap_note_${getTimestampForFilename()}.csv`;

    setExportPreviewData({
      type: 'csv',
      content: csvContent,
      filename
    });
    setShowExportPreview(true);
    setShowExportMenu(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
      return;
    }

    // Only accept JSON files
    if (!file.name.endsWith('.json')) {
      setError('JSON形式のファイルのみインポート可能です。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error('ファイルの内容が空です。');
        }

        const imported = JSON.parse(content);
        
        // Validate that imported is an object
        if (typeof imported !== 'object' || imported === null) {
          throw new Error('無効なJSON形式です。');
        }
        
        // Schema validation
        if (!imported.soap || !imported.patientInfo) {
          throw new Error('SOAPノート形式が正しくありません。soapまたはpatientInfoが見つかりません。');
        }

        // Validate required SOAP sections
        if (!imported.soap.subjective || !imported.soap.objective || 
            !imported.soap.assessment || !imported.soap.plan) {
          throw new Error('必須のSOAPセクション（S/O/A/P）が不足しています。');
        }

        // Validate that SOAP sections have the correct structure
        if (typeof imported.soap.subjective !== 'object' || 
            typeof imported.soap.objective !== 'object' ||
            typeof imported.soap.assessment !== 'object' ||
            typeof imported.soap.plan !== 'object') {
          throw new Error('SOAPセクションの構造が正しくありません。');
        }

        setResult(imported as SoapNote);
        setError(null);
        
        // Switch to result panel on mobile
        if (!isLargeScreen) {
          setActivePanel('result');
        }
      } catch (err) {
        console.error('Import error:', err);
        const errorMessage = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。';
        
        // Handle JSON syntax errors specifically
        if (err instanceof SyntaxError) {
          setError('ファイルの読み込みに失敗しました。正しいJSON形式のSOAPカルテファイルか確認してください。');
        } else {
          setError(errorMessage);
        }
      }
    };

    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました。');
    };

    reader.readAsText(file);
    
    // Reset input to allow re-importing the same file
    event.target.value = '';
  };

  // Text-to-speech functions
  const extractTextFromSoap = (soapNote: SoapNote): string => {
    let text = '';

    // Summary
    if (soapNote.summary) {
      text += `要約。${soapNote.summary}\n\n`;
    }

    // Patient Info
    if (soapNote.patientInfo) {
      text += '患者情報。';
      if (soapNote.patientInfo.chiefComplaint) {
        text += `主訴、${soapNote.patientInfo.chiefComplaint}。`;
      }
      if (soapNote.patientInfo.duration) {
        text += `期間、${soapNote.patientInfo.duration}。`;
      }
      text += '\n\n';
    }

    // Subjective
    text += 'S、主観的情報。';
    if (soapNote.soap.subjective?.presentIllness) {
      text += `現病歴、${soapNote.soap.subjective.presentIllness}。`;
    }
    if (soapNote.soap.subjective?.symptoms?.length > 0) {
      text += `症状、${soapNote.soap.subjective.symptoms.join('、')}。`;
    }
    if (soapNote.soap.subjective?.severity) {
      text += `重症度、${soapNote.soap.subjective.severity}。`;
    }
    text += '\n\n';

    // Objective
    text += 'O、客観的情報。';
    if (soapNote.soap.objective?.vitalSigns) {
      const vs = soapNote.soap.objective.vitalSigns;
      text += `バイタルサイン、血圧${vs.bloodPressure}、脈拍${vs.pulse}、体温${vs.temperature}、呼吸数${vs.respiratoryRate}。`;
    }
    if (soapNote.soap.objective?.physicalExam) {
      text += `身体所見、${soapNote.soap.objective.physicalExam}。`;
    }
    text += '\n\n';

    // Assessment
    text += 'A、評価・診断。';
    if (soapNote.soap.assessment?.diagnosis) {
      text += `診断名、${soapNote.soap.assessment.diagnosis}。`;
    }
    if (soapNote.soap.assessment?.differentialDiagnosis?.length > 0) {
      text += `鑑別診断、${soapNote.soap.assessment.differentialDiagnosis.join('、')}。`;
    }
    text += '\n\n';

    // Plan
    text += 'P、治療計画。';
    if (soapNote.soap.plan?.treatment) {
      text += `治療方針、${soapNote.soap.plan.treatment}。`;
    }
    if (soapNote.soap.plan?.medications?.length > 0) {
      text += '処方、';
      soapNote.soap.plan.medications.forEach((med, i) => {
        text += `${i + 1}、${med.name}、用量${med.dosage}、用法${med.frequency}、期間${med.duration}。`;
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
    utterance.lang = 'ja-JP';
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
      <header className="app-header">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                  <DocumentTextIcon className="w-5 h-5 text-white" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-theme-primary leading-none">
                    Medical Voice Scribe
                  </h1>
                  <p className="text-xs text-theme-secondary font-medium mt-0.5">AI音声問診・カルテ自動生成</p>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-3">
              <div className={`status-badge ${isRecording ? 'recording' : 'idle'}`}>
                <div className={`status-indicator ${isRecording ? 'recording' : 'idle'} ${isRecording ? 'recording-pulse' : ''}`} />
                {isRecording ? '録音中' : '待機中'}
              </div>

              {/* Settings button */}
              <div className="relative" data-settings-menu>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg text-theme-tertiary btn-theme-hover"
                  aria-label="設定"
                  title="設定"
                >
                  <Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />
                </button>

                {/* Settings dropdown */}
                {showSettings && (
                  <div className="settings-dropdown">
                    {/* Theme section */}
                    <div className="settings-section">
                      <label className="settings-label">テーマ</label>
                      <div className="theme-toggle-group">
                        <button
                          onClick={() => handleThemeChange('light')}
                          className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                          title="ライトモード"
                        >
                          <SunIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">ライト</span>
                        </button>
                        <button
                          onClick={() => handleThemeChange('dark')}
                          className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                          title="ダークモード"
                        >
                          <MoonIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">ダーク</span>
                        </button>
                        <button
                          onClick={() => handleThemeChange('system')}
                          className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
                          title="システム設定に従う"
                        >
                          <ComputerDesktopIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">自動</span>
                        </button>
                      </div>
                    </div>

                    {/* Reset section */}
                    <div className="settings-section">
                      <button
                        onClick={handleResetSettings}
                        className="settings-reset-btn whitespace-nowrap"
                      >
                        <TrashIcon className="w-4 h-4 inline mr-2" />
                        リセット
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg text-theme-tertiary btn-theme-hover"
                aria-label="ヘルプを表示"
                title="使い方を見る"
              >
                <QuestionMarkCircleIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Mobile menu */}
            <div className="sm:hidden flex items-center gap-2">
              <div className={`status-indicator ${isRecording ? 'recording recording-pulse' : 'idle'}`} />

              {/* Settings button (Mobile) */}
              <div className="relative" data-settings-menu>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 rounded-lg text-theme-tertiary btn-theme-hover"
                  aria-label="設定"
                  title="設定"
                >
                  <Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />
                </button>

                {/* Settings dropdown */}
                {showSettings && (
                  <div className="settings-dropdown">
                    {/* Theme section */}
                    <div className="settings-section">
                      <label className="settings-label">テーマ</label>
                      <div className="theme-toggle-group">
                        <button
                          onClick={() => handleThemeChange('light')}
                          className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                          title="ライトモード"
                        >
                          <SunIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">ライト</span>
                        </button>
                        <button
                          onClick={() => handleThemeChange('dark')}
                          className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                          title="ダークモード"
                        >
                          <MoonIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">ダーク</span>
                        </button>
                        <button
                          onClick={() => handleThemeChange('system')}
                          className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
                          title="システム設定に従う"
                        >
                          <ComputerDesktopIcon className="w-5 h-5" aria-hidden="true" />
                          <span className="sr-only">自動</span>
                        </button>
                      </div>
                    </div>

                    {/* Reset section */}
                    <div className="settings-section">
                      <button
                        onClick={handleResetSettings}
                        className="settings-reset-btn whitespace-nowrap"
                      >
                        <TrashIcon className="w-4 h-4 inline mr-2" />
                        リセット
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowHelp(true)}
                className="p-1.5 rounded-lg text-theme-tertiary btn-theme-hover"
                aria-label="ヘルプを表示"
                title="使い方を見る"
              >
                <QuestionMarkCircleIcon className="w-5 h-5" aria-hidden="true" />
              </button>
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
                  {isRecording ? (
                    <StopIcon className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4" aria-hidden="true" />
                  )}
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
                      <SparklesIcon className="w-4 h-4" aria-hidden="true" />
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
                <TrashIcon className="w-4 h-4" aria-hidden="true" />
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
                        <ArrowRightIcon className="w-4 h-4" />
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
                className="relative flex-shrink-0"
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
                    {/* Mobile layout */}
                    {!isLargeScreen ? (
                      <div className="w-full space-y-2">
                        {/* 1段目: 戻るボタンと見出し */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setActivePanel('transcript')}
                            className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                            aria-label="会話テキストに戻る"
                          >
                            <ArrowLeftIcon className="w-4 h-4" />
                            <span>会話</span>
                          </button>
                          <h2 className="panel-title text-sm whitespace-nowrap">カルテ</h2>
                        </div>
                        {/* 2段目: アクションボタン群 */}
                        <div className="flex items-center justify-end gap-1">
                          {/* Import button */}
                          <button
                            onClick={handleImportClick}
                            className="btn btn-secondary py-1 px-2 text-xs"
                            aria-label="インポート"
                            title="インポート"
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
                              title="エクスポート"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" />
                            </button>

                            {showExportMenu && result && (
                              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                <div className="py-1">
                                  <button
                                    onClick={exportAsJson}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <DocumentIcon className="w-3 h-3" />
                                    JSON
                                  </button>
                                  <button
                                    onClick={exportAsCsv}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
                            aria-label={isSpeaking ? '読み上げを停止' : 'カルテを読み上げ'}
                          >
                            {isSpeaking ? (
                              <StopIconSolid className="w-4 h-4" />
                            ) : (
                              <SpeakerWaveIcon className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setShowSpeechSettings(!showSpeechSettings)}
                            disabled={!result}
                            className="btn btn-secondary py-1 px-2 text-xs"
                            aria-label="音声設定"
                          >
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showSpeechSettings ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full space-y-3">
                        {/* 上段: 見出し */}
                        <h2 className="panel-title">AI生成SOAPカルテ</h2>
                        {/* 下段: アクションボタン群 */}
                        <div className="flex items-center gap-2">
                          {/* Import button */}
                          <button
                            onClick={handleImportClick}
                            className="btn btn-secondary"
                            aria-label="カルテをインポート"
                            title="カルテをインポート"
                          >
                            <ArrowUpTrayIcon className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">インポート</span>
                          </button>

                          {/* Export dropdown */}
                          <div className="relative" data-export-menu>
                            <button
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              disabled={!result}
                              className="btn btn-secondary"
                              aria-label="カルテをエクスポート"
                              title="カルテをエクスポート"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
                              <span className="hidden sm:inline">エクスポート</span>
                              <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>

                            {/* Export menu dropdown */}
                            {showExportMenu && result && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                <div className="py-1">
                                  <button
                                    onClick={exportAsJson}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <DocumentIcon className="w-4 h-4" />
                                    JSON形式
                                  </button>
                                  <button
                                    onClick={exportAsCsv}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <DocumentChartBarIcon className="w-4 h-4" />
                                    CSV形式
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={toggleSpeech}
                            disabled={!result}
                            className="btn btn-secondary"
                            aria-label={isSpeaking ? '読み上げを停止' : 'カルテを読み上げ'}
                          >
                            {isSpeaking ? (
                              <>
                                <StopIconSolid className="w-4 h-4" aria-hidden="true" />
                                停止
                              </>
                            ) : (
                              <>
                                <SpeakerWaveIcon className="w-4 h-4" aria-hidden="true" />
                                読み上げ
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowSpeechSettings(!showSpeechSettings)}
                            disabled={!result}
                            className="btn btn-secondary p-2"
                            aria-label="音声設定"
                            title="音声設定"
                          >
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showSpeechSettings ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Speech settings panel */}
                  {showSpeechSettings && result && (
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                      <div className="space-y-4">
                        {/* Service Selection */}
                        {/* Speed selection */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            読み上げスピード
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => setSpeechRate(rate)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                  speechRate === rate
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
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
                            <label htmlFor="voice-select" className="block text-xs font-semibold text-gray-700 mb-2">
                              システム音声の選択
                            </label>
                            <select
                              id="voice-select"
                              value={selectedVoiceIndex}
                              onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                      <DocumentTextIcon className="empty-state-icon" aria-hidden="true" />
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
                    <div className="space-y-3 p-6">
                      {/* Summary */}
                      {result.summary && (
                        <div className="p-6 bg-amber-50 rounded-lg shadow-sm border-l-4 border-amber-600">
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
                        <div className="p-6 bg-blue-50 rounded-lg shadow-sm border-l-4 border-blue-600">
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
                                {result.soap.plan.medications.map((med, i: number) => (
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

          {/* Export Preview Modal */}
          {showExportPreview && exportPreviewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    エクスポートプレビュー ({exportPreviewData.type.toUpperCase()})
                  </h3>
                  <button
                    onClick={() => {
                      setShowExportPreview(false);
                      setExportPreviewData(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="プレビューを閉じる"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="font-mono">{exportPreviewData.filename}</span>
                  </div>
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                    {exportPreviewData.content}
                  </pre>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => {
                      setShowExportPreview(false);
                      setExportPreviewData(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={confirmExport}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ダウンロード
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">使い方ガイド</h3>
                  </div>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="ヘルプを閉じる"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-6">
                    {/* Overview */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        このアプリについて
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Medical Voice Scribeは、音声による医療問診を自動的にSOAPカルテ形式に変換するデモアプリケーションです。
                        医療現場での記録業務の効率化を目的としています。
                      </p>
                    </div>

                    {/* How to Use */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        基本的な使い方
                      </h4>
                      <ol className="space-y-3 text-sm text-gray-700">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                          <div>
                            <span className="font-semibold">録音ボタンをクリック</span>して、音声入力を開始します。マイクの使用許可を求められた場合は許可してください。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                          <div>
                            医師と患者の会話を<span className="font-semibold">自然に話します</span>。問診内容、症状、診察結果などを含めてください。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                          <div>
                            録音が完了したら<span className="font-semibold">停止ボタン</span>をクリックし、テキスト化された内容を確認します。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                          <div>
                            必要に応じてテキストを編集し、<span className="font-semibold">「SOAP生成」ボタン</span>をクリックします。
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                          <div>
                            AIが自動的に<span className="font-semibold">SOAP形式のカルテ</span>を生成します。
                          </div>
                        </li>
                      </ol>
                    </div>

                    {/* Features */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                        </svg>
                        主な機能
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="font-semibold text-gray-900 mb-1">🎤 音声入力</div>
                          <div className="text-gray-600 text-xs">ブラウザの音声認識機能を使用してリアルタイムに文字起こし</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="font-semibold text-gray-900 mb-1">🤖 AI生成</div>
                          <div className="text-gray-600 text-xs">OpenAI GPT-4oを使用したSOAPカルテの自動生成</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="font-semibold text-gray-900 mb-1">🔊 読み上げ</div>
                          <div className="text-gray-600 text-xs">生成されたカルテをシステム音声で読み上げ（速度・音声調整可能）</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="font-semibold text-gray-900 mb-1">💾 保存・共有</div>
                          <div className="text-gray-600 text-xs">JSON/CSV形式でエクスポート、インポートが可能</div>
                        </div>
                      </div>
                    </div>

                    {/* SOAP Format */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        SOAP形式とは
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded flex items-center justify-center text-xs font-bold">S</div>
                          <div>
                            <span className="font-semibold text-gray-900">Subjective（主観的情報）</span>
                            <p className="text-gray-600 text-xs mt-0.5">患者が訴える症状や感じていること</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-700 text-white rounded flex items-center justify-center text-xs font-bold">O</div>
                          <div>
                            <span className="font-semibold text-gray-900">Objective（客観的情報）</span>
                            <p className="text-gray-600 text-xs mt-0.5">測定可能な検査結果やバイタルサイン</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-emerald-700 text-white rounded flex items-center justify-center text-xs font-bold">A</div>
                          <div>
                            <span className="font-semibold text-gray-900">Assessment（評価）</span>
                            <p className="text-gray-600 text-xs mt-0.5">診断名や臨床的な評価・判断</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-purple-700 text-white rounded flex items-center justify-center text-xs font-bold">P</div>
                          <div>
                            <span className="font-semibold text-gray-900">Plan（計画）</span>
                            <p className="text-gray-600 text-xs mt-0.5">治療方針、処方、追加検査、フォローアップ</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Important Notes */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        重要な注意事項
                      </h4>
                      <ul className="space-y-1 text-xs text-amber-900">
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>このアプリは<strong>デモンストレーション用途</strong>です。実際の臨床現場での使用は想定していません。</span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>生成されたカルテ内容は必ず<strong>医療従事者が確認・修正</strong>してください。</span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>個人情報や機密情報を含むデータの入力は<strong>避けてください</strong>。</span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>音声認識の精度はブラウザやマイクの品質に依存します。</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}

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
