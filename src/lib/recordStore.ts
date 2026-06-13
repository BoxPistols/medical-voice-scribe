// ── セッション記録管理ストア ──────────────────────────────────────────
// localStorage ベースでセッション（診察記録・メモ等）を永続化する

import type { SoapNote, ChatMessage, TokenUsage } from "@/app/api/analyze/types";

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

// ── ストア読み書き ──────────────────────────────────────────────────────

/** ストア全体を読み込む。存在しなければ初期状態を返す */
export function loadStore(): RecordStore {
  if (typeof window === "undefined") {
    return { version: STORE_VERSION, activeSessionId: null, sessions: [] };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: STORE_VERSION, activeSessionId: null, sessions: [] };
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
