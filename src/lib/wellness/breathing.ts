// 呼吸・瞑想ミニアプリのコアロジック。
// - 呼吸パターン定義（定数配列）
// - 経過ミリ秒とパターンから「現在のフェーズ・進捗・オーブのスケール」を返す純粋関数（ユニットテスト可能）
// - WebAudio による柔らかいアンビエントパッド音エンジン（2オシレータ微デチューン→ゲイン→ローパス、ゆっくりLFO）
//
// UI（副作用）には依存しない。純粋ロジックは breathing.test.ts でテストする。

// ── フェーズ ────────────────────────────────────────────────────────────────

/** 呼吸の1フェーズ種別 */
export type BreathPhaseKind = "inhale" | "holdIn" | "exhale" | "holdOut";

/** フェーズ種別ごとの日本語ラベル（短い指示文） */
export const PHASE_LABELS: Record<BreathPhaseKind, string> = {
  inhale: "吸って",
  holdIn: "止めて",
  exhale: "吐いて",
  holdOut: "止めて",
} as const;

// ── パターン定義 ────────────────────────────────────────────────────────────

/**
 * 1つの呼吸パターン。各フェーズの秒数を持つ（0秒のフェーズはスキップ扱い）。
 * 合計時間 = inhale + holdIn + exhale + holdOut の1サイクル。
 */
export interface BreathPattern {
  /** 識別子（BreathSession.pattern に保存） */
  id: string;
  /** 表示名 */
  name: string;
  /** 補足説明（落ち着いたトーン） */
  description: string;
  /** 吸う秒数 */
  inhale: number;
  /** 吸い切って止める秒数 */
  holdIn: number;
  /** 吐く秒数 */
  exhale: number;
  /** 吐き切って止める秒数 */
  holdOut: number;
}

/** 提供する呼吸パターン（定数配列） */
export const BREATH_PATTERNS: readonly BreathPattern[] = [
  {
    id: "box",
    name: "ボックス呼吸",
    description: "4-4-4-4。集中と緊張のリセットに",
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
  },
  {
    id: "relax478",
    name: "リラックス",
    description: "4-7-8。気持ちを落ち着けて入眠に",
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
  },
  {
    id: "coherent",
    name: "コヒーレント",
    description: "5.5-5.5。自律神経のバランスを整える",
    inhale: 5.5,
    holdIn: 0,
    exhale: 5.5,
    holdOut: 0,
  },
  {
    id: "calm46",
    name: "落ち着き",
    description: "4-0-6-0。吐く息を長く、穏やかに",
    inhale: 4,
    holdIn: 0,
    exhale: 6,
    holdOut: 0,
  },
] as const;

/** id からパターンを取得（無ければ先頭を返す。null/undefinedは決して返さない） */
export function getPatternById(id: string): BreathPattern {
  return BREATH_PATTERNS.find((p) => p.id === id) ?? BREATH_PATTERNS[0];
}

/** 1サイクルの合計秒数 */
export function cycleDurationSec(pattern: BreathPattern): number {
  return pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut;
}

// ── フェーズ算出（純粋関数：テスト対象の中核） ──────────────────────────────

/** 経過時刻におけるフェーズ状態のスナップショット */
export interface BreathPhaseState {
  /** 現在のフェーズ種別 */
  kind: BreathPhaseKind;
  /** 表示ラベル（吸って/止めて/吐いて/止めて） */
  label: string;
  /** このフェーズ内の進捗 0..1（0=開始, 1=終了直前） */
  phaseProgress: number;
  /** このフェーズの残り秒（切り上げ表示用に ceil 前の生値） */
  phaseRemainingSec: number;
  /** このフェーズの長さ（秒） */
  phaseDurationSec: number;
  /** 完了したサイクル数（0始まり、現在進行中は含まない） */
  cycle: number;
  /**
   * オーブのスケール 0..1 を返す指標。
   * 吸う=0→1へ増加 / 吸って止める=1で保持 / 吐く=1→0へ減少 / 吐いて止める=0で保持。
   * イージング（cosine）で滑らかに補間する。
   */
  scale: number;
}

/** 0..1 を cosine で滑らかに補間（easeInOut 相当） */
function easeInOut(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return 0.5 - 0.5 * Math.cos(Math.PI * clamped);
}

