"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  MusicalNoteIcon,
  SparklesIcon,
  ComputerDesktopIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import {
  BREATH_PATTERNS,
  getPatternById,
  cycleDurationSec,
  getPhaseState,
  AmbientPadEngine,
  clamp01,
  type BreathPattern,
  type BreathPhaseState,
} from "@/lib/wellness/breathing";
import { addBreathSession, getBreathSessions, newId } from "@/lib/wellness/storage";
import type { BreathSession } from "@/lib/wellness/types";
import { getVoiceForLanguage } from "@/lib/audioHelpers";

// ── 定数 ──────────────────────────────────────────────────────────────────

/** 瞑想タイマーのプリセット（分）。0 は「無制限（手動停止）」 */
const DURATION_PRESETS: { id: string; label: string; minutes: number }[] = [
  { id: "m1", label: "1分リセット", minutes: 1 },
  { id: "m3", label: "3分", minutes: 3 },
  { id: "m5", label: "5分", minutes: 5 },
  { id: "m10", label: "10分", minutes: 10 },
];

/** セッション種別ごとのガイド文（控えめに：開始と中盤のみ読み上げる） */
type SessionKind = "focus" | "relax" | "sleep";

interface SessionMeta {
  id: SessionKind;
  label: string;
  /** 開始時に読み上げる短い導入 */
  intro: string;
  /** 中盤（半分経過）で読み上げる一言 */
  midway: string;
  /** 終了時に読み上げる締め */
  outro: string;
}

const SESSIONS: readonly SessionMeta[] = [
  {
    id: "focus",
    label: "集中",
    intro: "肩の力を抜いて、呼吸に意識を向けましょう。",
    midway: "そのまま、静かに呼吸を続けます。",
    outro: "ゆっくり目を開けて、今の落ち着きを保ちましょう。",
  },
  {
    id: "relax",
    label: "リラックス",
    intro: "息を吐くたびに、緊張がほどけていきます。",
    midway: "心地よさに身をゆだねましょう。",
    outro: "穏やかな気持ちのまま、過ごしましょう。",
  },
  {
    id: "sleep",
    label: "入眠",
    intro: "まぶたを閉じて、長く静かに息を吐きましょう。",
    midway: "体が重く、温かくなっていくのを感じます。",
    outro: "そのまま、安らかな眠りへ。",
  },
] as const;

/** 音源の種類 */
type SoundSource = "off" | "pad" | "bgm";

const ORB_VIEWBOX = 320;
const RING_RADIUS = 132;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── ヘルパー ───────────────────────────────────────────────────────────────

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** 落ち着いた配色（teal〜sky〜violet）。フェーズ進捗で混ぜる。 */
function phaseColor(scale: number): { r: number; g: number; b: number } {
  // teal (#14b8a6) → sky (#38bdf8) → violet (#a78bfa)
  const teal = { r: 20, g: 184, b: 166 };
  const sky = { r: 56, g: 189, b: 248 };
  const violet = { r: 167, g: 139, b: 250 };
  const t = clamp01(scale);
  // 0→0.5: teal→sky, 0.5→1: sky→violet
  if (t < 0.5) {
    const k = t / 0.5;
    return {
      r: Math.round(teal.r + (sky.r - teal.r) * k),
      g: Math.round(teal.g + (sky.g - teal.g) * k),
      b: Math.round(teal.b + (sky.b - teal.b) * k),
    };
  }
  const k = (t - 0.5) / 0.5;
  return {
    r: Math.round(sky.r + (violet.r - sky.r) * k),
    g: Math.round(sky.g + (violet.g - sky.g) * k),
    b: Math.round(sky.b + (violet.b - sky.b) * k),
  };
}

// ── アンビエント背景キャンバス ─────────────────────────────────────────────

interface AmbientCanvasProps {
  /** 呼吸スケール 0..1 を渡す ref（rAF 内で読み取り、再描画しない） */
  scaleRef: React.MutableRefObject<number>;
  /** アニメを止めるか（reduce-motion / 非アクティブ時） */
  reducedMotion: boolean;
  /** デスクモード（より静かに） */
  desk: boolean;
}

