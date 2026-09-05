// ── セッション記録管理ストア ──────────────────────────────────────────
// localStorage ベースでセッション（診察記録・メモ等）を永続化する

import type { SoapNote, ChatMessage, TokenUsage } from "@/app/api/analyze/types";
import { SAMPLE_INTERVIEWS } from "./sampleInterviews";

// ── 型定義 ──────────────────────────────────────────────────────────────

export type SessionCategory = "medical" | "daily" | "memo";

export interface RecordSession {
  id: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;
  label: string;           // ユーザー付与のラベル（例: "田中さん 腰痛"）
  patientTag: string;      // 患者識別タグ（匿名化、任意）
  category: SessionCategory;
  transcript: string;
  soapNote: SoapNote | null;
  chatHistory: ChatMessage[];
  tokenUsage: TokenUsage | null;
  /** 初期投入したサンプル。一覧で「例」と表示し、復元の対象になる */
  isSample?: boolean;
}

export interface RecordStore {
  version: number;
  activeSessionId: string | null;
  sessions: RecordSession[];
}

// ── 定数 ──────────────────────────────────────────────────────────────

const STORE_KEY = "medical-scribe-records";
const STORE_VERSION = 1;
const MAX_SESSIONS = 500; // localStorage容量制限を考慮

// ── ヘルパー ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/** 新しい空セッションを生成 */
export function createEmptySession(
  category: SessionCategory = "medical",
  label = "",
): RecordSession {
  const ts = now();
  return {
    id: crypto.randomUUID(),
    createdAt: ts,
    updatedAt: ts,
    label,
    patientTag: "",
    category,
    transcript: "",
    soapNote: null,
    chatHistory: [],
    tokenUsage: null,
  };
}

// ── サンプル・初期化 ──────────────────────────────────────────────────────

/** 初回起動時に投入するサンプルセッション。使い方が分かるよう3カテゴリに1件以上置く */
export function createSampleSessions(): RecordSession[] {
  const base = Date.now();
  // 一覧が「新しい順」なので、先頭に置きたいものほどupdatedAtを新しくする
  const at = (minutesAgo: number) => new Date(base - minutesAgo * 60_000).toISOString();
  const interview = (id: string) => SAMPLE_INTERVIEWS.find((s) => s.id === id)?.text ?? "";

  const mk = (
    overrides: Partial<RecordSession> & Pick<RecordSession, "label" | "category">,
    minutesAgo: number,
  ): RecordSession => ({
    ...createEmptySession(overrides.category, overrides.label),
    createdAt: at(minutesAgo),
    updatedAt: at(minutesAgo),
    isSample: true,
    ...overrides,
  });

  return [
    mk({ label: "例: 内科 頭痛・倦怠感", category: "medical", patientTag: "患者A", transcript: interview("naika") }, 5),
    mk({ label: "例: 整形外科 腰痛", category: "medical", patientTag: "患者B", transcript: interview("seikei") }, 60),
    mk({ label: "例: 小児科 発熱・咳", category: "medical", patientTag: "患者C", transcript: interview("shouni") }, 180),
    mk({
      label: "例: 日常の体調メモ",
      category: "daily",
      transcript: "朝から軽い頭痛。睡眠5時間。コーヒー2杯。昼過ぎに改善。夕方に肩こりあり、ストレッチで少し楽になった。",
    }, 24 * 60),
    mk({
      label: "例: 次回確認したいこと",
      category: "memo",
      transcript: "・血圧手帳を持参する\n・処方薬の飲み忘れが週2回あった\n・健診の結果票を見せる",
    }, 2 * 24 * 60),
  ];
}

/** 初期状態のストア。サンプルを投入し、先頭をアクティブにする */
export function createInitialStore(): RecordStore {
  const sessions = createSampleSessions();
  return { version: STORE_VERSION, activeSessionId: sessions[0]?.id ?? null, sessions };
}

/** すべての記録を消し、空のセッション1件だけにする */
export function clearAllSessions(): RecordStore {
  const empty = createEmptySession("medical");
  const store: RecordStore = { version: STORE_VERSION, activeSessionId: empty.id, sessions: [empty] };
  saveStore(store);
  return store;
}

