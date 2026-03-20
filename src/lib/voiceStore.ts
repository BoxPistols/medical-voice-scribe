// ── 音声メモ永続化ストア ──────────────────────────────────────────
// localStorage ベースで音声録音グループを永続化する

// ── 型定義 ──────────────────────────────────────────────────────────────

export type VoiceCategory = "meeting" | "idea" | "memo" | "other";

export interface PersistentVoiceGroup {
  id: string;
  text: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  label: string;
  category: VoiceCategory;
  tags: string[];
  organizeResult?: string;
  summarizeResult?: string;
  chatReformatResult?: string;
}

// ── 定数 ──────────────────────────────────────────────────────────────

const STORE_KEY = "voice-recorder-groups";
const MAX_ENTRIES = 200;

// ── ヘルパー ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// ── ストア読み書き ──────────────────────────────────────────────────────

/** localStorageからグループ一覧を読み込む。存在しなければ空配列を返す */
export function loadVoiceGroups(): PersistentVoiceGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 最低限のバリデーション
    return parsed.filter(
      (g: unknown) =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as PersistentVoiceGroup).id === "string" &&
        typeof (g as PersistentVoiceGroup).text === "string",
    ) as PersistentVoiceGroup[];
  } catch {
    return [];
  }
}

/** グループ一覧をlocalStorageに保存 */
export function saveVoiceGroups(groups: PersistentVoiceGroup[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(groups));
  } catch (e) {
    // localStorage容量超過時: 古いエントリを削除して再試行
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const trimmed = groups.slice(-Math.floor(MAX_ENTRIES / 2));
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
      } catch {
        // それでも失敗した場合は諦める
      }
    }
  }
}

// ── グループ操作 ──────────────────────────────────────────────────────

/** グループを追加（MAX_ENTRIESを超えた場合は古いものを削除） */
export function addVoiceGroup(
  groups: PersistentVoiceGroup[],
  group: PersistentVoiceGroup,
): PersistentVoiceGroup[] {
  return [...groups, group].slice(-MAX_ENTRIES);
}

/** グループを部分更新 */
export function updateVoiceGroup(
  groups: PersistentVoiceGroup[],
  id: string,
  patch: Partial<Omit<PersistentVoiceGroup, "id" | "createdAt">>,
): PersistentVoiceGroup[] {
  return groups.map((g) =>
    g.id === id ? { ...g, ...patch, updatedAt: now() } : g,
  );
}

/** グループを削除 */
export function deleteVoiceGroup(
  groups: PersistentVoiceGroup[],
  id: string,
): PersistentVoiceGroup[] {
  return groups.filter((g) => g.id !== id);
}

/** グループをフィルタリング（カテゴリ・テキスト検索） */
export function filterVoiceGroups(
  groups: PersistentVoiceGroup[],
  opts: { category?: VoiceCategory; search?: string } = {},
): PersistentVoiceGroup[] {
  let result = [...groups];
  if (opts.category) {
    result = result.filter((g) => g.category === opts.category);
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.text.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  // 新しい順
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
