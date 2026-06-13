// 体を動かす（カメラ姿勢トラッキング）ミニアプリの数学＆ローダ層。
// MediaPipe 依存はこのファイルに isolate する（UI と分離）。
// ここに置くロジックは原則として「純粋関数」とし、React/DOM に依存しない（テスト容易性のため）。
//
// 設計方針:
//  - MediaPipe の重い import は loadPoseLandmarker() の中だけで動的 import する（SSR/初期バンドル安全）。
//  - 角度計算・姿勢スコア・レップ検出ステートマシンは pure 関数として export し、UI から呼ぶ。

/** MediaPipe の NormalizedLandmark を最小限に写し取った形（依存型を漏らさないための内部型）。 */
export interface PoseLandmark {
  /** 画像幅で正規化された x（0..1、左→右） */
  x: number;
  /** 画像高で正規化された y（0..1、上→下） */
  y: number;
  /** カメラからの相対深度（符号付き、本アプリでは未使用だが契約として保持） */
  z: number;
  /** 可視性スコア（0..1）。低い値は隠れている / 信頼できない。 */
  visibility: number;
}

/** ランドマーク間の接続（スケルトン描画用）。MediaPipe の Connection と同形。 */
export interface PoseConnection {
  start: number;
  end: number;
}

/**
 * BlazePose（33点）モデルの主要ランドマーク添字。
 * 参照: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

/**
 * 上半身を中心にしたスケルトン接続（デスクワーカー向けに上半身が映る前提）。
 * 全身が映らなくても破綻しないよう、最小限の意味ある接続に絞る。
 */
export const UPPER_BODY_CONNECTIONS: readonly PoseConnection[] = [
  { start: POSE_LANDMARK.LEFT_SHOULDER, end: POSE_LANDMARK.RIGHT_SHOULDER },
  { start: POSE_LANDMARK.LEFT_SHOULDER, end: POSE_LANDMARK.LEFT_ELBOW },
  { start: POSE_LANDMARK.LEFT_ELBOW, end: POSE_LANDMARK.LEFT_WRIST },
  { start: POSE_LANDMARK.RIGHT_SHOULDER, end: POSE_LANDMARK.RIGHT_ELBOW },
  { start: POSE_LANDMARK.RIGHT_ELBOW, end: POSE_LANDMARK.RIGHT_WRIST },
  { start: POSE_LANDMARK.LEFT_SHOULDER, end: POSE_LANDMARK.LEFT_HIP },
  { start: POSE_LANDMARK.RIGHT_SHOULDER, end: POSE_LANDMARK.RIGHT_HIP },
  { start: POSE_LANDMARK.LEFT_HIP, end: POSE_LANDMARK.RIGHT_HIP },
];

/** ランドマークが描画・計算に使える信頼度かどうかの既定しきい値。 */
export const MIN_VISIBILITY = 0.5;

// ── ローダ層（MediaPipe を動的 import） ───────────────────────────────

/** PoseLandmarker のうち本アプリが使う部分だけを表す最小インターフェース。 */
export interface PoseDetector {
  /** 動画フレームから姿勢を推定し、最初の人物のランドマーク配列を返す（検出なしは null）。 */
  detect: (video: HTMLVideoElement, timestampMs: number) => PoseLandmark[] | null;
  /** WASM / GPU リソースを解放する。必ず呼ぶこと。 */
  close: () => void;
  /** 実際に使われた推論デリゲート（フォールバック結果の表示用）。 */
  delegate: "GPU" | "CPU";
}

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/**
 * PoseLandmarker を動的 import で初期化する。
 * GPU デリゲートを優先し、失敗時は CPU にフォールバックする。
 * 失敗（ネットワーク / WASM 不可）時は例外を投げるので、呼び出し側で日本語フォールバック表示すること。
 */
export async function loadPoseLandmarker(): Promise<PoseDetector> {
  // 動的 import: サーバー実行・初期バンドルから MediaPipe を確実に切り離す。
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);

  const createWith = async (delegate: "GPU" | "CPU") =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });

  let delegate: "GPU" | "CPU" = "GPU";
  let landmarker: Awaited<ReturnType<typeof createWith>>;
  try {
    landmarker = await createWith("GPU");
  } catch {
    // GPU デリゲート不可（WebGL 無効など）→ CPU で再試行。これも失敗したら例外は呼び出し側へ伝播。
    delegate = "CPU";
    landmarker = await createWith("CPU");
  }

  return {
    delegate,
    detect: (video, timestampMs) => {
      const result = landmarker.detectForVideo(video, timestampMs);
      const first = result.landmarks[0];
      if (!first || first.length === 0) return null;
      // MediaPipe の NormalizedLandmark を内部型へ写し取る（型の境界を閉じる）。
      return first.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      }));
    },
    close: () => landmarker.close(),
  };
}

// ── ジオメトリ（純粋関数） ────────────────────────────────────────────

interface Vec2 {
  x: number;
  y: number;
}