/** 初期状態（サンプル入り）に戻す。ユーザーの記録はすべて消える */
export function resetToInitialStore(): RecordStore {
  const store = createInitialStore();
  saveStore(store);
  return store;
}

// ── ストア読み書き ──────────────────────────────────────────────────────

/** ストア全体を読み込む。存在しなければ初期状態を返す */
export function loadStore(): RecordStore {
  if (typeof window === "undefined") {
    return { version: STORE_VERSION, activeSessionId: null, sessions: [] };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    // 初回起動: サンプル入りの初期ストアを返す（保存は最初の操作時に行われる）
    if (!raw) return createInitialStore();
    const parsed = JSON.parse(raw) as RecordStore;
    // バージョンマイグレーション（将来用）
    if (!parsed.version || parsed.version < STORE_VERSION) {
      parsed.version = STORE_VERSION;
    }
    return parsed;
  } catch {
    return { version: STORE_VERSION, activeSessionId: null, sessions: [] };
  }
}

/** ストア全体を保存 */
export function saveStore(store: RecordStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    // localStorage容量超過時: 古いセッションを削除して再試行
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const trimmed = { ...store, sessions: store.sessions.slice(-Math.floor(MAX_SESSIONS / 2)) };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
      } catch {
        // リトライも失敗した場合はデータロスを許容してクラッシュを防ぐ
      }
    }
  }
}

// ── セッション操作 ──────────────────────────────────────────────────────

/** セッションを追加して保存。新セッションをアクティブにする */
export function addSession(store: RecordStore, session: RecordSession): RecordStore {
  const updated: RecordStore = {
    ...store,
    activeSessionId: session.id,
    sessions: [...store.sessions, session].slice(-MAX_SESSIONS),
  };
  saveStore(updated);
  return updated;
}

/** セッションを更新して保存 */
export function updateSession(
  store: RecordStore,
  sessionId: string,
  patch: Partial<Omit<RecordSession, "id" | "createdAt">>,
): RecordStore {
  const updated: RecordStore = {
    ...store,
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, ...patch, updatedAt: now() } : s,
    ),
  };
  saveStore(updated);
  return updated;
}

/** セッションを削除して保存 */
export function deleteSession(store: RecordStore, sessionId: string): RecordStore {
  const sessions = store.sessions.filter((s) => s.id !== sessionId);
  const updated: RecordStore = {
    ...store,
    activeSessionId: store.activeSessionId === sessionId
      ? (sessions[sessions.length - 1]?.id ?? null)
      : store.activeSessionId,
    sessions,
  };
  saveStore(updated);
  return updated;
}

/** アクティブセッションを切り替え */
export function switchSession(store: RecordStore, sessionId: string): RecordStore {
  const updated: RecordStore = { ...store, activeSessionId: sessionId };
  saveStore(updated);
  return updated;
}

/** アクティブセッションを取得 */
export function getActiveSession(store: RecordStore): RecordSession | null {
  if (!store.activeSessionId) return null;
  return store.sessions.find((s) => s.id === store.activeSessionId) ?? null;
}

/** ユニークな患者タグ一覧を取得 */
export function getPatientTags(store: RecordStore): string[] {
  const tags = new Set(store.sessions.map((s) => s.patientTag).filter(Boolean));
  return Array.from(tags).sort();
}

/** セッション一覧をフィルタ */
export function filterSessions(
  store: RecordStore,
  opts: { category?: SessionCategory; patientTag?: string; search?: string } = {},
): RecordSession[] {
  let sessions = [...store.sessions];
  if (opts.category) sessions = sessions.filter((s) => s.category === opts.category);
  if (opts.patientTag) sessions = sessions.filter((s) => s.patientTag === opts.patientTag);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    sessions = sessions.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.patientTag.toLowerCase().includes(q) ||
        s.transcript.toLowerCase().includes(q),
    );
  }
  // 新しい順
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
