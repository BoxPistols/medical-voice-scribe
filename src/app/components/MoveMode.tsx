"use client";

// 体を動かす（カメラ姿勢トラッキング）ミニアプリ。
// すべて端末内で処理。カメラ映像は録画・送信せず、停止/アンマウントで確実に解放する。
//
// 設計:
//  - MediaPipe 依存・数学は src/lib/wellness/pose.ts に isolate（このファイルは UI とライフサイクルに専念）。
//  - カメラ/ループ/ランドマーカーの解放を最重視。useEffect クリーンアップ＋停止ボタン＋アンマウントで二重に保証。
//  - 動かない環境（権限拒否/非対応/読込失敗）でもアプリ全体を壊さず、日本語でやさしくフォールバック表示。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  StopIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useWebHaptics } from "web-haptics/react";
import {
  loadPoseLandmarker,
  assessPosture,
  armRaiseSignal,
  sideBendSignal,
  getWristPoints,
  isHit,
  isVisible,
  initRepState,
  stepRep,
  UPPER_BODY_CONNECTIONS,
  POSE_LANDMARK,
  type PoseDetector,
  type PoseLandmark,
  type RepState,
  type HandPoint,
  type PostureAssessment,
} from "@/lib/wellness/pose";
import { addMoveSession, newId } from "@/lib/wellness/storage";

// ── 定数 ─────────────────────────────────────────────────────────────

/** アクティビティ識別子（MoveSession.activity と一致させる）。 */
type Activity = "posture" | "stretch-arms" | "stretch-side" | "reach";

interface ActivityMeta {
  id: Activity;
  label: string;
  short: string;
  desc: string;
}

const ACTIVITIES: readonly ActivityMeta[] = [
  { id: "posture", label: "姿勢チェック", short: "姿勢", desc: "肩のラインと頭の位置から姿勢をリアルタイム採点します。" },
  { id: "stretch-arms", label: "両腕の上げ下ろし", short: "腕上げ", desc: "両腕を上げて下ろす動きを検出してカウントします。" },
  { id: "stretch-side", label: "体側ストレッチ", short: "体側", desc: "左右に体を倒す動きを検出してカウントします。" },
  { id: "reach", label: "リーチ・ミニゲーム", short: "ゲーム", desc: "現れるターゲットに手で触れて消すミニゲームです。" },
];

/** ストレッチ目標レップ数（達成演出のトリガ）。 */
const STRETCH_GOAL = 8;
/** ミニゲームの制限時間（秒）。 */
const GAME_DURATION_SEC = 30;
/** ミニゲームのターゲット半径（正規化座標）。 */
const TARGET_RADIUS = 0.09;

/** 腕上げレップのしきい値（armRaiseSignal の value 基準: 手首が肩より十分上で up）。 */
const ARM_LOW = -0.1;
const ARM_HIGH = 0.6;
/** 体側ストレッチのしきい値（sideBendSignal の角度基準: 鉛直からの傾き度）。 */
const SIDE_LOW = 8;
const SIDE_HIGH = 22;

/** ステータス種別。 */
type Status = "idle" | "loading" | "running" | "denied" | "unsupported" | "model-error";

// ── ゲームのターゲット型 ──────────────────────────────────────────────

interface GameTarget {
  id: string;
  x: number; // 0..1（ランドマークと同じ正規化空間。描画時にミラー反転）
  y: number;
}

// ── コンポーネント ────────────────────────────────────────────────────

