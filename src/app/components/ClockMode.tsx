"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarIcon,
} from "@heroicons/react/24/outline";

// Stopwatch icon doesn't exist in heroicons, use a custom one
const TimerIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M12 5V3" />
    <path d="M10 3h4" />
  </svg>
);

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

type ClockDisplay = "clock" | "stopwatch";

export default function ClockMode() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [display, setDisplay] = useState<ClockDisplay>("clock");
  const [showSeconds, setShowSeconds] = useState(true);
  const [show24h, setShow24h] = useState(true);
  const [showDate, setShowDate] = useState(true);

  // Stopwatch state
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0); // ms
  const [swStartTime, setSwStartTime] = useState<number | null>(null);
  const [swLaps, setSwLaps] = useState<number[]>([]);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Stopwatch tick
  useEffect(() => {
    if (!swRunning || swStartTime === null) return;
    const timer = setInterval(() => {
      setSwElapsed(Date.now() - swStartTime);
    }, 10);
    return () => clearInterval(timer);
  }, [swRunning, swStartTime]);

  const handleSwStart = useCallback(() => {
    setSwStartTime(Date.now() - swElapsed);
    setSwRunning(true);
  }, [swElapsed]);

  const handleSwStop = useCallback(() => {
    setSwRunning(false);
  }, []);

  const handleSwReset = useCallback(() => {
    setSwRunning(false);
    setSwElapsed(0);
    setSwStartTime(null);
    setSwLaps([]);
  }, []);

  const handleSwLap = useCallback(() => {
    setSwLaps((prev) => [...prev, swElapsed]);
  }, [swElapsed]);

  const formatStopwatch = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  const formatClockTime = (): string => {
    const h = show24h ? currentTime.getHours() : currentTime.getHours() % 12 || 12;
    const m = String(currentTime.getMinutes()).padStart(2, "0");
    const s = String(currentTime.getSeconds()).padStart(2, "0");
    const hStr = String(h).padStart(2, "0");
    return showSeconds ? `${hStr}:${m}:${s}` : `${hStr}:${m}`;
  };

  const getAmPm = (): string => {
    if (show24h) return "";
    return currentTime.getHours() >= 12 ? "PM" : "AM";
  };

  const formatDate = (): string => {
    const y = currentTime.getFullYear();
    const m = currentTime.getMonth() + 1;
    const d = currentTime.getDate();
    const w = WEEKDAYS_JA[currentTime.getDay()];
    return `${y}年${m}月${d}日（${w}）`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full select-none">
      {/* Display toggle */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => setDisplay("clock")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            display === "clock"
              ? "bg-teal-500 text-white shadow-md"
              : "text-theme-tertiary hover:text-theme-secondary hover:bg-theme-card border border-theme-border"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          時計
        </button>
        <button
          onClick={() => setDisplay("stopwatch")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            display === "stopwatch"
              ? "bg-teal-500 text-white shadow-md"
              : "text-theme-tertiary hover:text-theme-secondary hover:bg-theme-card border border-theme-border"
          }`}
        >
          <TimerIcon className="w-4 h-4" />
          ストップウォッチ
        </button>
      </div>

      {display === "clock" ? (
        <>
          {/* Date */}
          {showDate && (
            <div className="text-xl sm:text-2xl md:text-3xl text-theme-secondary font-medium mb-4 tracking-wide">
              {formatDate()}
            </div>
          )}

          {/* AM/PM indicator */}
          {!show24h && (
            <div className="text-2xl sm:text-3xl md:text-4xl text-teal-500 font-bold mb-2">
              {getAmPm()}
            </div>
          )}

          {/* Main clock */}
          <time
            className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-bold text-theme-primary font-mono tabular-nums leading-none tracking-tight"
            dateTime={currentTime.toISOString()}
            suppressHydrationWarning
          >
            {formatClockTime()}
          </time>

          {/* Clock settings */}
          <div className="flex items-center gap-4 mt-8">
            <label className="flex items-center gap-2 text-sm text-theme-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={show24h}
                onChange={(e) => setShow24h(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-500"
              />
              24時間表示
            </label>
            <label className="flex items-center gap-2 text-sm text-theme-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={showSeconds}
                onChange={(e) => setShowSeconds(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-500"
              />
              秒を表示
            </label>
            <label className="flex items-center gap-2 text-sm text-theme-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={showDate}
                onChange={(e) => setShowDate(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-500"
              />
              日付を表示
            </label>
          </div>
        </>
      ) : (
        <>
          {/* Stopwatch */}
          <div className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-bold text-theme-primary font-mono tabular-nums leading-none tracking-tight">
            {formatStopwatch(swElapsed)}
          </div>

          {/* Stopwatch controls */}
          <div className="flex items-center gap-4 mt-8">
            {!swRunning ? (
              <button
                onClick={handleSwStart}
                className="px-8 py-3 rounded-xl bg-teal-500 text-white font-bold text-lg hover:bg-teal-600 transition-colors shadow-lg"
              >
                {swElapsed > 0 ? "再開" : "スタート"}
              </button>
            ) : (
              <button
                onClick={handleSwStop}
                className="px-8 py-3 rounded-xl bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
              >
                ストップ
              </button>
            )}
            {swRunning && (
              <button
                onClick={handleSwLap}
                className="px-6 py-3 rounded-xl border-2 border-theme-border text-theme-secondary font-bold text-lg hover:bg-theme-card transition-colors"
              >
                ラップ
              </button>
            )}
            {!swRunning && swElapsed > 0 && (
              <button
                onClick={handleSwReset}
                className="px-6 py-3 rounded-xl border-2 border-red-300 text-red-500 font-bold text-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                リセット
              </button>
            )}
          </div>

          {/* Laps */}
          {swLaps.length > 0 && (
            <div className="mt-8 w-full max-w-md">
              <div className="text-sm font-medium text-theme-tertiary mb-2">ラップタイム</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {swLaps.map((lap, i) => {
                  const diff = i === 0 ? lap : lap - swLaps[i - 1];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2 bg-theme-card rounded-lg border border-theme-border text-sm"
                    >
                      <span className="text-theme-tertiary font-medium">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-theme-secondary tabular-nums">
                        +{formatStopwatch(diff)}
                      </span>
                      <span className="font-mono text-theme-primary font-medium tabular-nums">
                        {formatStopwatch(lap)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