/** 2点間の角度（度）。水平を 0°、右上がりを正にとる（画像座標は y 下向きなので符号反転して扱う）。 */
export function lineAngleDeg(a: Vec2, b: Vec2): number {
  // 画像座標は下方向が +y。人間直感に合わせ、上向きを正にするため dy を反転。
  const dy = -(b.y - a.y);
  const dx = b.x - a.x;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** 頂点 b における ∠abc を 0..180 度で返す（ストレッチ角度・腕の角度に使用）。 */
export function angleAtDeg(a: Vec2, b: Vec2, c: Vec2): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** ランドマークが計算に使える可視性を持つか。 */
export function isVisible(lm: PoseLandmark | undefined, min = MIN_VISIBILITY): lm is PoseLandmark {
  return !!lm && lm.visibility >= min;
}

/** 配列から安全に取得（範囲外は undefined）。 */
function at(landmarks: PoseLandmark[], idx: number): PoseLandmark | undefined {
  return landmarks[idx];
}

// ── 姿勢チェック ──────────────────────────────────────────────────────

/** 姿勢評価の結果。score は 0..100（高いほど良姿勢）。 */
export interface PostureAssessment {
  /** 信頼できるランドマークが揃っているか（false の時は score を無視して案内する）。 */
  reliable: boolean;
  /** 総合姿勢スコア（0..100）。 */
  score: number;
  /** 肩のラインの傾き（度の絶対値、0 が水平）。 */
  shoulderTiltDeg: number;
  /** 頭部前傾の度合い（正規化、0=直立 / 大きいほど前傾）。 */
  headForwardRatio: number;
  /** ユーザー向けのやさしいフィードバック文。 */
  feedback: string;
  /** 状態区分（HUD の色分け用）。 */
  level: "good" | "fair" | "poor";
}

/**
 * 肩の水平度と頭部前傾から姿勢スコアを算出する純粋関数。
 *
 * - 肩の傾き: 左右肩を結ぶ線が水平からどれだけ傾いているか（猫背・片寄りの指標）。
 * - 頭部前傾: 鼻が両肩の中点よりどれだけ前（下方）に出ているかを肩幅で正規化（ストレートネック傾向の簡易指標）。
 *
 * いずれも医療診断ではなく、デスクワーク中の姿勢への気づきを促す簡易指標。
 */
export function assessPosture(landmarks: PoseLandmark[]): PostureAssessment {
  const ls = at(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rs = at(landmarks, POSE_LANDMARK.RIGHT_SHOULDER);
  const nose = at(landmarks, POSE_LANDMARK.NOSE);

  if (!isVisible(ls) || !isVisible(rs) || !isVisible(nose)) {
    return {
      reliable: false,
      score: 0,
      shoulderTiltDeg: 0,
      headForwardRatio: 0,
      feedback: "肩と頭がカメラに映るよう、少し下がってみてください。",
      level: "fair",
    };
  }

  let angle = lineAngleDeg(ls, rs);
  // 左右が入れ替わっている場合（180度付近）を補正して、水平からの差分(-90..90)にする
  if (angle > 90) angle -= 180;
  else if (angle < -90) angle += 180;

  const shoulderTiltDeg = Math.abs(angle);
  const shoulderWidth = Math.max(1e-4, Math.hypot(rs.x - ls.x, rs.y - ls.y));
  const midShoulder: Vec2 = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  // 鼻が肩の中点よりどれだけ下（=前傾でうつむき）に出ているかを肩幅で正規化。
  // 直立時は鼻が肩より上にあるため負〜0付近、前傾が進むと正方向に増える。
  const headForwardRatio = (nose.y - midShoulder.y) / shoulderWidth;

  // 各指標を 0..1 のペナルティに変換（経験的しきい値、デモ用）。
  // 肩の傾き: 0° で 0、10° 以上で満点ペナルティ。
  const tiltPenalty = Math.min(1, shoulderTiltDeg / 10);
  // 頭部前傾: -0.6（しっかり直立）で 0、0.1 以上でペナルティ満点に近づく。
  const forwardPenalty = Math.min(1, Math.max(0, (headForwardRatio + 0.6) / 0.7));

  const score = Math.round(100 * (1 - 0.5 * tiltPenalty - 0.5 * forwardPenalty));
  const clamped = Math.max(0, Math.min(100, score));

  let level: PostureAssessment["level"];
  let feedback: string;
  if (clamped >= 75) {
    level = "good";
    feedback = "良い姿勢です。この調子で深く呼吸しましょう。";
  } else if (clamped >= 50) {
    level = "fair";
    if (tiltPenalty > forwardPenalty) {
      feedback = "左右の肩の高さをそろえてみましょう。";
    } else {
      feedback = "あごを軽く引いて、背筋を伸ばしましょう。";
    }
  } else {
    level = "poor";
    feedback = "いったん肩を回して、背筋をまっすぐに整えましょう。";
  }

  return { reliable: true, score: clamped, shoulderTiltDeg, headForwardRatio, feedback, level };
}

// ── レップ検出ステートマシン ──────────────────────────────────────────

/** レップ検出の状態。"down"/"up" の往復で 1 レップを数える。 */
export type RepPhase = "up" | "down";

/** レップ検出ステートの永続値。UI 側で useRef に保持して回す。 */
export interface RepState {
  phase: RepPhase;
  count: number;
}

/** レップ検出の生信号（活動ごとの計測値）。 */
export interface RepSignal {
  /** 現在の計測値（活動依存。例: 手首の高さ、体側角度）。 */
  value: number;
  /** 信号が信頼できるか（ランドマーク不足なら false で count を進めない）。 */
  reliable: boolean;
}

/** 初期レップ状態。 */
export function initRepState(): RepState {
  return { phase: "down", count: 0 };
}

/**
 * ヒステリシス付きステートマシンでレップを数える純粋関数。
 * value が highThreshold を超えたら "up"、lowThreshold を下回ったら "down" に遷移し、
 * "up" → "down" の戻りで 1 レップ確定とする（チャタリング防止のため上下に別しきい値）。
 *
 * 返り値は新しい状態（不変）。count が増えたかどうかは呼び出し側で前後比較する。
 */
export function stepRep(
  state: RepState,
  signal: RepSignal,
  lowThreshold: number,
  highThreshold: number,
): RepState {
  if (!signal.reliable) return state;

  if (state.phase === "down") {
    if (signal.value >= highThreshold) {
      return { phase: "up", count: state.count };
    }
    return state;
  }
  // phase === "up": 下限を下回ったら1レップ確定して "down" へ。
  if (signal.value <= lowThreshold) {
    return { phase: "down", count: state.count + 1 };
  }
  return state;
}

/**
 * 「両腕を上げて下ろす」活動の信号。
 * value = 肩の高さを基準にした手首の相対高（上げるほど大きい）。両手首の平均を使う。
 * 画像座標は y 下向きなので、肩より上＝ y が小さい＝ value 大きい、になるよう (肩y - 手首y) を肩幅で正規化。
 */
export function armRaiseSignal(landmarks: PoseLandmark[]): RepSignal {
  const ls = at(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rs = at(landmarks, POSE_LANDMARK.RIGHT_SHOULDER);
  const lw = at(landmarks, POSE_LANDMARK.LEFT_WRIST);
  const rw = at(landmarks, POSE_LANDMARK.RIGHT_WRIST);

  if (!isVisible(ls) || !isVisible(rs)) return { value: 0, reliable: false };
  const shoulderWidth = Math.max(1e-4, Math.hypot(rs.x - ls.x, rs.y - ls.y));
  const shoulderY = (ls.y + rs.y) / 2;

  const samples: number[] = [];
  if (isVisible(lw)) samples.push((shoulderY - lw.y) / shoulderWidth);
  if (isVisible(rw)) samples.push((shoulderY - rw.y) / shoulderWidth);
  if (samples.length === 0) return { value: 0, reliable: false };

  const value = samples.reduce((s, v) => s + v, 0) / samples.length;
  return { value, reliable: true };
}

/**
 * 「体側を伸ばす」活動の信号。
 * value = 体幹（肩中点→腰中点）の鉛直からの傾き角（度）。左右どちらに倒しても正の値。
 * 体側ストレッチは左右どちらかに倒すので、絶対角度のピークで 1 レップを数える。
 */
export function sideBendSignal(landmarks: PoseLandmark[]): RepSignal {
  const ls = at(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rs = at(landmarks, POSE_LANDMARK.RIGHT_SHOULDER);
  const lh = at(landmarks, POSE_LANDMARK.LEFT_HIP);
  const rh = at(landmarks, POSE_LANDMARK.RIGHT_HIP);

  if (!isVisible(ls) || !isVisible(rs) || !isVisible(lh) || !isVisible(rh)) {
    return { value: 0, reliable: false };
  }
  const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);
  // 体幹ベクトルと鉛直線のなす角。鉛直点は腰中点の真上にとる。
  const upPoint: Vec2 = { x: hipMid.x, y: hipMid.y - 1 };
  const angle = angleAtDeg(upPoint, hipMid, shoulderMid);
  return { value: angle, reliable: true };
}

// ── リーチ・ミニゲーム ────────────────────────────────────────────────

/** 手首ランドマークの正規化座標（ミニゲームの当たり判定に使う）。null は未検出。 */
export interface HandPoint {
  x: number;
  y: number;
}

/** 両手首のうち可視なものを返す（ミラー反転は UI 側で行う）。 */
export function getWristPoints(landmarks: PoseLandmark[]): HandPoint[] {
  const out: HandPoint[] = [];
  const lw = at(landmarks, POSE_LANDMARK.LEFT_WRIST);
  const rw = at(landmarks, POSE_LANDMARK.RIGHT_WRIST);
  if (isVisible(lw)) out.push({ x: lw.x, y: lw.y });
  if (isVisible(rw)) out.push({ x: rw.x, y: rw.y });
  return out;
}

/** 点とターゲット中心の距離が半径以内なら命中。座標はすべて 0..1 正規化。 */
export function isHit(hand: HandPoint, target: HandPoint, radiusNorm: number): boolean {
  return Math.hypot(hand.x - target.x, hand.y - target.y) <= radiusNorm;
}
