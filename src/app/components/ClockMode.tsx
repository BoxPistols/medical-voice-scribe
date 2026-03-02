"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";

// ── Icons ──────────────────────────────────────────────────────────────────

const TimerIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M12 5V3" />
    <path d="M10 3h4" />
  </svg>
);

const TomatoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="14" r="8" />
    <path d="M12 6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M9.5 5.5 C8.5 4 9 2.5 10.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M14.5 5.5 C15.5 4 15 2.5 13.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

// ── Constants ──────────────────────────────────────────────────────────────

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const WORK_MIN = 25;
const BREAK_MIN = 5;
const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── Types ──────────────────────────────────────────────────────────────────

type ClockDisplay = "clock" | "stopwatch" | "pomodoro";
type PomSession = "work" | "break";

// ── Brown noise generator ──────────────────────────────────────────────────

function makeBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 20; // 20-second loop
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (last + 0.02 * white) / 1.02;
    last = data[i];
    data[i] *= 3.5;
  }
  return buf;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ClockMode() {
  // ── Clock ──
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [display, setDisplay] = useState<ClockDisplay>("clock");
  const [showSeconds, setShowSeconds] = useState(true);
  const [show24h, setShow24h] = useState(true);
  const [showDate, setShowDate] = useState(true);

  // ── Stopwatch ──
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);
  const [swStartTime, setSwStartTime] = useState<number | null>(null);
  const [swLaps, setSwLaps] = useState<number[]>([]);

  // ── Pomodoro ──
  const [pomSession, setPomSession] = useState<PomSession>("work");
  const [pomTimeLeft, setPomTimeLeft] = useState(WORK_MIN * 60);
  const [pomRunning, setPomRunning] = useState(false);
  const [pomCount, setPomCount] = useState(0);   // completed work sessions
  const [isFlashing, setIsFlashing] = useState(false);

  // Brown noise
  const [brownOn, setBrownOn] = useState(false);
  const [noiseVol, setNoiseVol] = useState(0.35);

  // Notification toggles
  const [nSound, setNSound] = useState(true);
  const [nVibrate, setNVibrate] = useState(true);
  const [nFlash, setNFlash] = useState(true);
  const [nBrowser, setNBrowser] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>("default");

  // ── Refs for stable closures ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const brownSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const pomSessionRef = useRef<PomSession>("work");
  const nSoundRef = useRef(nSound);
  const nVibrateRef = useRef(nVibrate);
  const nFlashRef = useRef(nFlash);
  const nBrowserRef = useRef(nBrowser);
  pomSessionRef.current = pomSession;
  nSoundRef.current = nSound;
  nVibrateRef.current = nVibrate;
  nFlashRef.current = nFlash;
  nBrowserRef.current = nBrowser;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Stopwatch tick
  useEffect(() => {
    if (!swRunning || swStartTime === null) return;
    let id: number;
    const tick = () => {
      setSwElapsed(Date.now() - swStartTime);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [swRunning, swStartTime]);

  // Pomodoro tick
  useEffect(() => {
    if (!pomRunning) return;
    const id = setInterval(() => {
      setPomTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [pomRunning]);

  // Pomodoro completion
  useEffect(() => {
    if (pomTimeLeft !== 0 || !pomRunning) return;
    const session = pomSessionRef.current;
    setPomRunning(false);
    if (nSoundRef.current) playChime();
    if (nVibrateRef.current && "vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
    if (nFlashRef.current) setIsFlashing(true);
    if (nBrowserRef.current) fireBrowserNotif(session);
    if (session === "work") {
      setPomCount((c) => c + 1);
      setPomSession("break");
      setPomTimeLeft(BREAK_MIN * 60);
    } else {
      setPomSession("work");
      setPomTimeLeft(WORK_MIN * 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomTimeLeft, pomRunning]);

  // Auto-clear flash after animation
  useEffect(() => {
    if (!isFlashing) return;
    const id = setTimeout(() => setIsFlashing(false), 1400);
    return () => clearTimeout(id);
  }, [isFlashing]);

  // Volume control for live noise
  useEffect(() => {
    if (noiseGainRef.current) noiseGainRef.current.gain.value = noiseVol;
  }, [noiseVol]);

  // Check browser notification permission
  useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      brownSourceRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Audio helpers ─────────────────────────────────────────────────────────

  const getCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const playChime = useCallback(() => {
    try {
      const ctx = getCtx();
      // C5 – E5 – G5 ascending chime
      ([523.25, 659.25, 783.99] as const).forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.28;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.45, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.7);
      });
    } catch {/* AudioContext unavailable */}
  }, [getCtx]);

  const toggleBrownNoise = useCallback(() => {
    if (brownOn) {
      brownSourceRef.current?.stop();
      brownSourceRef.current = null;
      setBrownOn(false);
    } else {
      try {
        const ctx = getCtx();
        const source = ctx.createBufferSource();
        source.buffer = makeBrownNoiseBuffer(ctx);
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = noiseVol;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        brownSourceRef.current = source;
        noiseGainRef.current = gain;
        setBrownOn(true);
      } catch {/* AudioContext unavailable */}
    }
  }, [brownOn, getCtx, noiseVol]);

  const fireBrowserNotif = useCallback((session: PomSession) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(session === "work" ? "🍅 作業時間終了！" : "☕ 休憩終了！", {
        body: session === "work" ? "5分間休憩しましょう" : "次のポモドーロを始めましょう！",
        silent: true,
      });
    }
  }, []);

  const requestNotifPerm = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") setNBrowser(true);
  }, []);

  // ── Stopwatch handlers ────────────────────────────────────────────────────

  const handleSwStart = useCallback(() => {
    setSwStartTime(Date.now() - swElapsed);
    setSwRunning(true);
  }, [swElapsed]);
  const handleSwStop = useCallback(() => setSwRunning(false), []);
  const handleSwReset = useCallback(() => {
    setSwRunning(false); setSwElapsed(0); setSwStartTime(null); setSwLaps([]);
  }, []);
  const handleSwLap = useCallback(() => setSwLaps((p) => [...p, swElapsed]), [swElapsed]);

  // ── Pomodoro handlers ─────────────────────────────────────────────────────

  const handlePomToggle = useCallback(() => {
    if (pomTimeLeft === 0) {
      setPomTimeLeft(pomSession === "work" ? WORK_MIN * 60 : BREAK_MIN * 60);
      return;
    }
    setPomRunning((r) => !r);
  }, [pomTimeLeft, pomSession]);

  const handlePomReset = useCallback(() => {
    setPomRunning(false);
    setPomSession("work");
    setPomTimeLeft(WORK_MIN * 60);
    setPomCount(0);
  }, []);

  const handlePomSkip = useCallback(() => {
    setPomRunning(false);
    if (pomSession === "work") {
      setPomCount((c) => c + 1);
      setPomSession("break");
      setPomTimeLeft(BREAK_MIN * 60);
    } else {
      setPomSession("work");
      setPomTimeLeft(WORK_MIN * 60);
    }
  }, [pomSession]);

  // ── Format helpers ────────────────────────────────────────────────────────

  const fmtSw = (ms: number) => {
    const ts = Math.floor(ms / 1000);
    const h = Math.floor(ts / 3600);
    const m = Math.floor((ts % 3600) / 60);
    const s = ts % 60;
    const cs = Math.floor((ms % 1000) / 10);
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
  };

  const fmtPom = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  const fmtClock = () => {
    const h = show24h ? currentTime.getHours() : currentTime.getHours() % 12 || 12;
    const m = String(currentTime.getMinutes()).padStart(2, "0");
    const s = String(currentTime.getSeconds()).padStart(2, "0");
    return showSeconds ? `${String(h).padStart(2,"0")}:${m}:${s}` : `${String(h).padStart(2,"0")}:${m}`;
  };

  const ampm = () => (show24h ? "" : currentTime.getHours() >= 12 ? "PM" : "AM");
  const fmtDate = () => {
    const d = currentTime;
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WEEKDAYS_JA[d.getDay()]}）`;
  };

  // ── Progress ring ─────────────────────────────────────────────────────────
  const totalSec = pomSession === "work" ? WORK_MIN * 60 : BREAK_MIN * 60;
  const pomProgress = pomTimeLeft / totalSec;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - pomProgress);
  const isWork = pomSession === "work";

  // ── Toggle button shared styles ───────────────────────────────────────────
  const tabBtn = (active: boolean, activeColor = "bg-teal-500") =>
    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? `${activeColor} text-white shadow-md`
        : "text-theme-tertiary hover:text-theme-secondary hover:bg-theme-card border border-theme-border"
    }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Screen flash overlay */}
      {isFlashing && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none animate-pomodoro-flash"
          style={{ background: "white" }}
        />
      )}

      <div className="flex flex-col items-center justify-center h-full select-none pb-20 md:pb-28 px-4">

        {/* Display toggle tabs */}
        <div className="flex items-center gap-2 mb-8 flex-wrap justify-center">
          <button onClick={() => setDisplay("clock")} className={tabBtn(display === "clock")}>
            <CalendarIcon className="w-4 h-4" />時計
          </button>
          <button onClick={() => setDisplay("stopwatch")} className={tabBtn(display === "stopwatch")}>
            <TimerIcon className="w-4 h-4" />ストップウォッチ
          </button>
          <button onClick={() => setDisplay("pomodoro")} className={tabBtn(display === "pomodoro", "bg-red-500")}>
            <TomatoIcon className="w-4 h-4" />ポモドーロ
          </button>
        </div>

        {/* ── Clock ── */}
        {display === "clock" && (
          <>
            {showDate && (
              <div className="text-xl sm:text-2xl md:text-3xl text-theme-secondary font-medium mb-4 tracking-wide">
                {fmtDate()}
              </div>
            )}
            {!show24h && (
              <div className="text-2xl sm:text-3xl md:text-4xl text-teal-500 font-bold mb-2">{ampm()}</div>
            )}
            <time
              className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-bold text-theme-primary font-mono tabular-nums leading-none tracking-tight"
              dateTime={currentTime.toISOString()}
              suppressHydrationWarning
            >
              {fmtClock()}
            </time>
            <div className="flex items-center gap-4 mt-8 flex-wrap justify-center">
              {[
                { label: "24時間表示", val: show24h, set: setShow24h },
                { label: "秒を表示",   val: showSeconds, set: setShowSeconds },
                { label: "日付を表示", val: showDate,    set: setShowDate },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 text-sm text-theme-tertiary cursor-pointer">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="w-4 h-4 rounded accent-teal-500" />
                  {label}
                </label>
              ))}
            </div>
          </>
        )}

        {/* ── Stopwatch ── */}
        {display === "stopwatch" && (
          <>
            <div className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-bold text-theme-primary font-mono tabular-nums leading-none tracking-tight">
              {fmtSw(swElapsed)}
            </div>
            <div className="flex items-center gap-4 mt-8">
              {!swRunning ? (
                <button onClick={handleSwStart} className="px-8 py-3 rounded-xl bg-teal-500 text-white font-bold text-lg hover:bg-teal-600 transition-colors shadow-lg">
                  {swElapsed > 0 ? "再開" : "スタート"}
                </button>
              ) : (
                <button onClick={handleSwStop} className="px-8 py-3 rounded-xl bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg">
                  ストップ
                </button>
              )}
              {swRunning && (
                <button onClick={handleSwLap} className="px-6 py-3 rounded-xl border-2 border-theme-border text-theme-secondary font-bold text-lg hover:bg-theme-card transition-colors">ラップ</button>
              )}
              {!swRunning && swElapsed > 0 && (
                <button onClick={handleSwReset} className="px-6 py-3 rounded-xl border-2 border-red-300 text-red-500 font-bold text-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">リセット</button>
              )}
            </div>
            {swLaps.length > 0 && (
              <div className="mt-8 w-full max-w-md">
                <div className="text-sm font-medium text-theme-tertiary mb-2">ラップタイム</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {swLaps.map((lap, i) => {
                    const diff = i === 0 ? lap : lap - swLaps[i - 1];
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-2 bg-theme-card rounded-lg border border-theme-border text-sm">
                        <span className="text-theme-tertiary font-medium">#{i + 1}</span>
                        <span className="font-mono text-theme-secondary tabular-nums">+{fmtSw(diff)}</span>
                        <span className="font-mono text-theme-primary font-medium tabular-nums">{fmtSw(lap)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Pomodoro ── */}
        {display === "pomodoro" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-5">

            {/* Session dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < pomCount % 4 ? "bg-red-500 scale-110" : "bg-theme-border"
                  }`}
                />
              ))}
              <span className="ml-2 text-sm text-theme-tertiary tabular-nums">
                {pomCount} セッション完了
              </span>
            </div>

            {/* Progress ring + timer */}
            <div className="relative flex items-center justify-center">
              <svg width="224" height="224" viewBox="0 0 224 224" className="-rotate-90">
                {/* Track */}
                <circle
                  cx="112" cy="112" r={RING_RADIUS}
                  fill="none" stroke="currentColor"
                  className="text-theme-border" strokeWidth="10"
                />
                {/* Progress */}
                <circle
                  cx="112" cy="112" r={RING_RADIUS}
                  fill="none"
                  stroke={isWork ? "#ef4444" : "#60a5fa"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: pomRunning ? "stroke-dashoffset 1s linear" : "none" }}
                />
              </svg>
              {/* Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <div className={`text-5xl font-bold font-mono tabular-nums ${isWork ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}>
                  {fmtPom(pomTimeLeft)}
                </div>
                <div className="text-base font-semibold text-theme-secondary">
                  {isWork ? "🍅 作業中" : "☕ 休憩中"}
                </div>
                <div className="text-xs text-theme-tertiary">
                  {isWork ? `${WORK_MIN}分集中` : `${BREAK_MIN}分休憩`}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePomToggle}
                className={`px-8 py-3 rounded-xl text-white font-bold text-lg shadow-lg transition-all active:scale-95 ${
                  isWork ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {pomRunning ? "⏸ 一時停止" : pomTimeLeft === 0 ? "↺ 次へ" : "▶ スタート"}
              </button>
              <button
                onClick={handlePomReset} title="全リセット"
                className="w-12 h-12 rounded-xl border-2 border-theme-border text-theme-secondary hover:bg-theme-card hover:text-red-500 transition-colors flex items-center justify-center text-xl"
              >↺</button>
              <button
                onClick={handlePomSkip} title="このセッションをスキップ"
                className="w-12 h-12 rounded-xl border-2 border-theme-border text-theme-secondary hover:bg-theme-card transition-colors flex items-center justify-center text-xl"
              >⏭</button>
            </div>

            <div className="w-full border-t border-theme-border" />

            {/* Brown Noise */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎵</span>
                  <span className="text-sm font-medium text-theme-primary">Brown Noise</span>
                  <span className="text-xs text-theme-tertiary">集中用環境音</span>
                </div>
                <button
                  onClick={toggleBrownNoise}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    brownOn ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  role="switch" aria-checked={brownOn}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${brownOn ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {brownOn && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-xs text-theme-tertiary">🔈</span>
                  <input
                    type="range" min="0" max="1" step="0.05" value={noiseVol}
                    onChange={(e) => setNoiseVol(parseFloat(e.target.value))}
                    className="flex-1 accent-teal-500 h-1.5"
                  />
                  <span className="text-xs text-theme-tertiary">🔊</span>
                </div>
              )}
            </div>

            <div className="w-full border-t border-theme-border" />

            {/* Notification settings */}
            <div className="w-full space-y-2">
              <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">
                終了通知
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "sound",   label: "🔊 音",   val: nSound,   set: setNSound },
                  { key: "vibrate", label: "📳 振動",  val: nVibrate, set: setNVibrate },
                  { key: "flash",   label: "⚡ 点滅",  val: nFlash,   set: setNFlash },
                ] as const).map(({ key, label, val, set }) => (
                  <button
                    key={key}
                    onClick={() => (set as (v: boolean) => void)(!val)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      val
                        ? "bg-teal-50 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300"
                        : "border-theme-border text-theme-tertiary hover:bg-theme-card"
                    }`}
                  >
                    {label}
                  </button>
                ))}

                {notifPerm === "granted" ? (
                  <button
                    onClick={() => setNBrowser((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      nBrowser
                        ? "bg-teal-50 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300"
                        : "border-theme-border text-theme-tertiary hover:bg-theme-card"
                    }`}
                  >
                    🔔 通知
                  </button>
                ) : notifPerm === "denied" ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-muted">
                    🔕 通知ブロック済
                  </span>
                ) : (
                  <button
                    onClick={requestNotifPerm}
                    className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-theme-border text-theme-tertiary hover:bg-theme-card transition-colors"
                  >
                    🔔 通知を許可
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </>
  );
}
