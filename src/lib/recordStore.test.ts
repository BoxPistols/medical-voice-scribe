import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialStore,
  createSampleSessions,
  clearAllSessions,
  resetToInitialStore,
  loadStore,
  deleteSession,
  filterSessions,
} from "./recordStore";

// src/test/setup.ts の localStorage は vi.fn() の空モックで保存が効かないため、
// このテストでは実際に読み書きできるメモリ実装に差し替える
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
}

describe("recordStore 初期化とサンプル", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true });
  });

  it("初回起動時はサンプル入りの初期ストアを返し、先頭がアクティブになる", () => {
    const store = loadStore();
    expect(store.sessions.length).toBeGreaterThan(0);
    expect(store.sessions.every((s) => s.isSample)).toBe(true);
    expect(store.activeSessionId).toBe(filterSessions(store)[0].id);
  });

  it("サンプルは3カテゴリすべてを含み、ラベルが「例:」で始まる", () => {
    const cats = new Set(createSampleSessions().map((s) => s.category));
    expect(cats).toEqual(new Set(["medical", "daily", "memo"]));
    expect(createSampleSessions().every((s) => s.label.startsWith("例:"))).toBe(true);
  });

  it("clearAllSessions は空のセッション1件だけにして保存する", () => {
    const store = clearAllSessions();
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0].transcript).toBe("");
    expect(store.sessions[0].isSample).toBeUndefined();
    expect(loadStore().sessions).toHaveLength(1);
  });

  it("resetToInitialStore はユーザーの記録を消してサンプルに戻す", () => {
    let store = clearAllSessions();
    store = deleteSession(store, store.sessions[0].id);
    expect(store.sessions).toHaveLength(0);
    const reset = resetToInitialStore();
    expect(reset.sessions.length).toBe(createInitialStore().sessions.length);
    expect(loadStore().sessions.every((s) => s.isSample)).toBe(true);
  });
});
