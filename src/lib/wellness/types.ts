// 共有ウェルネス型定義 — 気分ジャーナル / 症状チェッカー / 呼吸瞑想 / 体を動かす の各ミニアプリが共有
// AIヘルスコーチがこれらの履歴を横断コンテキストとして参照するため、契約として一元管理する。

/** 5段階評価（1=最も低い … 5=最も高い） */
export type Scale5 = 1 | 2 | 3 | 4 | 5;

/** 気分ジャーナルの1エントリ */
export interface MoodEntry {
  id: string;
  /** 記録時刻（epoch ms） */
  timestamp: number;
  /** 気分（1=とても悪い … 5=とても良い） */
  mood: Scale5;
  /** 活力・エネルギー（任意） */
  energy?: Scale5;
  /** 文脈タグ（仕事 / 睡眠 / 人間関係 など） */
  tags: string[];
  /** 自由記述メモ（任意） */
  note?: string;
}

/** 症状チェックの緊急度トリアージ区分 */
export type SymptomUrgency = "emergency" | "see-doctor" | "monitor" | "self-care";

/** AI症状チェッカーの構造化結果 */
export interface SymptomResult {
  urgency: SymptomUrgency;
  /** 全体所見の要約（1-2文） */
  summary: string;
  /** 考えられる可能性（診断ではなく参考情報） */
  considerations: { name: string; rationale: string }[];
  /** 直ちに受診を要するレッドフラグ */
  redFlags: string[];
  /** セルフケアの提案 */
  selfCare: string[];
  /** 免責事項（医療行為ではない旨） */
  disclaimer: string;
}

/** 症状チェックの入力＋結果の履歴1件 */
export interface SymptomCheck {
  id: string;
  timestamp: number;
  input: {
    description: string;
    bodyPart?: string;
    duration?: string;
    /** 1=軽度 … 5=重度 */
    severity?: Scale5;
  };
  result: SymptomResult;
}

/** 呼吸・瞑想セッションの記録 */
export interface BreathSession {
  id: string;
  timestamp: number;
  /** パターン識別子（box / relax478 / coherent など） */
  pattern: string;
  durationSec: number;
}

/** 体を動かす（カメラ）セッションの記録 */
export interface MoveSession {
  id: string;
  timestamp: number;
  /** アクティビティ識別子（posture / stretch / reach など） */
  activity: string;
  reps?: number;
  durationSec: number;
}
