/**
 * S-06：「最近访问」命盘 localStorage 工具
 *
 * - 最多保留 10 条
 * - 7 天过期（超过自动清除）
 * - 同一 chartId 多次访问只保留最新一条（提到队首）
 *
 * 使用位置：
 *  - 写入：charts/[id]/page.tsx mount 时
 *  - 读取：(main)/page.tsx 已登录态「最近访问」区
 */

const STORAGE_KEY = "zw-recent-charts";
const MAX_ITEMS = 10;
const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export interface RecentChart {
  id: string;
  name: string;
  identityName?: string;
  visitedAt: number; // unix ms
}

type StoredRecentChart = RecentChart; // 同结构

function isFresh(item: StoredRecentChart, now: number): boolean {
  return now - item.visitedAt < EXPIRE_MS;
}

/** 读取最近访问列表（已自动过滤过期项 + 同步清理） */
export function getRecentCharts(): RecentChart[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRecentChart[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const fresh = parsed.filter((item) => isFresh(item, now));
    if (fresh.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    return fresh.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/** 新增 / 更新一条访问记录 */
export function addRecentChart(input: Omit<RecentChart, "visitedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentCharts();
    const filtered = current.filter((item) => item.id !== input.id);
    const next: RecentChart = {
      ...input,
      visitedAt: Date.now(),
    };
    const updated = [next, ...filtered].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage 满或禁用时静默失败
  }
}

/** 清空（用于设置页"清除访问历史"） */
export function clearRecentCharts(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
