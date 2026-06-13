import { describe, it, expect } from "vitest";
import {
  BREATH_PATTERNS,
  getPatternById,
  cycleDurationSec,
  getPhaseState,
  clamp01,
  type BreathPattern,
} from "./breathing";

const box: BreathPattern = getPatternById("box"); // 4-4-4-4
const relax: BreathPattern = getPatternById("relax478"); // 4-7-8-0
const coherent: BreathPattern = getPatternById("coherent"); // 5.5-0-5.5-0

describe("BREATH_PATTERNS", () => {
  it("4つのパターンを持つ", () => {
    expect(BREATH_PATTERNS).toHaveLength(4);
  });

  it("各パターンのidは一意", () => {
    const ids = BREATH_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全フェーズ秒は非負", () => {
    for (const p of BREATH_PATTERNS) {
      expect(p.inhale).toBeGreaterThanOrEqual(0);
      expect(p.holdIn).toBeGreaterThanOrEqual(0);
      expect(p.exhale).toBeGreaterThanOrEqual(0);
      expect(p.holdOut).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getPatternById", () => {
  it("既知のidを返す", () => {
    expect(getPatternById("relax478").id).toBe("relax478");
  });
  it("未知のidは先頭にフォールバック", () => {
    expect(getPatternById("nope").id).toBe(BREATH_PATTERNS[0].id);
  });
});

describe("cycleDurationSec", () => {
  it("ボックス呼吸は16秒", () => {
    expect(cycleDurationSec(box)).toBe(16);
  });
  it("リラックスは19秒（4+7+8）", () => {
    expect(cycleDurationSec(relax)).toBe(19);
  });
  it("コヒーレントは11秒（5.5+5.5）", () => {
    expect(cycleDurationSec(coherent)).toBe(11);
  });
});

describe("getPhaseState - ボックス呼吸 (4-4-4-4)", () => {
  it("t=0 は吸う(inhale)の開始", () => {
    const s = getPhaseState(0, box);
    expect(s.kind).toBe("inhale");
    expect(s.label).toBe("吸って");
    expect(s.phaseProgress).toBeCloseTo(0, 5);
    expect(s.cycle).toBe(0);
    expect(s.scale).toBeCloseTo(0, 5);
  });

  it("吸うフェーズの中盤(t=2s)で進捗0.5・残り2秒", () => {
    const s = getPhaseState(2000, box);
    expect(s.kind).toBe("inhale");
    expect(s.phaseProgress).toBeCloseTo(0.5, 5);
    expect(s.phaseRemainingSec).toBeCloseTo(2, 5);
    // easeInOut(0.5) = 0.5
    expect(s.scale).toBeCloseTo(0.5, 5);
  });

  it("t=4s で吸い切って止める(holdIn)、scaleは1で保持", () => {
    const s = getPhaseState(4000, box);
    expect(s.kind).toBe("holdIn");
    expect(s.scale).toBeCloseTo(1, 5);
  });

  it("t=8s で吐く(exhale)開始、scaleは1付近から減少", () => {
    const s = getPhaseState(8000, box);
    expect(s.kind).toBe("exhale");
    expect(s.phaseProgress).toBeCloseTo(0, 5);
    expect(s.scale).toBeCloseTo(1, 5);
  });

  it("吐くフェーズ中盤(t=10s)で scale=0.5", () => {
    const s = getPhaseState(10000, box);
    expect(s.kind).toBe("exhale");
    expect(s.scale).toBeCloseTo(0.5, 5);
  });

  it("t=12s で吐き切って止める(holdOut)、scaleは0で保持", () => {
    const s = getPhaseState(12000, box);
    expect(s.kind).toBe("holdOut");
    expect(s.scale).toBeCloseTo(0, 5);
  });

  it("1サイクル(16s)後は次サイクルの吸う開始、cycle=1", () => {
    const s = getPhaseState(16000, box);
    expect(s.kind).toBe("inhale");
    expect(s.cycle).toBe(1);
    expect(s.phaseProgress).toBeCloseTo(0, 5);
  });

  it("3サイクル目の途中(t=2*16+2=34s)で cycle=2 の吸う中盤", () => {
    const s = getPhaseState(34000, box);
    expect(s.cycle).toBe(2);
    expect(s.kind).toBe("inhale");
    expect(s.phaseProgress).toBeCloseTo(0.5, 5);
  });
});

describe("getPhaseState - 0秒フェーズのスキップ (coherent 5.5-0-5.5-0)", () => {
  it("吸う→吐くへ直接遷移（holdIn/holdOutを飛ばす）", () => {
    const inhaleMid = getPhaseState(2000, coherent);
    expect(inhaleMid.kind).toBe("inhale");

    // 5.5s ちょうどは exhale の開始（holdIn=0をスキップ）
    const atBoundary = getPhaseState(5500, coherent);
    expect(atBoundary.kind).toBe("exhale");
    expect(atBoundary.phaseProgress).toBeCloseTo(0, 5);
  });

  it("サイクル末尾(11s直前)は吐く終端、holdOutは出現しない", () => {
    const s = getPhaseState(10999, coherent);
    expect(s.kind).toBe("exhale");
    // 次サイクル先頭
    const next = getPhaseState(11000, coherent);
    expect(next.kind).toBe("inhale");
    expect(next.cycle).toBe(1);
  });
});

describe("getPhaseState - リラックス (4-7-8-0)", () => {
  it("各フェーズ境界が正しい", () => {
    expect(getPhaseState(0, relax).kind).toBe("inhale");
    expect(getPhaseState(4000, relax).kind).toBe("holdIn"); // 4s後
    expect(getPhaseState(11000, relax).kind).toBe("exhale"); // 4+7=11s後
    // 4+7+8=19s でサイクル末、holdOut=0なので次サイクル
    expect(getPhaseState(19000, relax).kind).toBe("inhale");
    expect(getPhaseState(19000, relax).cycle).toBe(1);
  });
});

describe("getPhaseState - 異常系/境界", () => {
  it("負の経過は0扱い", () => {
    const s = getPhaseState(-5000, box);
    expect(s.kind).toBe("inhale");
    expect(s.cycle).toBe(0);
    expect(s.phaseProgress).toBeCloseTo(0, 5);
  });

  it("全フェーズ0秒のパターンはセーフ値を返す（ゼロ除算しない）", () => {
    const zero: BreathPattern = {
      id: "zero",
      name: "zero",
      description: "",
      inhale: 0,
      holdIn: 0,
      exhale: 0,
      holdOut: 0,
    };
    const s = getPhaseState(1234, zero);
    expect(s.kind).toBe("inhale");
    expect(Number.isFinite(s.scale)).toBe(true);
    expect(Number.isFinite(s.phaseProgress)).toBe(true);
    expect(s.scale).toBe(0);
  });

  it("scaleは常に0..1の範囲に収まる", () => {
    for (let ms = 0; ms <= 20000; ms += 137) {
      const s = getPhaseState(ms, box);
      expect(s.scale).toBeGreaterThanOrEqual(0);
      expect(s.scale).toBeLessThanOrEqual(1);
      expect(s.phaseProgress).toBeGreaterThanOrEqual(0);
      expect(s.phaseProgress).toBeLessThanOrEqual(1);
    }
  });

  it("phaseRemainingSecは0..phaseDurationSecの範囲", () => {
    for (let ms = 0; ms <= 19000; ms += 211) {
      const s = getPhaseState(ms, relax);
      expect(s.phaseRemainingSec).toBeGreaterThanOrEqual(0);
      expect(s.phaseRemainingSec).toBeLessThanOrEqual(s.phaseDurationSec + 1e-6);
    }
  });
});

describe("clamp01", () => {
  it("範囲内はそのまま", () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
  it("下限・上限でクランプ", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
  it("NaNは0", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