function AmbientCanvas({ scaleRef, reducedMotion, desk }: AmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let mounted = true;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();

    // ゆっくり漂うブロブ（オーロラ風）。reduce-motion 時は1回だけ静止描画。
    const blobs = [
      { hue: 174, ox: 0.3, oy: 0.35, r: 0.55, sx: 0.00007, sy: 0.00005, ph: 0 },
      { hue: 199, ox: 0.7, oy: 0.4, r: 0.5, sx: 0.00005, sy: 0.00008, ph: 2 },
      { hue: 258, ox: 0.5, oy: 0.7, r: 0.6, sx: 0.00006, sy: 0.00004, ph: 4 },
    ];

    const draw = (time: number) => {
      if (!mounted) return;
      const w = canvas.width;
      const h = canvas.height;
      const scale = scaleRef.current; // 吸う=明るく/拡がる
      const brightness = 0.32 + scale * 0.18 - (desk ? 0.1 : 0);

      ctx.clearRect(0, 0, w, h);
      // 落ち着いた暗めのベース
      ctx.fillStyle = desk ? "rgba(8,12,20,0.0)" : "rgba(10,14,24,0.0)";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const driftX = reducedMotion ? 0 : Math.sin(time * b.sx + b.ph) * 0.08;
        const driftY = reducedMotion ? 0 : Math.cos(time * b.sy + b.ph) * 0.08;
        const cx = (b.ox + driftX) * w;
        const cy = (b.oy + driftY) * h;
        const radius = b.r * Math.min(w, h) * (0.9 + scale * 0.18);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const alpha = brightness * (desk ? 0.5 : 0.7);
        grad.addColorStop(0, `hsla(${b.hue}, 72%, 62%, ${alpha})`);
        grad.addColorStop(0.5, `hsla(${b.hue}, 70%, 52%, ${alpha * 0.4})`);
        grad.addColorStop(1, "hsla(0,0%,0%,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      if (!reducedMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    draw(0);

    const onResize = () => {
      resize();
      if (reducedMotion) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [scaleRef, reducedMotion, desk]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}

// ── メインコンポーネント ────────────────────────────────────────────────────

export default function BreatheMode() {
  // 設定
  const [patternId, setPatternId] = useState<string>(BREATH_PATTERNS[0].id);
  const [durationId, setDurationId] = useState<string>(DURATION_PRESETS[1].id); // 3分
  const [sessionKind, setSessionKind] = useState<SessionKind>("relax");
  const [voiceOn, setVoiceOn] = useState(true);
  const [soundSource, setSoundSource] = useState<SoundSource>("pad");
  const [volume, setVolume] = useState(0.4);
  const [deskMode, setDeskMode] = useState(false);

  // 実行状態
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [phase, setPhase] = useState<BreathPhaseState>(() =>
    getPhaseState(0, getPatternById(BREATH_PATTERNS[0].id)),
  );
  const [elapsedTotalSec, setElapsedTotalSec] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  // refs（rAF / 音 / 読み上げ の安定参照）
  const rafRef = useRef<number>(0);
  const startTsRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0); // 一時停止時の累積経過ms
  const padRef = useRef<AmbientPadEngine | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const scaleRef = useRef<number>(0); // 背景キャンバス用（再描画を避ける）
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]); // 読み上げ音声一覧（ウォームアップ済み）
  const midwaySpokenRef = useRef<boolean>(false);
  const voiceOnRef = useRef<boolean>(voiceOn);
  voiceOnRef.current = voiceOn;
  const soundSourceRef = useRef<SoundSource>(soundSource);
  soundSourceRef.current = soundSource;
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;

  const pattern: BreathPattern = useMemo(() => getPatternById(patternId), [patternId]);
  const durationMin = useMemo(
    () => DURATION_PRESETS.find((d) => d.id === durationId)?.minutes ?? 3,
    [durationId],
  );
  const totalSessionSec = durationMin * 60;

  // ── 初期化：reduce-motion 検出 / 過去セッション数 ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);
    setSessionCount(getBreathSessions().length);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // ── SpeechSynthesis 音声一覧のウォームアップ（初回 getVoices() が [] になる対策） ──
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // ── 読み上げ ──
  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const synth = window.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(text);
      const voice = getVoiceForLanguage(voicesRef.current, "ja-JP");
      if (voice) utter.voice = voice;
      utter.lang = "ja-JP";
      utter.rate = 0.9;
      utter.pitch = 1;
      utter.volume = 0.9;
      synth.speak(utter);
    } catch {
      // 読み上げ非対応は無視
    }
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // 無視
      }
    }
  }, []);

  // ── 音源の起動/停止 ──
  const startSound = useCallback(() => {
    const src = soundSourceRef.current;
    // 既存を一旦止める
    padRef.current?.dispose();
    padRef.current = null;
    if (bgmRef.current) {
      bgmRef.current.pause();
    }

    if (src === "pad") {
      const engine = new AmbientPadEngine(volumeRef.current);
      engine.start();
      padRef.current = engine;
    } else if (src === "bgm") {
      if (!bgmRef.current) {
        const audio = new Audio("/bgm.mp3");
        audio.loop = true;
        bgmRef.current = audio;
      }
      bgmRef.current.volume = clamp01(volumeRef.current);
      void bgmRef.current.play().catch(() => {
        // 自動再生制限などは無視（ユーザー操作起点で呼ぶ前提）
      });
    }
  }, []);

  const pauseSound = useCallback(() => {
    // WebAudio (pad) は一旦破棄（リソース節約のため。再開時は新エンジンで再開）
    padRef.current?.dispose();
    padRef.current = null;
    if (bgmRef.current) {
      bgmRef.current.pause();
    }
  }, []);

  const stopSound = useCallback(() => {
    padRef.current?.dispose();
    padRef.current = null;
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  }, []);

  // 音量変化を生きている音源に反映
  useEffect(() => {
    padRef.current?.setVolume(volume);
    if (bgmRef.current) bgmRef.current.volume = clamp01(volume);
  }, [volume]);

  // 音源種別の切替（再生中のみ即時反映）
  useEffect(() => {
    if (!running) return;
    startSound();
    // running中の切替のみ。startSound は ref を読むので依存は soundSource。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundSource]);

  // ── セッション記録 ──
  const recordSession = useCallback(
    (durationSec: number) => {
      if (durationSec < 3) return; // 極端に短いものは記録しない
      const session: BreathSession = {
        id: newId(),
        timestamp: Date.now(),
        pattern: patternId,
        durationSec: Math.round(durationSec),
      };
      addBreathSession(session);
      setSessionCount((c) => c + 1);
    },
    [patternId],
  );

  // ── 停止（完了 or 手動） ──
  const finishSession = useCallback(
    (opts: { completed: boolean }) => {
      cancelAnimationFrame(rafRef.current);
      const elapsedSec = pausedAtRef.current / 1000;
      stopSound();
      recordSession(elapsedSec);
      setRunning(false);
      setFinished(true);
      setElapsedTotalSec(elapsedSec);
      if (opts.completed) {
        const meta = SESSIONS.find((s) => s.id === sessionKind);
        if (meta) speak(meta.outro);
      } else {
        cancelSpeech();
      }
      pausedAtRef.current = 0;
      midwaySpokenRef.current = false;
    },
    [cancelSpeech, recordSession, sessionKind, speak, stopSound],
  );

  // ── 1フレーム分の処理（最新の依存を ref 経由で参照させ、ループは単一オーナーが回す） ──
  const frame = useCallback(() => {
    const now = performance.now();
    const elapsedMs = pausedAtRef.current + (now - startTsRef.current);
    const elapsedSec = elapsedMs / 1000;

    const state = getPhaseState(elapsedMs, pattern);
    scaleRef.current = state.scale;
    padRef.current?.applyBreathScale(state.scale);
    setPhase(state);
    setElapsedTotalSec(elapsedSec);

    // 中盤の読み上げ（半分経過、一度だけ）
    if (
      !midwaySpokenRef.current &&
      totalSessionSec > 0 &&
      elapsedSec >= totalSessionSec / 2
    ) {
      midwaySpokenRef.current = true;
      const meta = SESSIONS.find((s) => s.id === sessionKind);
      if (meta) speak(meta.midway);
    }

    // 終了判定（true を返したらループ側は再スケジュールしない）
    if (totalSessionSec > 0 && elapsedSec >= totalSessionSec) {
      pausedAtRef.current = totalSessionSec * 1000;
      finishSession({ completed: true });
      return true;
    }
    return false;
  }, [finishSession, pattern, sessionKind, speak, totalSessionSec]);

  // frame の最新クロージャを ref に保持（ループ effect を frame 変更で張り直さない）
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // rAF ループの単一オーナー。running の true/false のみで開始・停止する。
  useEffect(() => {
    if (!running) return;
    let active = true;
    const loop = () => {
      if (!active) return;
      const done = frameRef.current();
      if (done || !active) return;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  // ── 開始 ──
  const handleStart = useCallback(() => {
    setFinished(false);
    pausedAtRef.current = 0;
    midwaySpokenRef.current = false;
    startTsRef.current = performance.now();
    startSound();
    const meta = SESSIONS.find((s) => s.id === sessionKind);
    if (meta) speak(meta.intro);
    setRunning(true);
  }, [sessionKind, speak, startSound]);

  // ── 一時停止 ──
  const handlePause = useCallback(() => {
    pausedAtRef.current += performance.now() - startTsRef.current;
    setRunning(false);
    cancelSpeech();
    pauseSound();
  }, [cancelSpeech, pauseSound]);

  // ── 再開 ──
  const handleResume = useCallback(() => {
    setFinished(false);
    startTsRef.current = performance.now();
    startSound();
    setRunning(true);
  }, [startSound]);

  // ── 手動停止 ──
  const handleStop = useCallback(() => {
    // running中なら累積を確定
    if (running) {
      pausedAtRef.current += performance.now() - startTsRef.current;
    }
    finishSession({ completed: false });
  }, [finishSession, running]);

  // ── アンマウント時の確実な解放 ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      padRef.current?.dispose();
      padRef.current = null;
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.src = "";
        bgmRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // 無視
        }
      }
    };
  }, []);

  // ── 表示用の派生値 ──
  const orbColor = phaseColor(phase.scale);
  // reduce-motion 時は拍動を止めて視覚的に固定（テキスト更新は維持）
  const orbScale = reducedMotion ? 1 : 0.55 + phase.scale * 0.45; // 0.55..1.0
  const phaseRemaining = Math.ceil(phase.phaseRemainingSec);
  const phaseRingOffset = reducedMotion
    ? 0
    : RING_CIRCUMFERENCE * (1 - clamp01(phase.phaseProgress));
  const sessionRemaining = Math.max(0, totalSessionSec - elapsedTotalSec);
  const idle = !running && !finished;

  return (
    <section
      className={`relative w-full ${
        deskMode ? "min-h-[70vh]" : "min-h-[60vh]"
      }`}
      aria-label="呼吸・瞑想"
    >
      <style>{`
        .bm-orb { transition: transform 120ms linear; }
        @media (prefers-reduced-motion: reduce) {
          .bm-orb { transition: none; }
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-theme-accent text-white">
              <HeartIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-theme-primary leading-tight">
                呼吸・瞑想
              </h2>
              <p className="text-xs text-theme-tertiary">
                デスクワークの合間に、こころを整える
              </p>
            </div>
          </div>

          {/* 通常 / デスク トグル */}
          <div
            className="flex items-center gap-0.5 bg-theme-surface rounded-xl p-0.5 border border-theme-light"
            role="group"
            aria-label="レイアウト切替"
          >
            <button
              type="button"
              onClick={() => setDeskMode(false)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                !deskMode
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-theme-tertiary hover:text-theme-secondary"
              }`}
              aria-pressed={!deskMode}
            >
              <SparklesIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">通常</span>
            </button>
            <button
              type="button"
              onClick={() => setDeskMode(true)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                deskMode
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-theme-tertiary hover:text-theme-secondary"
              }`}
              aria-pressed={deskMode}
            >
              <ComputerDesktopIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">デスク</span>
            </button>
          </div>
        </div>

        <div className={deskMode ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"}>
          {/* ── オーブ + 背景 ── */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-theme-light ${
              deskMode ? "bg-[#070b14]" : "bg-[#0a0e18]"
            }`}
            style={{ minHeight: deskMode ? "62vh" : "420px" }}
          >
            <AmbientCanvas
              scaleRef={scaleRef}
              reducedMotion={reducedMotion || idle}
              desk={deskMode}
            />

            {/* オーブ本体 */}
            <div className="relative z-10 flex h-full flex-col items-center justify-center py-10">
              <div
                className="relative flex items-center justify-center"
                style={{ width: 300, height: 300 }}
              >
                {/* カウントダウンリング（フェーズ進捗） */}
                <svg
                  viewBox={`0 0 ${ORB_VIEWBOX} ${ORB_VIEWBOX}`}
                  className="absolute inset-0 h-full w-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx={ORB_VIEWBOX / 2}
                    cy={ORB_VIEWBOX / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={6}
                  />
                  <circle
                    cx={ORB_VIEWBOX / 2}
                    cy={ORB_VIEWBOX / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={`rgba(${orbColor.r},${orbColor.g},${orbColor.b},0.9)`}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={running ? phaseRingOffset : RING_CIRCUMFERENCE}
                    style={{ transition: "stroke-dashoffset 120ms linear" }}
                  />
                </svg>

                {/* 呼吸オーブ */}
                <div
                  className="bm-orb flex items-center justify-center rounded-full"
                  style={{
                    width: 220,
                    height: 220,
                    transform: `scale(${orbScale})`,
                    background: `radial-gradient(circle at 35% 30%, rgba(${orbColor.r},${orbColor.g},${orbColor.b},0.95), rgba(${orbColor.r},${orbColor.g},${orbColor.b},0.35) 60%, rgba(${orbColor.r},${orbColor.g},${orbColor.b},0.08) 100%)`,
                    boxShadow: `0 0 60px 8px rgba(${orbColor.r},${orbColor.g},${orbColor.b},0.35)`,
                  }}
                >
                  <div className="text-center" aria-live="polite">
                    <div className="text-2xl font-semibold text-white drop-shadow">
                      {running ? phase.label : finished ? "完了" : "準備"}
                    </div>
                    {running && (
                      <div className="mt-1 text-4xl font-bold tabular-nums text-white drop-shadow">
                        {phaseRemaining}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 状態テキスト */}
              <div className="mt-6 flex items-center gap-4 text-sm text-white/80">
                <span className="tabular-nums" aria-label="サイクル数">
                  サイクル {phase.cycle}
                </span>
                <span aria-hidden="true">•</span>
                <span className="tabular-nums" aria-label="残り時間">
                  残り {formatMmSs(sessionRemaining)}
                </span>
              </div>

              {finished && (
                <div
                  className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white"
                  role="status"
                >
                  お疲れさまでした。{Math.round(elapsedTotalSec / 60 * 10) / 10} 分の呼吸を記録しました。
                </div>
              )}

              {/* 操作（オーブ直下：デスクモードでも最小限ここに残す） */}
              <div className="mt-6 flex items-center gap-2">
                {idle && (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                  >
                    <PlayIcon className="h-5 w-5" aria-hidden="true" />
                    はじめる
                  </button>
                )}
                {running && (
                  <>
                    <button
                      type="button"
                      onClick={handlePause}
                      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                      aria-label="一時停止"
                    >
                      <PauseIcon className="h-5 w-5" aria-hidden="true" />
                      一時停止
                    </button>
                    <button
                      type="button"
                      onClick={handleStop}
                      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                      aria-label="終了して記録"
                    >
                      <StopIcon className="h-5 w-5" aria-hidden="true" />
                      終了
                    </button>
                  </>
                )}
                {!running && !idle && (
                  <>
                    <button
                      type="button"
                      onClick={handleResume}
                      className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                    >
                      <PlayIcon className="h-5 w-5" aria-hidden="true" />
                      {finished ? "もう一度" : "再開"}
                    </button>
                    {!finished && (
                      <button
                        type="button"
                        onClick={handleStop}
                        className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                        aria-label="終了して記録"
                      >
                        <StopIcon className="h-5 w-5" aria-hidden="true" />
                        終了
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* デスクモード：音量だけの最小UI */}
              {deskMode && (
                <div className="mt-6 flex w-full max-w-xs items-center gap-3 px-2">
                  <SpeakerWaveIcon className="h-5 w-5 text-white/70" aria-hidden="true" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    className="h-1.5 w-full cursor-pointer accent-teal-400"
                    aria-label="音量"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── 設定パネル（通常モードのみ） ── */}
          {!deskMode && (
            <div className="space-y-4">
              {/* 呼吸パターン */}
              <fieldset className="rounded-2xl border border-theme-light bg-theme-card p-4">
                <legend className="px-1 text-sm font-semibold text-theme-primary">
                  呼吸パターン
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {BREATH_PATTERNS.map((p) => {
                    const active = p.id === patternId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPatternId(p.id)}
                        disabled={running}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                          active
                            ? "border-teal-400 bg-theme-highlight"
                            : "border-theme-light hover:bg-theme-surface"
                        }`}
                        aria-pressed={active}
                      >
                        <div className="text-sm font-medium text-theme-primary">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-theme-tertiary leading-snug">
                          {p.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-theme-muted">
                  1サイクル {cycleDurationSec(pattern)} 秒
                </p>
              </fieldset>

              {/* 時間プリセット */}
              <fieldset className="rounded-2xl border border-theme-light bg-theme-card p-4">
                <legend className="px-1 text-sm font-semibold text-theme-primary">
                  瞑想の長さ
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {DURATION_PRESETS.map((d) => {
                    const active = d.id === durationId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDurationId(d.id)}
                        disabled={running}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                          active
                            ? "border-teal-400 bg-theme-highlight text-theme-primary"
                            : "border-theme-light text-theme-secondary hover:bg-theme-surface"
                        }`}
                        aria-pressed={active}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* セッション種別 + 音声ガイド */}
              <fieldset className="rounded-2xl border border-theme-light bg-theme-card p-4">
                <legend className="px-1 text-sm font-semibold text-theme-primary">
                  ガイド
                </legend>
                <div
                  className="mt-2 flex gap-1.5 rounded-xl bg-theme-surface p-1"
                  role="group"
                  aria-label="セッション種別"
                >
                  {SESSIONS.map((s) => {
                    const active = s.id === sessionKind;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSessionKind(s.id)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-teal-500 text-white shadow-sm"
                            : "text-theme-tertiary hover:text-theme-secondary"
                        }`}
                        aria-pressed={active}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex items-center justify-between gap-2 text-sm text-theme-secondary">
                  <span className="flex items-center gap-1.5">
                    {voiceOn ? (
                      <SpeakerWaveIcon className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                    ) : (
                      <SpeakerXMarkIcon className="h-4 w-4 text-theme-muted" aria-hidden="true" />
                    )}
                    音声ガイド
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={voiceOn}
                    aria-label="音声ガイドの切替"
                    onClick={() => {
                      setVoiceOn((v) => {
                        if (v) cancelSpeech();
                        return !v;
                      });
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      voiceOn ? "bg-teal-500" : "bg-theme-tertiary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        voiceOn ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </label>
              </fieldset>

              {/* 音 */}
              <fieldset className="rounded-2xl border border-theme-light bg-theme-card p-4">
                <legend className="px-1 text-sm font-semibold text-theme-primary">
                  アンビエント音
                </legend>
                <div
                  className="mt-2 flex gap-1.5 rounded-xl bg-theme-surface p-1"
                  role="group"
                  aria-label="音源の選択"
                >
                  {(
                    [
                      { id: "pad" as const, label: "アンビエント", icon: SparklesIcon },
                      { id: "bgm" as const, label: "音楽", icon: MusicalNoteIcon },
                      { id: "off" as const, label: "なし", icon: SpeakerXMarkIcon },
                    ]
                  ).map((opt) => {
                    const active = opt.id === soundSource;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSoundSource(opt.id)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-teal-500 text-white shadow-sm"
                            : "text-theme-tertiary hover:text-theme-secondary"
                        }`}
                        aria-pressed={active}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <SpeakerWaveIcon className="h-5 w-5 text-theme-tertiary" aria-hidden="true" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    disabled={soundSource === "off"}
                    className="h-1.5 w-full cursor-pointer accent-teal-500 disabled:opacity-40"
                    aria-label="音量"
                  />
                </div>
              </fieldset>

              {/* 履歴 */}
              <div className="rounded-2xl border border-theme-light bg-theme-card p-4 text-sm text-theme-secondary">
                これまでに{" "}
                <span className="font-semibold text-theme-accent tabular-nums">
                  {sessionCount}
                </span>{" "}
                回の呼吸セッションを記録しています。
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
