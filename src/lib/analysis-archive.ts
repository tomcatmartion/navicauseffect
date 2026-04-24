import { createHash } from "crypto";
import type { AnalysisCategory } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const CONFIG_KEY_VIP = "vip_analysis_categories";

/** 默认 VIP 模块（与后台未配置时一致） */
export const DEFAULT_VIP_CATEGORIES: string[] = [
  "MARRIAGE",
  "CAREER",
  "HEALTH",
  "PARENT_CHILD",
  "EMOTION",
];

/** 从 AdminConfig 读取 VIP 模块列表，未配置或空则返回默认列表 */
export async function getVipCategories(prisma: PrismaClient): Promise<string[]> {
  const row = await prisma.adminConfig.findUnique({
    where: { configKey: CONFIG_KEY_VIP },
  });
  const value = row?.configValue;
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((s): s is string => typeof s === "string");
  }
  return DEFAULT_VIP_CATEGORIES;
}

/** 命盘指纹：同一用户同一命盘唯一标识，用于存档查重 */
export function buildChartFingerprint(astrolabeData: Record<string, unknown>): string {
  const solar = String(astrolabeData.solarDate ?? "").trim();
  const lunar = String(astrolabeData.lunarDate ?? "").trim();
  const time = String(astrolabeData.time ?? "").trim();
  const gender = String(astrolabeData.gender ?? "FEMALE").trim();
  const raw = `${solar}|${lunar}|${time}|${gender}`;
  return createHash("sha256").update(raw).digest("hex");
}

/** 需要 VIP 或单次付费才能 AI 解读的业务模块（原「专项」现「VIP探真」）— 仅用于类型，实际列表从 getVipCategories 获取 */
export const VIP_CATEGORIES: AnalysisCategory[] = [
  "MARRIAGE",
  "CAREER",
  "HEALTH",
  "PARENT_CHILD",
  "EMOTION",
];

export function isVipCategory(category: AnalysisCategory, vipList: string[]): boolean {
  return vipList.includes(category);
}
