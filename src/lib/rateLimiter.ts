// モデル別の1日あたり使用回数制限
const DAILY_LIMITS: Record<string, number> = {
  'gpt-5.4-mini': 30,
  'gpt-5.4-nano': 50,
};

interface UsageRecord {
  count: number;
  date: string; // YYYY-MM-DD
}

// globalThis に乗せてルート間でマップを共有する
const g = globalThis as typeof globalThis & { __usageMap?: Map<string, UsageRecord> };
if (!g.__usageMap) g.__usageMap = new Map();
const usageMap = g.__usageMap;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * レート制限をチェックし、制限内であればカウントをインクリメントする。
 * @returns 制限超過時は { exceeded: true, limit, current } を返す
 */
export function checkAndIncrementRateLimit(modelId: string): {
  exceeded: boolean;
  limit: number;
  current: number;
} {
  const limit = DAILY_LIMITS[modelId];
  if (limit === undefined) {
    // 制限対象外のモデルはスルー
    return { exceeded: false, limit: 0, current: 0 };
  }

  const today = getTodayDate();
  const record = usageMap.get(modelId);

  let current = 0;
  if (record && record.date === today) {
    current = record.count;
  }

  if (current >= limit) {
    return { exceeded: true, limit, current };
  }

  usageMap.set(modelId, { count: current + 1, date: today });
  return { exceeded: false, limit, current: current + 1 };
}

/**
 * モデルの本日の使用状況を返す（カウントは増やさない）
 */
export function getUsageStatus(modelId: string): { count: number; limit: number; date: string } {
  const limit = DAILY_LIMITS[modelId] ?? 0;
  const today = getTodayDate();
  const record = usageMap.get(modelId);
  const count = record && record.date === today ? record.count : 0;
  return { count, limit, date: today };
}