/** フェーズ順（0秒のものは getPhaseState 内でスキップ） */
const PHASE_ORDER: readonly BreathPhaseKind[] = ["inhale", "holdIn", "exhale", "holdOut"];

function phaseSeconds(pattern: BreathPattern, kind: BreathPhaseKind): number {
  switch (kind) {
    case "inhale":
      return pattern.inhale;
    case "holdIn":
      return pattern.holdIn;
    case "exhale":
      return pattern.exhale;
    case "holdOut":
      return pattern.holdOut;
  }
}

/** フェーズ進捗からオーブのスケール（0..1）を算出 */
function scaleFor(kind: BreathPhaseKind, progress: number): number {
  switch (kind) {
    case "inhale":
      return easeInOut(progress); // 0 → 1
    case "holdIn":
      return 1; // 拡張を保持
    case "exhale":
      return easeInOut(1 - progress); // 1 → 0
    case "holdOut":
      return 0; // 収縮を保持
  }
}

/**
 * 経過ミリ秒とパターンから現在のフェーズ状態を返す純粋関数。
 * - elapsedMs<0 は 0 と同等に扱う。
 * - 合計0秒の異常パターンは inhale 固定のセーフ値を返す（ゼロ除算回避）。
 */
export function getPhaseState(elapsedMs: number, pattern: BreathPattern): BreathPhaseState {
  const total = cycleDurationSec(pattern);

  // 異常系：合計0秒（全フェーズ0）。セーフなデフォルトを返す。
  if (total <= 0) {
    return {
      kind: "inhale",
      label: PHASE_LABELS.inhale,
      phaseProgress: 0,
      phaseRemainingSec: 0,
      phaseDurationSec: 0,
      cycle: 0,
      scale: 0,
    };
  }

  const elapsedSec = Math.max(0, elapsedMs) / 1000;
  const cycle = Math.floor(elapsedSec / total);
  // サイクル内のオフセット秒。total ちょうどのときに 0 へ戻るよう剰余を取る。
  let offset = elapsedSec - cycle * total;
  // 浮動小数点誤差で offset が total を僅かに超えるのを防ぐ
  if (offset >= total) offset = total - 1e-9;

  // 0秒フェーズをスキップしながら該当フェーズを探す
  for (const kind of PHASE_ORDER) {
    const dur = phaseSeconds(pattern, kind);
    if (dur <= 0) continue;
    if (offset < dur) {
      const progress = dur > 0 ? offset / dur : 1;
      return {
        kind,
        label: PHASE_LABELS[kind],
        phaseProgress: progress,
        phaseRemainingSec: dur - offset,
        phaseDurationSec: dur,
        cycle,
        scale: scaleFor(kind, progress),
      };
    }
    offset -= dur;
  }

  // 数値誤差で最後まで漏れた場合は、最後の非0フェーズの終端として返す
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const kind = PHASE_ORDER[i];
    const dur = phaseSeconds(pattern, kind);
    if (dur > 0) {
      return {
        kind,
        label: PHASE_LABELS[kind],
        phaseProgress: 1,
        phaseRemainingSec: 0,
        phaseDurationSec: dur,
        cycle,
        scale: scaleFor(kind, 1),
      };
    }
  }

  // ここには到達しない（total>0 なら必ず非0フェーズが1つ以上ある）
  return {
    kind: "inhale",
    label: PHASE_LABELS.inhale,
    phaseProgress: 0,
    phaseRemainingSec: 0,
    phaseDurationSec: 0,
    cycle,
    scale: 0,
  };
}

// ── アンビエント音エンジン（WebAudio） ──────────────────────────────────────

/**
 * 柔らかいアンビエントパッドを生成する WebAudio エンジン。
 * 2つのオシレータを微デチューン → 個別ゲイン → ミックス → ローパス → マスターゲイン → 出力。
 * ゆっくりした LFO でローパスのカットオフを揺らし、息づくような質感を作る。
 *
 * 自動再生制限に従い、必ずユーザー操作起点で start() を呼ぶこと。
 * 破棄時は dispose() で全ノードを停止・AudioContext を close する。
 */
export class AmbientPadEngine {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain1: GainNode | null = null;
  private gain2: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private master: GainNode | null = null;
  private started = false;
  private currentVolume: number;

