"use client";

import { useState, useMemo, useCallback } from "react";
import {
  XMarkIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  DocumentTextIcon,
  ClockIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import type {
  RecordSession,
  RecordStore,
  SessionCategory,
} from "@/lib/recordStore";
import {
  createEmptySession,
  addSession,
  deleteSession,
  switchSession,
  filterSessions,
  getPatientTags,
} from "@/lib/recordStore";

// ── カテゴリ定義 ────────────────────────────────────────────────────────

const CATEGORY_META: Record<SessionCategory, { label: string; color: string }> = {
  medical: { label: "診療", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  daily:   { label: "日常", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  memo:    { label: "メモ", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

// ── Props ────────────────────────────────────────────────────────────────

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  store: RecordStore;
  onStoreChange: (store: RecordStore) => void;
  /** 現在のセッションデータを保存してからセッション切り替えする際に呼ばれる */
  onBeforeSwitch?: () => void;
}

// ── コンポーネント ──────────────────────────────────────────────────────

export default function SessionDrawer({
  open,
  onClose,
  store,
  onStoreChange,
  onBeforeSwitch,
}: SessionDrawerProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<SessionCategory | "">("");
  const [filterTag, setFilterTag] = useState("");
  const [newCategory, setNewCategory] = useState<SessionCategory>("medical");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // フィルタ済みセッション
  const sessions = useMemo(
    () =>
      filterSessions(store, {
        category: filterCategory || undefined,
        patientTag: filterTag || undefined,
        search: search || undefined,
      }),
    [store, filterCategory, filterTag, search],
  );

  const patientTags = useMemo(() => getPatientTags(store), [store]);

  // ── ハンドラ ──────────────────────────────────────────────────────────

  const handleNewSession = useCallback(() => {
    onBeforeSwitch?.();
    const session = createEmptySession(newCategory);
    onStoreChange(addSession(store, session));
  }, [store, newCategory, onStoreChange, onBeforeSwitch]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      if (id === store.activeSessionId) return;
      onBeforeSwitch?.();
      onStoreChange(switchSession(store, id));
      onClose();
    },
    [store, onStoreChange, onBeforeSwitch, onClose],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      // アクティブセッション削除時は未保存の変更を先に保存
      if (id === store.activeSessionId) {
        onBeforeSwitch?.();
      }
      onStoreChange(deleteSession(store, id));
      setDeletingId(null);
    },
    [store, onStoreChange, onBeforeSwitch],
  );

  // 時刻フォーマット
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}時間前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}日前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // セッションのプレビューテキスト
  const preview = (s: RecordSession) => {
    if (s.soapNote?.summary) return s.soapNote.summary;
    if (s.transcript) return s.transcript.slice(0, 80) + (s.transcript.length > 80 ? "…" : "");
    return "記録なし";
  };

  if (!open) return null;

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ドロワー */}
      <aside
        className="fixed inset-y-0 left-0 z-[61] w-full max-w-sm bg-theme-bg border-r border-theme-border shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-label="セッション管理"
      >
        {/* ── ヘッダー ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border shrink-0">
          <h2 className="text-base font-bold text-theme-primary">記録セッション</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-theme-tertiary hover:bg-theme-card transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── 新規セッション ── */}
        <div className="px-4 py-3 border-b border-theme-border space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            {(Object.entries(CATEGORY_META) as [SessionCategory, { label: string; color: string }][]).map(
              ([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setNewCategory(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    newCategory === key
                      ? meta.color
                      : "text-theme-tertiary border border-theme-border hover:bg-theme-card"
                  }`}
                >
                  {meta.label}
                </button>
              ),
            )}
            <button
              onClick={handleNewSession}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              新規
            </button>
          </div>
        </div>

        {/* ── 検索・フィルタ ── */}
        <div className="px-4 py-2 border-b border-theme-border space-y-2 shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ラベル・患者タグ・内容で検索…"
              className="w-full rounded-lg border border-theme-border bg-theme-card pl-8 pr-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          {patientTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TagIcon className="w-3.5 h-3.5 text-theme-tertiary shrink-0" />
              <button
                onClick={() => setFilterTag("")}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  !filterTag ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : "text-theme-tertiary hover:bg-theme-card"
                }`}
              >
                すべて
              </button>
              {patientTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    filterTag === tag
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                      : "text-theme-tertiary hover:bg-theme-card"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterCategory("")}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                !filterCategory ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : "text-theme-tertiary hover:bg-theme-card"
              }`}
            >
              すべて
            </button>
            {(Object.entries(CATEGORY_META) as [SessionCategory, { label: string; color: string }][]).map(
              ([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setFilterCategory(filterCategory === key ? "" : key)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    filterCategory === key ? meta.color : "text-theme-tertiary hover:bg-theme-card"
                  }`}
                >
                  {meta.label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* ── セッション一覧 ── */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-theme-tertiary">
              <DocumentTextIcon className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">記録がありません</p>
              <p className="text-xs mt-1">「新規」ボタンで記録を開始</p>
            </div>
          ) : (
            <ul className="divide-y divide-theme-border">
              {sessions.map((s) => {
                const isActive = s.id === store.activeSessionId;
                const catMeta = CATEGORY_META[s.category];
                return (
                  <li key={s.id} className="relative">
                    <button
                      onClick={() => handleSwitchSession(s.id)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                        isActive
                          ? "bg-teal-50/60 dark:bg-teal-900/20 border-l-[3px] border-l-teal-500"
                          : "hover:bg-theme-card border-l-[3px] border-l-transparent"
                      }`}
                    >
                      {/* 上段: ラベル + カテゴリ + 時刻 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                        {s.patientTag && (
                          <span className="text-[10px] text-theme-tertiary bg-theme-card px-1.5 py-0.5 rounded">
                            {s.patientTag}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1 text-[11px] text-theme-tertiary shrink-0">
                          <ClockIcon className="w-3 h-3" />
                          {fmtTime(s.updatedAt)}
                        </span>
                      </div>

                      {/* ラベル */}
                      <div className="text-sm font-medium text-theme-primary truncate">
                        {s.label || "無題の記録"}
                      </div>

                      {/* プレビュー */}
                      <div className="text-xs text-theme-tertiary truncate mt-0.5">
                        {preview(s)}
                      </div>

                      {/* ステータスバッジ */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {s.soapNote && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                            SOAP済
                          </span>
                        )}
                        {s.chatHistory.length > 0 && (
                          <span className="text-[10px] text-theme-tertiary">
                            チャット{s.chatHistory.length}件
                          </span>
                        )}
                        {s.transcript && !s.soapNote && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                            未分析
                          </span>
                        )}
                      </div>
                    </button>

                    {/* 削除ボタン */}
                    {deletingId === s.id ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s.id);
                          }}
                          className="px-2 py-1 text-[11px] rounded bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          削除
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-theme-border text-theme-tertiary hover:bg-theme-card transition-colors cursor-pointer"
                        >
                          戻す
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(s.id);
                        }}
                        className="absolute right-3 top-3 w-6 h-6 flex items-center justify-center rounded text-theme-tertiary hover:text-red-500 opacity-0 hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                        title="削除"
                        aria-label={`「${s.label || "無題の記録"}」を削除`}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── フッター ── */}
        <div className="px-4 py-2 border-t border-theme-border text-[11px] text-theme-tertiary text-center shrink-0">
          {store.sessions.length} 件の記録 · localStorage 保存
        </div>
      </aside>
    </>
  );
}
