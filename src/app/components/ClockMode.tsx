"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { useWebHaptics } from "web-haptics/react";

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

const ResetIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SkipIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const SoundIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4-4m4 4l4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H5a1 1 0 00-1 1v4a1 1 0 001 1h4l5 5V4L9 9z" />
  </svg>
);

const VibrateIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="7" y="4" width="10" height="16" rx="2" />
    <path strokeLinecap="round" d="M4 8v8M20 8v8" />
  </svg>
);

const FlashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const NoiseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ── Constants ──────────────────────────────────────────────────────────────

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── Types ──────────────────────────────────────────────────────────────────

type ClockDisplay = "clock" | "stopwatch" | "pomodoro";
type PomSession = "work" | "break";
type VibratePattern = "success" | "nudge" | "error" | "buzz" | "bee";

const VIBRATE_PATTERNS: { key: VibratePattern; label: string; desc: string }[] = [
  { key: "success", label: "やさしい",  desc: "軽い2連タップ" },
  { key: "nudge",   label: "標準",      desc: "しっかりタップ" },
  { key: "error",   label: "強め",      desc: "3連の鋭い振動" },
  { key: "buzz",    label: "ブーッ",    desc: "1秒の長い振動" },
  { key: "bee",     label: "Bee",       desc: "ブブブブッと連続" },
];