export default function MoveMode() {
  const { trigger: triggerHaptic } = useWebHaptics();

  // UI / ライフサイクル状態
  const [status, setStatus] = useState<Status>("idle");
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null);
  const [activity, setActivity] = useState<Activity>("posture");
  const [fps, setFps] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // 姿勢チェック HUD
  const [posture, setPosture] = useState<PostureAssessment | null>(null);

  // レップ HUD
  const [reps, setReps] = useState(0);
  const [achieved, setAchieved] = useState(false);

  // ミニゲーム HUD
  const [gameScore, setGameScore] = useState(0);
  const [gameTimeLeft, setGameTimeLeft] = useState(GAME_DURATION_SEC);

  // DOM 参照
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ループ内で使う可変参照（再レンダー非依存）
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const activityRef = useRef<Activity>(activity);
  const repStateRef = useRef<RepState>(initRepState());
  const targetRef = useRef<GameTarget | null>(null);
  const sessionStartRef = useRef<number>(0); // 0:停止, -1:起動中, >0:走行中
  const gameEndRef = useRef<number>(0);
  const fpsRef = useRef<{ last: number; frames: number; acc: number }>({ last: 0, frames: 0, acc: 0 });
  // detectForVideo に渡すタイムスタンプの単調増加保証（同一フレーム/カメラ復帰時の例外を防ぐ）
  const tsRef = useRef(0);
  // ゲーム残り秒の最新値（毎フレーム setState による不要な再レンダーを防ぐ）
  const gameTimeLeftRef = useRef(GAME_DURATION_SEC);
  const achievedRef = useRef(false);
  // 達成演出のタイマー（クリーンアップ対象）
  const achieveTimerRef = useRef<number | null>(null);
  // セッション記録の重複防止
  const recordedRef = useRef(false);

  // prefers-reduced-motion を尊重
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // activity の最新値をループ用 ref に同期
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  // ── 完全クリーンアップ（カメラ・ループ・ランドマーカー・タイマー解放） ──
  const teardown = useCallback(() => {
    runningRef.current = false;
    sessionStartRef.current = 0;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (achieveTimerRef.current !== null) {
      window.clearTimeout(achieveTimerRef.current);
      achieveTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // 既に停止済みなら無視
      }
      video.srcObject = null;
    }
    if (detectorRef.current) {
      try {
        detectorRef.current.close();
      } catch {
        // 解放済み / 失敗は無視（ベストエフォートで確実に手放す）
      }
      detectorRef.current = null;
    }
  }, []);

  // アンマウント時に必ず解放（カメラ点きっぱなし厳禁）
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  // ── セッション記録 ──
  const recordSession = useCallback(() => {
    if (recordedRef.current) return;
    if (sessionStartRef.current === 0) return;
    const durationSec = Math.max(0, Math.round((performance.now() - sessionStartRef.current) / 1000));
    if (durationSec < 2) return; // ごく短いセッションは記録しない
    recordedRef.current = true;
    const act = activityRef.current;
    addMoveSession({
      id: newId(),
      timestamp: Date.now(),
      activity: act,
      reps: act === "stretch-arms" || act === "stretch-side" ? repStateRef.current.count : undefined,
      durationSec,
    });
  }, []);

  // ── 描画ヘルパー ──
  const drawSkeleton = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, landmarks: PoseLandmark[]) => {
      // ミラー（鏡像）座標へ: 表示は左右反転している前提なので x を 1-x にして描く。
      const px = (lm: PoseLandmark) => (1 - lm.x) * w;
      const py = (lm: PoseLandmark) => lm.y * h;

      // 接続線
      ctx.lineWidth = Math.max(2, w * 0.005);
      ctx.strokeStyle = "rgba(20, 184, 166, 0.85)"; // teal-500
      ctx.lineCap = "round";
      for (const c of UPPER_BODY_CONNECTIONS) {
        const a = landmarks[c.start];
        const b = landmarks[c.end];
        if (!isVisible(a) || !isVisible(b)) continue;
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
      }

      // 関節点
      const r = Math.max(3, w * 0.008);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      const joints = [
        POSE_LANDMARK.NOSE,
        POSE_LANDMARK.LEFT_SHOULDER,
        POSE_LANDMARK.RIGHT_SHOULDER,
        POSE_LANDMARK.LEFT_ELBOW,
        POSE_LANDMARK.RIGHT_ELBOW,
        POSE_LANDMARK.LEFT_WRIST,
        POSE_LANDMARK.RIGHT_WRIST,
        POSE_LANDMARK.LEFT_HIP,
        POSE_LANDMARK.RIGHT_HIP,
      ];
      for (const idx of joints) {
        const lm = landmarks[idx];
        if (!isVisible(lm)) continue;
        ctx.beginPath();
        ctx.arc(px(lm), py(lm), r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const drawTarget = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, target: GameTarget) => {
      const cx = (1 - target.x) * w;
      const cy = target.y * h;
      const rad = TARGET_RADIUS * w;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20, 184, 166, 0.30)";
      ctx.fill();
      ctx.lineWidth = Math.max(3, w * 0.006);
      ctx.strokeStyle = "rgba(20, 184, 166, 0.95)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
    },
    [],
  );

  /** 新しいターゲットを安全な範囲に配置（端に寄りすぎないよう余白をとる）。 */
  const spawnTarget = useCallback((): GameTarget => {
    const margin = TARGET_RADIUS + 0.05;
    return {
      id: newId(),
      x: margin + Math.random() * (1 - margin * 2),
      y: margin + Math.random() * (1 - margin * 2),
    };
  }, []);

  // ── レップ達成演出 ──
  const fireAchievement = useCallback(() => {
    if (achievedRef.current) return;
    achievedRef.current = true;
    setAchieved(true);
    if (!reducedMotion) {
      // 触覚（任意・対応端末のみ）。失敗は無視される設計。
      triggerHaptic([60, 40, 60, 40, 160]);
    }
    achieveTimerRef.current = window.setTimeout(() => {
      setAchieved(false);
      achieveTimerRef.current = null;
    }, 2600);
  }, [reducedMotion, triggerHaptic]);

  // 次フレームのスケジューラ（loop の自己参照を避けるため ref 経由で呼ぶ）。
  // ref はレンダー中に最新の loop を代入する（下記）。
  const loopRef = useRef<() => void>(() => {});
  const schedule = useCallback(() => {
    rafRef.current = requestAnimationFrame(() => loopRef.current());
  }, []);

  // ── メインループ ──
  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector || video.readyState < 2) {
      schedule();
      return;
    }

    // キャンバス解像度を映像に追従
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      schedule();
      return;
    }

    const now = performance.now();
    // detect には単調増加を保証した ts を渡す（now が逆行/同値でも +1 で前進させる）
    const ts = Math.max(now, tsRef.current + 1);
    tsRef.current = ts;

    // 推論（失敗してもループは止めない）
    let landmarks: PoseLandmark[] | null = null;
    try {
      landmarks = detector.detect(video, ts);
    } catch {
      landmarks = null;
    }

    // ミラー描画: 映像を左右反転して描く
    ctx.save();
    ctx.clearRect(0, 0, vw, vh);
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();

    if (landmarks) {
      drawSkeleton(ctx, vw, vh, landmarks);
    }

    const act = activityRef.current;

    // アクティビティごとの処理
    if (act === "posture") {
      if (landmarks) {
        const a = assessPosture(landmarks);
        setPosture(a);
      }
    } else if (act === "stretch-arms" || act === "stretch-side") {
      if (landmarks) {
        const signal = act === "stretch-arms" ? armRaiseSignal(landmarks) : sideBendSignal(landmarks);
        const low = act === "stretch-arms" ? ARM_LOW : SIDE_LOW;
        const high = act === "stretch-arms" ? ARM_HIGH : SIDE_HIGH;
        const prev = repStateRef.current.count;
        repStateRef.current = stepRep(repStateRef.current, signal, low, high);
        const next = repStateRef.current.count;
        if (next !== prev) {
          setReps(next);
          if (!reducedMotion) triggerHaptic(35);
          if (next >= STRETCH_GOAL) fireAchievement();
        }
      }
    } else if (act === "reach") {
      // ターゲット未配置なら生成
      if (!targetRef.current) targetRef.current = spawnTarget();
      const target = targetRef.current;
      if (target) {
        // 当たり判定（手首）
        if (landmarks) {
          const wrists: HandPoint[] = getWristPoints(landmarks);
          const hit = wrists.some((wp) => isHit(wp, { x: target.x, y: target.y }, TARGET_RADIUS));
          if (hit) {
            setGameScore((s) => s + 1);
            if (!reducedMotion) triggerHaptic(30);
            targetRef.current = spawnTarget();
          }
        }
        const current = targetRef.current;
        if (current) drawTarget(ctx, vw, vh, current);
      }
      // 残り時間（秒が変わった時だけ setState して不要な再レンダーを抑制）
      const remain = Math.max(0, Math.ceil((gameEndRef.current - now) / 1000));
      if (remain !== gameTimeLeftRef.current) {
        gameTimeLeftRef.current = remain;
        setGameTimeLeft(remain);
      }
      if (now >= gameEndRef.current) {
        // ゲーム終了 → 記録してその場で停止（teardown が rAF も止める）
        recordSession();
        teardown();
        setStatus("idle");
        setFps(0);
        return;
      }
    }

    // FPS 計測（約1秒ごとに更新）
    const f = fpsRef.current;
    if (f.last !== 0) {
      f.acc += now - f.last;
      f.frames += 1;
      if (f.acc >= 1000) {
        setFps(Math.round((f.frames * 1000) / f.acc));
        f.acc = 0;
        f.frames = 0;
      }
    }
    f.last = now;

    schedule();
  }, [schedule, drawSkeleton, drawTarget, spawnTarget, reducedMotion, triggerHaptic, fireAchievement, recordSession, teardown]);

  // 最新の loop を ref へ反映（自己参照を避けつつ常に最新クロージャを使う）。
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // ── 停止 ──
  const stopCamera = useCallback(() => {
    // 走行中セッションを記録（ゲーム以外。ゲームは終了時に記録済み）
    if (status === "running" && activityRef.current !== "reach") {
      recordSession();
    }
    teardown();
    setStatus("idle");
    setFps(0);
  }, [status, teardown, recordSession]);

  // ── 開始（ユーザー操作で getUserMedia → モデル読込 → ループ） ──
  const startCamera = useCallback(async () => {
    // 非対応ブラウザ判定
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setStatus("unsupported");
      return;
    }

    sessionStartRef.current = -1; // 起動中フラグ

    setStatus("loading");
    // 状態リセット
    repStateRef.current = initRepState();
    achievedRef.current = false;
    recordedRef.current = false;
    targetRef.current = null;
    fpsRef.current = { last: 0, frames: 0, acc: 0 };
    tsRef.current = 0; // 再起動時のタイムスタンプ逆行を防ぐ
    setReps(0);
    setAchieved(false);
    setPosture(null);
    setGameScore(0);
    gameTimeLeftRef.current = GAME_DURATION_SEC;
    setGameTimeLeft(GAME_DURATION_SEC);

    // 1) カメラ取得
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      // 権限拒否 / デバイス無し
      if (sessionStartRef.current === -1) {
        setStatus("denied");
      }
      return;
    }

    // 中断チェック（await の間に teardown が呼ばれたか）
    if (sessionStartRef.current !== -1) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      // 想定外: 解放して中断
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus("idle");
      return;
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch {
      // 自動再生制限。srcObject はセット済みなので続行を試みる。
    }

    // 再度中断チェック（play() の await 後）
    if (sessionStartRef.current !== -1) {
      teardown();
      return;
    }

    // 2) モデル読込（GPU→CPU フォールバックは pose.ts 内）
    let detector: PoseDetector;
    try {
      detector = await loadPoseLandmarker();
    } catch {
      // 読込失敗 → 中断されていなければカメラを解放してフォールバック表示
      if (sessionStartRef.current === -1) {
        teardown();
        setStatus("model-error");
      }
      return;
    }

    // 最終中断チェック
    if (sessionStartRef.current !== -1) {
      try {
        detector.close();
      } catch {
        // 無視
      }
      teardown();
      return;
    }

    detectorRef.current = detector;
    setDelegate(detector.delegate);

    // 3) ループ開始
    sessionStartRef.current = performance.now();
    gameEndRef.current = performance.now() + GAME_DURATION_SEC * 1000;
    runningRef.current = true;
    setStatus("running");
    schedule();
  }, [schedule, teardown]);

  // ── アクティビティ切替時のリセット（走行中も即反映） ──
  const handleActivityChange = useCallback(
    (next: Activity) => {
      setActivity(next);
      activityRef.current = next;
      repStateRef.current = initRepState();
      achievedRef.current = false;
      targetRef.current = null;
      setReps(0);
      setAchieved(false);
      setGameScore(0);
      gameTimeLeftRef.current = GAME_DURATION_SEC;
      setGameTimeLeft(GAME_DURATION_SEC);
      setPosture(null);
      if (next === "reach") {
        gameEndRef.current = performance.now() + GAME_DURATION_SEC * 1000;
      }
    },
    [],
  );

  // ── 描画ヘルパー（HUD） ──
  const isRunning = status === "running";
  const activeMeta = ACTIVITIES.find((a) => a.id === activity) ?? ACTIVITIES[0];

  const postureColor =
    posture?.level === "good"
      ? "text-theme-accent"
      : posture?.level === "poor"
        ? "text-theme-warning"
        : "text-theme-secondary";

  return (
    <section className="max-w-[1100px] mx-auto px-4 py-6" aria-labelledby="move-heading">
      {/* スコープ付き keyframes（globals.css を汚さない） */}
      <style>{`
        @keyframes mv-pop {
          0% { transform: scale(0.7); opacity: 0; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mv-spin { to { transform: rotate(360deg); } }
        .mv-pop { animation: mv-pop 0.5s ease-out both; }
        .mv-spin { animation: mv-spin 0.9s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mv-pop, .mv-spin { animation: none !important; }
        }
      `}</style>

      <header className="mb-5">
        <h2 id="move-heading" className="text-2xl font-bold text-theme-primary flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-theme-accent" aria-hidden="true" />
          体を動かす
        </h2>
        <p className="mt-1 text-sm text-theme-secondary">
          カメラで姿勢を読み取り、デスクワークの合間のストレッチや姿勢チェックをサポートします。
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-theme-highlight px-3 py-1.5 text-xs text-theme-secondary">
          <ShieldCheckIcon className="w-4 h-4 text-theme-accent" aria-hidden="true" />
          すべて端末内で処理します。映像の録画・送信は一切ありません。
        </p>
      </header>

      {/* アクティビティ選択 */}
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="アクティビティの選択"
      >
        {ACTIVITIES.map((a) => {
          const selected = a.id === activity;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={a.desc}
              onClick={() => handleActivityChange(a.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                selected
                  ? "bg-theme-accent text-white shadow"
                  : "bg-theme-card text-theme-secondary border border-theme-light hover:bg-theme-highlight"
              }`}
            >
              <span className="hidden sm:inline">{a.label}</span>
              <span className="sm:hidden">{a.short}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-theme-tertiary">{activeMeta.desc}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 映像エリア */}
        <div className="relative overflow-hidden rounded-2xl border border-theme-medium bg-black/90 aspect-[4/3]">
          {/* video は計算用に常設するが画面には出さない（canvas にミラー描画する） */}
          <video ref={videoRef} className="hidden" playsInline muted aria-hidden="true" />
          <canvas
            ref={canvasRef}
            className="h-full w-full object-cover"
            aria-label="カメラ映像と姿勢スケルトンのオーバーレイ"
            role="img"
          />

          {/* 状態オーバーレイ */}
          {status !== "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {status === "idle" && (
                <>
                  <CameraIcon className="w-12 h-12 text-theme-tertiary" aria-hidden="true" />
                  <p className="text-sm text-theme-secondary">
                    「カメラを開始」を押すと、端末内で姿勢の読み取りを始めます。
                  </p>
                </>
              )}
              {status === "loading" && (
                <>
                  <ArrowPathIcon className="mv-spin w-10 h-10 text-theme-accent" aria-hidden="true" />
                  <p className="text-sm text-theme-secondary" role="status" aria-live="polite">
                    カメラとモデルを準備しています…
                  </p>
                </>
              )}
              {status === "denied" && (
                <div role="alert" className="text-sm text-theme-secondary">
                  <p className="font-medium text-theme-warning">カメラを利用できませんでした。</p>
                  <p className="mt-1">
                    ブラウザの設定でカメラのアクセスを許可してから、もう一度お試しください。
                  </p>
                </div>
              )}
              {status === "unsupported" && (
                <div role="alert" className="text-sm text-theme-secondary">
                  <p className="font-medium text-theme-warning">
                    このブラウザはカメラ機能に対応していません。
                  </p>
                  <p className="mt-1">
                    別のブラウザ（最新の Chrome / Safari など）でお試しください。
                  </p>
                </div>
              )}
              {status === "model-error" && (
                <div role="alert" className="text-sm text-theme-secondary">
                  <p className="font-medium text-theme-warning">姿勢モデルの読み込みに失敗しました。</p>
                  <p className="mt-1">
                    ネットワーク接続をご確認のうえ、もう一度お試しください。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 走行中の HUD（左上） */}
          {isRunning && (
            <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-lg bg-black/45 px-3 py-2 text-xs text-white backdrop-blur-sm">
              {delegate && <span>処理: {delegate === "GPU" ? "GPU" : "CPU"}</span>}
              <span aria-live="off">{fps} fps</span>
            </div>
          )}

          {/* 達成演出 */}
          {achieved && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="mv-pop rounded-2xl bg-theme-accent/90 px-6 py-4 text-center text-white shadow-lg">
                <p className="text-lg font-bold">よくできました！</p>
                <p className="text-sm">{STRETCH_GOAL}回 達成です</p>
              </div>
            </div>
          )}
        </div>

        {/* サイド HUD */}
        <aside className="flex flex-col gap-4">
          {/* アクティビティ別 HUD */}
          <div className="rounded-2xl border border-theme-light bg-theme-card p-4">
            {activity === "posture" && (
              <div>
                <h3 className="text-sm font-semibold text-theme-secondary">姿勢スコア</h3>
                {isRunning && posture ? (
                  posture.reliable ? (
                    <>
                      <p className={`mt-1 text-4xl font-bold ${postureColor}`} aria-live="polite">
                        {posture.score}
                        <span className="text-base font-normal text-theme-tertiary"> / 100</span>
                      </p>
                      <p className="mt-2 text-sm text-theme-secondary" aria-live="polite">
                        {posture.feedback}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-theme-secondary" aria-live="polite">
                      {posture.feedback}
                    </p>
                  )
                ) : (
                  <p className="mt-2 text-sm text-theme-tertiary">
                    カメラを開始すると姿勢を採点します。
                  </p>
                )}
              </div>
            )}

            {(activity === "stretch-arms" || activity === "stretch-side") && (
              <div>
                <h3 className="text-sm font-semibold text-theme-secondary">レップ数</h3>
                <p className="mt-1 text-4xl font-bold text-theme-accent" aria-live="polite">
                  {reps}
                  <span className="text-base font-normal text-theme-tertiary"> / {STRETCH_GOAL}</span>
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-theme-highlight">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-[width] duration-300"
                    style={{ width: `${Math.min(100, (reps / STRETCH_GOAL) * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-theme-tertiary">
                  {activity === "stretch-arms"
                    ? "両腕をしっかり上げて、ゆっくり下ろしましょう。"
                    : "上半身を左右にゆっくり倒しましょう。"}
                </p>
              </div>
            )}

            {activity === "reach" && (
              <div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-theme-secondary">スコア</h3>
                    <p className="mt-1 text-4xl font-bold text-theme-accent" aria-live="polite">
                      {gameScore}
                    </p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-semibold text-theme-secondary">残り</h3>
                    <p className="mt-1 text-2xl font-bold text-theme-primary" aria-live="off">
                      {gameTimeLeft}
                      <span className="text-sm font-normal text-theme-tertiary">秒</span>
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-theme-tertiary">
                  手でターゲットに触れて消しましょう。
                </p>
              </div>
            )}
          </div>

          {/* 操作ボタン */}
          <div className="flex flex-col gap-2">
            {!isRunning ? (
              <button
                type="button"
                onClick={() => {
                  void startCamera();
                }}
                disabled={status === "loading"}
                className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <CameraIcon className="w-5 h-5" aria-hidden="true" />
                {status === "loading" ? "準備中…" : "カメラを開始"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="btn btn-secondary inline-flex items-center justify-center gap-2"
              >
                <StopIcon className="w-5 h-5" aria-hidden="true" />
                停止
              </button>
            )}
            <p className="text-xs text-theme-muted">
              停止すると、カメラはただちにオフになります。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
