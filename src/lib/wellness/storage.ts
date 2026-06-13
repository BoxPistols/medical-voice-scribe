// SSR セーフな localStorage 永続化ヘルパー（ウェルネス共有ストア）
// 各ミニアプリは個別のアクセサ経由で読み書きし、AIヘルスコーチは get* で横断参照する。
// 変更は window の "vital:store" カスタムイベントで他コンポーネントへ通知する。

import type { MoodEntry, SymptomCheck, BreathSession, MoveSession } from "./types";

const NS = "vital:";

export const STORAGE_KEYS = {
  mood: `${NS}mood-entries`,
  symptom: `${NS}symptom-checks`,
  breath: `${NS}breath-sessions`,
  move: `${NS}move-sessions`,
} as const;

export type StoreKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** localStorage 変更を同一タブ内の他コンポーネントへ伝えるイベント名 */
export const STORE_EVENT = "vital:store";

const isBrowser = (): boolean => typeof window !== "undefined";

/** 一意なIDを生成（crypto.randomUUID フォールバック付き） */
export function newId(): string {
  if (isBrowser() && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // フォールバック: 時刻 + カウンタ相当のエントロピー
  return `id-${Date.now().toString(36)}-${Math.floor(performance.now() * 1000).toString(36)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { key } }));
  } catch {
    // クォータ超過などは黙って無視（デモ用途）
  }
}

/** 配列ストアの先頭に1件追加し、最大件数で切り詰めて保存。保存後の配列を返す。 */
function prependCapped<T>(key: string, item: T, cap: number): T[] {
  const list = readJSON<unknown>(key, []);
  const arr = Array.isArray(list) ? (list as T[]) : [];
  const next = [item, ...arr].slice(0, cap);
  writeJSON(key, next);
  return next;
}

const CAP = 500;

// ── 気分ジャーナル ───────────────────────────────────────────────
export const getMoodEntries = (): MoodEntry[] => readJSON<MoodEntry[]>(STORAGE_KEYS.mood, []);
export const addMoodEntry = (entry: MoodEntry): MoodEntry[] => prependCapped(STORAGE_KEYS.mood, entry, CAP);
export const setMoodEntries = (entries: MoodEntry[]): void => writeJSON(STORAGE_KEYS.mood, entries);

// ── 症状チェック ─────────────────────────────────────────────────
export const getSymptomChecks = (): SymptomCheck[] => readJSON<SymptomCheck[]>(STORAGE_KEYS.symptom, []);
export const addSymptomCheck = (check: SymptomCheck): SymptomCheck[] => prependCapped(STORAGE_KEYS.symptom, check, CAP);
export const setSymptomChecks = (checks: SymptomCheck[]): void => writeJSON(STORAGE_KEYS.symptom, checks);

// ── 呼吸・瞑想セッション ─────────────────────────────────────────
export const getBreathSessions = (): BreathSession[] => readJSON<BreathSession[]>(STORAGE_KEYS.breath, []);
export const addBreathSession = (s: BreathSession): BreathSession[] => prependCapped(STORAGE_KEYS.breath, s, CAP);

// ── 体を動かすセッション ─────────────────────────────────────────
export const getMoveSessions = (): MoveSession[] => readJSON<MoveSession[]>(STORAGE_KEYS.move, []);
export const addMoveSession = (s: MoveSession): MoveSession[] => prependCapped(STORAGE_KEYS.move, s, CAP);

/** STORE_EVENT を購読し、クリーンアップ関数を返す（React の useEffect 用）。 */
export function subscribeStore(handler: (key: string) => void): () => void {
  if (!isBrowser()) return () => {};
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ key: string }>).detail;
    handler(detail?.key ?? "");
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key) handler(e.key);
  };
  window.addEventListener(STORE_EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STORE_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