type PomTask = {
  id: string;
  title: string;
  deadline: string; // "HH:MM"
  done: boolean;
};

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
  // ── Haptic feedback (iOS Safari + Android) ──
  const { trigger: triggerHaptic } = useWebHaptics();

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

  // ── Pomodoro settings (user-configurable) ──
  const [pomWorkMin, setPomWorkMin] = useState(25);
  const [pomBreakMin, setPomBreakMin] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  // ── Pomodoro state ──
  const [pomSession, setPomSession] = useState<PomSession>("work");
  const [pomTimeLeft, setPomTimeLeft] = useState(25 * 60);
  const [pomRunning, setPomRunning] = useState(false);
  const [pomCount, setPomCount] = useState(0);   // completed work sessions
  const [pomFocus, setPomFocus] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pomFocus") ?? "";
  });
  const [pomTasks, setPomTasks] = useState<PomTask[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("pomTasks") ?? "[]"); } catch { return []; }
  });
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);

  // Brown noise
  const [brownOn, setBrownOn] = useState(false);
  const [noiseVol, setNoiseVol] = useState(0.35);

  // Notification toggles
  const [nSound, setNSound] = useState(true);
  const [nVibrate, setNVibrate] = useState(true);
  const [vibratePattern, setVibratePattern] = useState<VibratePattern>("nudge");
  const [nFlash, setNFlash] = useState(true);
  const [nBrowser, setNBrowser] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>("default");

  // ── Refs for stable closures ──
  const pomEndTimeRef = useRef<number | null>(null); // epoch ms when timer should end
  const audioCtxRef = useRef<AudioContext | null>(null);
  const brownSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const pomSessionRef = useRef<PomSession>("work");
  const pomWorkMinRef = useRef(pomWorkMin);
  const pomBreakMinRef = useRef(pomBreakMin);
  const nSoundRef = useRef(nSound);
  const nVibrateRef = useRef(nVibrate);
  const vibratePatternRef = useRef(vibratePattern);
  const nFlashRef = useRef(nFlash);
  const nBrowserRef = useRef(nBrowser);
  pomSessionRef.current = pomSession;
  pomWorkMinRef.current = pomWorkMin;
  pomBreakMinRef.current = pomBreakMin;
  nSoundRef.current = nSound;
  nVibrateRef.current = nVibrate;
  vibratePatternRef.current = vibratePattern;
  nFlashRef.current = nFlash;
  nBrowserRef.current = nBrowser;

  // ── Notification helpers (declared early for use in effects) ──────────

  const pomNotifText = useCallback((session: PomSession) => ({
    title: session === "work" ? "作業時間終了" : "休憩終了",
    body: session === "work" ? "休憩を取りましょう" : "次のセッションを始めましょう",
  }), []);

  const scheduleSwNotif = useCallback((endTime: number, session: PomSession) => {
    const { title, body } = pomNotifText(session);
    navigator.serviceWorker?.controller?.postMessage({
      type: "SCHEDULE_NOTIFICATION", endTime, title, body,
    });
  }, [pomNotifText]);

  const cancelSwNotif = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "CANCEL_NOTIFICATION" });
  }, []);

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

  // Pomodoro tick – record target end time for background recovery
  useEffect(() => {
    if (!pomRunning) {
      pomEndTimeRef.current = null;
      cancelSwNotif();
      return;
    }
    const endTime = Date.now() + pomTimeLeft * 1000;
    pomEndTimeRef.current = endTime;
    // Schedule SW notification for background delivery
    if (nBrowserRef.current) scheduleSwNotif(endTime, pomSessionRef.current);
    const id = setInterval(() => {
      setPomTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  // pomTimeLeft is intentionally excluded – only re-run on pomRunning change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomRunning, scheduleSwNotif, cancelSwNotif]);

  // Background recovery: iOS Safari suspends setInterval in background.
  // On foreground return, recalculate remaining time from the stored end time.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!pomEndTimeRef.current || !pomRunning) return;
      const remaining = Math.max(0, Math.round((pomEndTimeRef.current - Date.now()) / 1000));
      setPomTimeLeft(remaining);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pomRunning]);

  // Pomodoro completion
  useEffect(() => {
    if (pomTimeLeft !== 0 || !pomRunning) return;
    const session = pomSessionRef.current;
    const workMin = pomWorkMinRef.current;
    const breakMin = pomBreakMinRef.current;
    setPomRunning(false);
    // Cancel any pending SW scheduled notification to prevent duplicates,
    // then fire notification directly from the main thread.
    cancelSwNotif();
    if (nSoundRef.current) playChime();
    if (nVibrateRef.current) fireHaptic(vibratePatternRef.current);
    if (nFlashRef.current) setIsFlashing(true);
    if (nBrowserRef.current) fireBrowserNotif(session);
    if (session === "work") {
      setPomCount((c) => c + 1);
      setPomSession("break");
      setPomTimeLeft(breakMin * 60);
    } else {
      setPomSession("work");
      setPomTimeLeft(workMin * 60);
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
  const notifSupported = useMemo(() => typeof window !== "undefined" && "Notification" in window, []);
  useEffect(() => {
    if (notifSupported) setNotifPerm(Notification.permission);
  }, [notifSupported]);

  // Persist tasks & focus to localStorage
  useEffect(() => {
    localStorage.setItem("pomTasks", JSON.stringify(pomTasks));
  }, [pomTasks]);
  useEffect(() => {
    localStorage.setItem("pomFocus", pomFocus);
  }, [pomFocus]);

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

  // Send notification via Service Worker (works in iOS PWA) with fallback
  const fireBrowserNotif = useCallback((session: PomSession) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const { title, body } = pomNotifText(session);
    // Prefer SW showNotification (required for iOS PWA)
    navigator.serviceWorker?.ready.then((reg) => {
      reg.showNotification(title, { body, icon: "/apple-icon", badge: "/icon", tag: "pomodoro" } as NotificationOptions);
    }).catch(() => {
      new Notification(title, { body, silent: true });
    });
  }, [pomNotifText]);

  const requestNotifPerm = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") setNBrowser(true);
  }, []);

  // ── Haptic helper ─────────────────────────────────────────────────────────

  const fireHaptic = useCallback((pattern: VibratePattern) => {
    if (pattern === "bee") {
      // Rapid repeated buzzes: ブブブブッ
      triggerHaptic([80, 40, 80, 40, 80, 40, 80, 40, 200]);
    } else {
      triggerHaptic(pattern);
    }
  }, [triggerHaptic]);

  // ── Debug handlers ────────────────────────────────────────────────────────

  const debugSound = useCallback(() => playChime(), [playChime]);
  const debugVibrate = useCallback(() => {
    fireHaptic(vibratePattern);
  }, [fireHaptic, vibratePattern]);
  const debugFlash = useCallback(() => setIsFlashing(true), []);
  const debugNotif = useCallback(() => fireBrowserNotif("work"), [fireBrowserNotif]);

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
      setPomTimeLeft(pomSession === "work" ? pomWorkMin * 60 : pomBreakMin * 60);
      return;
    }
    setPomRunning((r) => !r);
  }, [pomTimeLeft, pomSession, pomWorkMin, pomBreakMin]);

  const handlePomReset = useCallback(() => {
    setPomRunning(false);
    setPomSession("work");
    setPomTimeLeft(pomWorkMin * 60);
    setPomCount(0);
  }, [pomWorkMin]);

  const handlePomSkip = useCallback(() => {
    setPomRunning(false);
    if (pomSession === "work") {
      setPomCount((c) => c + 1);
      setPomSession("break");
      setPomTimeLeft(pomBreakMin * 60);
    } else {
      setPomSession("work");
      setPomTimeLeft(pomWorkMin * 60);
    }
  }, [pomSession, pomWorkMin, pomBreakMin]);

  const handleSetWorkMin = useCallback((min: number) => {
    setPomWorkMin(min);
    if (!pomRunning && pomSession === "work") setPomTimeLeft(min * 60);
  }, [pomRunning, pomSession]);

  const handleSetBreakMin = useCallback((min: number) => {
    setPomBreakMin(min);
    if (!pomRunning && pomSession === "break") setPomTimeLeft(min * 60);
  }, [pomRunning, pomSession]);

  // ── Task handlers ─────────────────────────────────────────────────────────

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    setPomTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newTaskTitle.trim(), deadline: newTaskDeadline, done: false },
    ]);
    setNewTaskTitle("");
    setNewTaskDeadline("");
  }, [newTaskTitle, newTaskDeadline]);

  const handleToggleTask = useCallback((id: string) => {
    setPomTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    setPomTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

  // ── Task helpers ──────────────────────────────────────────────────────────

  const activeTasks = useMemo(() => pomTasks.filter((t) => !t.done), [pomTasks]);
  const activeTaskCount = activeTasks.length;
  const activeTask = activeTasks[0] ?? null;
  const nextTask = activeTasks[1] ?? null;

  const getDeadlineInfo = useCallback((deadline: string) => {
    if (!deadline) return null;
    const [hh, mm] = deadline.split(":").map(Number);
    let deadlineDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), hh, mm);
    // 日付境界対応: 締切時刻が現在時刻より前で6時間以上前の場合、翌日と判定
    const diffMs = deadlineDate.getTime() - currentTime.getTime();
    if (diffMs < -6 * 60 * 60 * 1000) {
      deadlineDate = new Date(deadlineDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const adjustedDiffMs = deadlineDate.getTime() - currentTime.getTime();
    if (adjustedDiffMs < 0) return { overdue: true, urgent: true, warning: false, label: "期限超過" };
    const diffMin = Math.floor(adjustedDiffMs / 60000);
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return {
      overdue: false,
      urgent: diffMin < 30,
      warning: diffMin < 60,
      label: h > 0 ? `あと${h}時間${m > 0 ? `${m}分` : ""}` : `あと${m}分`,
    };
  }, [currentTime]);

  const activeTaskDeadlineInfo = activeTask?.deadline ? getDeadlineInfo(activeTask.deadline) : null;

  // ── Progress ring ─────────────────────────────────────────────────────────
  const totalSec = pomSession === "work" ? pomWorkMin * 60 : pomBreakMin * 60;
  const pomProgress = pomTimeLeft / totalSec;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - pomProgress);
  const isWork = pomSession === "work";

  // ── Shared tab button style ───────────────────────────────────────────────
  const tabBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? "bg-teal-500 text-white shadow-md"
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
          <button onClick={() => setDisplay("pomodoro")} className={tabBtn(display === "pomodoro")}>
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
                { label: "24時間表示", val: show24h,      set: setShow24h },
                { label: "秒を表示",   val: showSeconds,  set: setShowSeconds },
                { label: "日付を表示", val: showDate,     set: setShowDate },
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
                <button onClick={handleSwStop} className="px-8 py-3 rounded-xl bg-zinc-600 dark:bg-zinc-500 text-white font-bold text-lg hover:bg-zinc-700 dark:hover:bg-zinc-400 transition-colors shadow-lg">
                  ストップ
                </button>
              )}
              {swRunning && (
                <button onClick={handleSwLap} className="px-6 py-3 rounded-xl border-2 border-theme-border text-theme-secondary font-bold text-lg hover:bg-theme-card transition-colors">ラップ</button>
              )}
              {!swRunning && swElapsed > 0 && (
                <button onClick={handleSwReset} className="px-6 py-3 rounded-xl border-2 border-theme-border text-theme-secondary font-bold text-lg hover:bg-theme-card transition-colors">リセット</button>
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
                    i < pomCount % 4 ? "bg-teal-500 scale-110" : "bg-theme-border"
                  }`}
                />
              ))}
              <span className="ml-2 text-sm text-theme-tertiary tabular-nums">
                {pomCount} セッション完了
              </span>
            </div>

            {/* Focus / active task display */}
            {activeTask ? (
              <div className="w-full space-y-1">
                {/* Current task */}
                <div className="w-full rounded-lg border border-teal-400/70 bg-teal-50/60 dark:bg-teal-900/20 px-3 py-2 flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 shrink-0">NOW</span>
                  <span className="flex-1 text-sm font-medium text-theme-primary truncate">{activeTask.title}</span>
                  {activeTask.deadline && activeTaskDeadlineInfo && (
                    <span className={`text-xs font-mono shrink-0 ${
                      activeTaskDeadlineInfo.overdue ? "text-red-600 dark:text-red-400" :
                      activeTaskDeadlineInfo.urgent  ? "text-red-500 dark:text-red-400" :
                      activeTaskDeadlineInfo.warning ? "text-yellow-600 dark:text-yellow-400" :
                      "text-theme-tertiary"
                    }`}>
                      {activeTask.deadline} · {activeTaskDeadlineInfo.label}
                    </span>
                  )}
                </div>
                {/* Next task */}
                {nextTask && (
                  <div className="w-full rounded-lg border border-theme-border/50 px-3 py-1.5 flex items-center gap-2 opacity-60 min-w-0">
                    <span className="text-[10px] font-bold text-theme-tertiary shrink-0">NEXT</span>
                    <span className="flex-1 text-xs text-theme-secondary truncate">{nextTask.title}</span>
                    {nextTask.deadline && (
                      <span className="text-xs font-mono text-theme-tertiary shrink-0">{nextTask.deadline}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={pomFocus}
                onChange={(e) => setPomFocus(e.target.value)}
                placeholder="今セッションのテーマを入力…"
                maxLength={60}
                className="w-full rounded-lg border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
              />
            )}

            {/* Progress ring + timer */}
            <div className="relative flex items-center justify-center">
              <svg width="224" height="224" viewBox="0 0 224 224" className="-rotate-90">
                {/* Track */}
                <circle
                  cx="112" cy="112" r={RING_RADIUS}
                  fill="none" stroke="currentColor"
                  className="text-theme-border" strokeWidth="10"
                />
                {/* Progress: teal for work, slate for break */}
                <circle
                  cx="112" cy="112" r={RING_RADIUS}
                  fill="none"
                  stroke={isWork ? "#14b8a6" : "#64748b"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: pomRunning ? "stroke-dashoffset 1s linear" : "none" }}
                />
              </svg>
              {/* Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <div className="text-5xl font-bold font-mono tabular-nums text-theme-primary">
                  {fmtPom(pomTimeLeft)}
                </div>
                <div className="text-base font-semibold text-theme-secondary">
                  {isWork ? "作業中" : "休憩中"}
                </div>
                <div className="text-xs text-theme-tertiary">
                  {isWork ? `${pomWorkMin}分集中` : `${pomBreakMin}分休憩`}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePomToggle}
                className="px-8 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-lg shadow-lg transition-all active:scale-95"
              >
                {pomRunning ? "一時停止" : pomTimeLeft === 0 ? "次へ" : "スタート"}
              </button>
              <button
                onClick={handlePomReset}
                title="全リセット"
                aria-label="全リセット"
                className="w-12 h-12 rounded-xl border border-theme-border text-theme-secondary hover:bg-theme-card transition-colors flex items-center justify-center"
              >
                <ResetIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handlePomSkip}
                title="このセッションをスキップ"
                aria-label="このセッションをスキップ"
                className="w-12 h-12 rounded-xl border border-theme-border text-theme-secondary hover:bg-theme-card transition-colors flex items-center justify-center"
              >
                <SkipIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowTaskPanel((v) => !v)}
                title="タスク管理"
                aria-label="タスク管理"
                aria-expanded={showTaskPanel}
                className={`relative w-12 h-12 rounded-xl border transition-colors flex items-center justify-center ${
                  showTaskPanel
                    ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                    : "border-theme-border text-theme-secondary hover:bg-theme-card"
                }`}
              >
                <ListIcon className="w-5 h-5" />
                {activeTaskCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-teal-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">
                    {activeTaskCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowSettings((v) => !v)}
                title="設定"
                aria-label="ポモドーロ設定"
                aria-expanded={showSettings}
                className={`w-12 h-12 rounded-xl border transition-colors flex items-center justify-center ${
                  showSettings
                    ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                    : "border-theme-border text-theme-secondary hover:bg-theme-card"
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Task panel */}
            {showTaskPanel && (
              <div className="w-full rounded-xl border border-theme-border bg-theme-card p-4 space-y-3">

                {/* Add task form */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">タスク追加</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      placeholder="タスク名"
                      maxLength={40}
                      className="flex-1 min-w-0 rounded-lg border border-theme-border bg-theme-bg px-2.5 py-1.5 text-sm text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <input
                      type="time"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="w-[5.5rem] shrink-0 rounded-lg border border-theme-border bg-theme-bg px-2 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>

                {/* Task list */}
                {pomTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">タスク一覧</div>
                    {pomTasks.map((task) => {
                      const isActive = !task.done && activeTask?.id === task.id;
                      const isNext   = !task.done && nextTask?.id  === task.id;
                      const info = task.deadline && !task.done ? getDeadlineInfo(task.deadline) : null;
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            task.done  ? "border-theme-border/40 opacity-50" :
                            isActive   ? "border-teal-400 bg-teal-50/50 dark:bg-teal-900/20" :
                            "border-theme-border"
                          }`}
                        >
                          {/* Toggle complete button */}
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              task.done
                                ? "border-teal-500 bg-teal-500 text-white hover:bg-teal-400"
                                : "border-theme-border hover:border-teal-400"
                            }`}
                            title={task.done ? "未完了に戻す" : "完了にする"}
                          >
                            {task.done && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {/* NOW / NEXT badge */}
                          {isActive && <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 shrink-0">NOW</span>}
                          {isNext   && <span className="text-[10px] font-bold text-theme-tertiary shrink-0">NEXT</span>}

                          {/* Title */}
                          <span className={`flex-1 truncate text-sm ${task.done ? "line-through text-theme-tertiary" : "text-theme-primary"}`}>
                            {task.title}
                          </span>

                          {/* Deadline badge */}
                          {task.deadline && (
                            <span className={`text-[11px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                              task.done ? "text-theme-tertiary" :
                              !info     ? "text-theme-tertiary" :
                              info.overdue ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30" :
                              info.urgent  ? "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20" :
                              info.warning ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" :
                              "text-theme-tertiary"
                            }`}>
                              {task.deadline}
                              {!task.done && info && ` · ${info.label}`}
                            </span>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="shrink-0 w-5 h-5 flex items-center justify-center text-theme-tertiary hover:text-red-500 transition-colors"
                            title="削除"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-xs text-theme-tertiary py-1">タスクを追加してください</p>
                )}

              </div>
            )}

            {/* Settings panel */}
            {showSettings && (
              <div className="w-full rounded-xl border border-theme-border bg-theme-card p-4 space-y-4">

                {/* Duration settings */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">時間設定</div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-theme-secondary shrink-0">作業</span>
                    <div className="flex items-center gap-1">
                      {[15, 20, 25, 30, 45].map((min) => (
                        <button
                          key={min}
                          onClick={() => handleSetWorkMin(min)}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                            pomWorkMin === min
                              ? "bg-teal-500 text-white"
                              : "border border-theme-border text-theme-tertiary hover:bg-theme-bg"
                          }`}
                        >
                          {min}
                        </button>
                      ))}
                      <span className="text-xs text-theme-tertiary ml-0.5">分</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-theme-secondary shrink-0">休憩</span>
                    <div className="flex items-center gap-1">
                      {[3, 5, 10, 15].map((min) => (
                        <button
                          key={min}
                          onClick={() => handleSetBreakMin(min)}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                            pomBreakMin === min
                              ? "bg-teal-500 text-white"
                              : "border border-theme-border text-theme-tertiary hover:bg-theme-bg"
                          }`}
                        >
                          {min}
                        </button>
                      ))}
                      <span className="text-xs text-theme-tertiary ml-0.5">分</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-theme-border" />

                {/* Notification toggles */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">終了通知</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "sound",   label: "音",   Icon: SoundIcon,   val: nSound,   set: setNSound   as (v: boolean) => void },
                      { key: "vibrate", label: "振動",  Icon: VibrateIcon, val: nVibrate, set: setNVibrate as (v: boolean) => void },
                      { key: "flash",   label: "点滅",  Icon: FlashIcon,   val: nFlash,   set: setNFlash   as (v: boolean) => void },
                    ].map(({ key, label, Icon, val, set }) => (
                      <button
                        key={key}
                        onClick={() => set(!val)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          val
                            ? "bg-teal-50 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300"
                            : "border-theme-border text-theme-tertiary hover:bg-theme-bg"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}

                    {/* Browser notification button */}
                    {!notifSupported ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-muted" title="ホーム画面に追加（PWA）すると通知が使えます">
                        <BellIcon className="w-3.5 h-3.5" />
                        通知: PWAで有効
                      </span>
                    ) : notifPerm === "granted" ? (
                      <button
                        onClick={() => setNBrowser((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          nBrowser
                            ? "bg-teal-50 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300"
                            : "border-theme-border text-theme-tertiary hover:bg-theme-bg"
                        }`}
                      >
                        <BellIcon className="w-3.5 h-3.5" />
                        通知
                      </button>
                    ) : notifPerm === "denied" ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-muted">
                        <BellIcon className="w-3.5 h-3.5" />
                        通知ブロック済
                      </span>
                    ) : (
                      <button
                        onClick={requestNotifPerm}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-dashed border-theme-border text-theme-tertiary hover:bg-theme-bg transition-colors"
                      >
                        <BellIcon className="w-3.5 h-3.5" />
                        通知を許可
                      </button>
                    )}
                  </div>

                  {/* Vibration pattern selector */}
                  {nVibrate && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-xs text-theme-tertiary">振動パターン</div>
                      <div className="flex flex-wrap gap-1.5">
                        {VIBRATE_PATTERNS.map(({ key, label, desc }) => (
                          <button
                            key={key}
                            onClick={() => setVibratePattern(key)}
                            title={desc}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              vibratePattern === key
                                ? "bg-teal-500 text-white"
                                : "border border-theme-border text-theme-tertiary hover:bg-theme-bg"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-theme-border" />

                {/* Debug / test panel */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">テスト（通知デバッグ）</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={debugSound}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-secondary hover:bg-theme-bg transition-colors"
                    >
                      <SoundIcon className="w-3.5 h-3.5" />
                      音
                    </button>
                    <button
                      onClick={debugVibrate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-secondary hover:bg-theme-bg transition-colors"
                    >
                      <VibrateIcon className="w-3.5 h-3.5" />
                      振動
                    </button>
                    <button
                      onClick={debugFlash}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-secondary hover:bg-theme-bg transition-colors"
                    >
                      <FlashIcon className="w-3.5 h-3.5" />
                      点滅
                    </button>
                    {notifSupported && notifPerm === "granted" && (
                      <button
                        onClick={debugNotif}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-theme-border text-theme-secondary hover:bg-theme-bg transition-colors"
                      >
                        <BellIcon className="w-3.5 h-3.5" />
                        通知
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            <div className="w-full border-t border-theme-border" />

            {/* Brown Noise */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <NoiseIcon className="w-4 h-4 text-theme-tertiary" />
                  <span className="text-sm font-medium text-theme-primary">Brown Noise</span>
                  <span className="text-xs text-theme-tertiary">集中用環境音</span>
                </div>
                <button
                  onClick={toggleBrownNoise}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 cursor-pointer"
                  role="switch" aria-checked={brownOn} aria-label="Brown Noise"
                >
                  <div className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                    brownOn ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${brownOn ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </button>
              </div>
              {brownOn && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-xs text-theme-tertiary">小</span>
                  <input
                    type="range" min="0" max="1" step="0.05" value={noiseVol}
                    onChange={(e) => setNoiseVol(parseFloat(e.target.value))}
                    className="flex-1 accent-teal-500 h-1.5"
                  />
                  <span className="text-xs text-theme-tertiary">大</span>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </>
  );
}