  /** ベースとなる和音（穏やかな完全5度。Aマイナー系の落ち着いた響き） */
  private static readonly BASE_FREQ_1 = 146.83; // D3
  private static readonly BASE_FREQ_2 = 220.0; // A3
  private static readonly DETUNE_CENTS = 6; // 微デチューン
  private static readonly FILTER_BASE_HZ = 620;
  private static readonly FILTER_LFO_HZ = 260;
  private static readonly LFO_RATE_HZ = 0.07; // ゆっくり

  constructor(volume = 0.4) {
    this.currentVolume = clamp01(volume);
  }

  /** 再生中か */
  isPlaying(): boolean {
    return this.started;
  }

  /**
   * 音を開始する（ユーザー操作起点で呼ぶこと）。
   * 既に開始済みなら何もしない。AudioContext 非対応環境では false を返す。
   */
  start(): boolean {
    if (this.started) return true;
    if (typeof window === "undefined") return false;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();
      const now = ctx.currentTime;

      const master = ctx.createGain();
      // 立ち上がりはフェードインして耳に優しく
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.currentVolume), now + 1.6);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = AmbientPadEngine.FILTER_BASE_HZ;
      filter.Q.value = 0.7;

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = AmbientPadEngine.BASE_FREQ_1;
      osc1.detune.value = -AmbientPadEngine.DETUNE_CENTS;

      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = AmbientPadEngine.BASE_FREQ_2;
      osc2.detune.value = AmbientPadEngine.DETUNE_CENTS;

      const gain1 = ctx.createGain();
      gain1.gain.value = 0.5;
      const gain2 = ctx.createGain();
      gain2.gain.value = 0.32;

      // LFO（フィルタカットオフをゆっくり揺らす）
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = AmbientPadEngine.LFO_RATE_HZ;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = AmbientPadEngine.FILTER_LFO_HZ;

      // 配線
      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(filter);
      gain2.connect(filter);
      filter.connect(master);
      master.connect(ctx.destination);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      this.ctx = ctx;
      this.osc1 = osc1;
      this.osc2 = osc2;
      this.gain1 = gain1;
      this.gain2 = gain2;
      this.filter = filter;
      this.lfo = lfo;
      this.lfoGain = lfoGain;
      this.master = master;
      this.started = true;

      if (ctx.state === "suspended") void ctx.resume();
      return true;
    } catch {
      this.cleanupNodes();
      return false;
    }
  }

  /** マスター音量を設定（0..1）。滑らかにランプする。 */
  setVolume(volume: number): void {
    this.currentVolume = clamp01(volume);
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.linearRampToValueAtTime(Math.max(0.0001, this.currentVolume), now + 0.15);
    }
  }

  /**
   * 呼吸フェーズのスケール（0..1）に合わせてフィルタ明度を微調整する。
   * 吸う（scale が大）ほど明るく開く。任意呼び出し。
   */
  applyBreathScale(scale: number): void {
    if (!this.filter || !this.ctx) return;
    const s = clamp01(scale);
    const target = AmbientPadEngine.FILTER_BASE_HZ + s * 180;
    const now = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.linearRampToValueAtTime(target, now + 0.4);
  }

  /** 全ノードを停止し AudioContext を閉じる。冪等。 */
  dispose(): void {
    const ctx = this.ctx;
    if (ctx && this.master) {
      try {
        const now = ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
        this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      } catch {
        // ランプ失敗は無視
      }
    }
    this.cleanupNodes();
  }

  private cleanupNodes(): void {
    const stopSafely = (node: OscillatorNode | null): void => {
      if (!node) return;
      try {
        node.stop();
      } catch {
        // 既に停止済み
      }
      try {
        node.disconnect();
      } catch {
        // 無視
      }
    };
    stopSafely(this.osc1);
    stopSafely(this.osc2);
    stopSafely(this.lfo);
    [this.gain1, this.gain2, this.filter, this.lfoGain, this.master].forEach((n) => {
      try {
        n?.disconnect();
      } catch {
        // 無視
      }
    });
    const ctx = this.ctx;
    if (ctx && ctx.state !== "closed") {
      // フェードアウト後に閉じる
      window.setTimeout(() => {
        try {
          void ctx.close();
        } catch {
          // 無視
        }
      }, 450);
    }
    this.ctx = null;
    this.osc1 = null;
    this.osc2 = null;
    this.gain1 = null;
    this.gain2 = null;
    this.filter = null;
    this.lfo = null;
    this.lfoGain = null;
    this.master = null;
    this.started = false;
  }
}

/** 0..1 にクランプ */
export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
