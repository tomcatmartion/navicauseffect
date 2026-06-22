import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type CreditPack = {
  id: string;
  count: number;
  price: number;
  label?: string;
  popular?: boolean;
};

type CoinPack = {
  id: string;
  amount: number;
  price: number;
  bonus: number;
  label?: string;
  popular?: boolean;
};

/** 安全解析 AdminConfig.configValue（可能是 JSON 对象或 JSON 字符串） */
function parseConfigValue<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * GET /api/pricing
 * 返回会员/按次/星币充值 3 大块的当前定价配置。
 * 公开接口（无需登录）—— 让访客也能看到价格。
 */
export async function GET() {
  const [membershipPricings, creditCfg, coinCfg] = await Promise.all([
    prisma.membershipPricing.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adminConfig.findUnique({ where: { configKey: "credit_packs" } }),
    prisma.adminConfig.findUnique({ where: { configKey: "coin_packs" } }),
  ]);

  // 同一 plan 可能有历史记录（旧 seed id 不同），按 plan 去重，保留最新（createdAt desc）
  const planOrder = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;
  const latestByPlan = new Map<string, (typeof membershipPricings)[number]>();
  for (const p of [...membershipPricings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (!latestByPlan.has(p.plan)) {
      latestByPlan.set(p.plan, p);
    }
  }
  const memberships = planOrder
    .map((plan) => latestByPlan.get(plan))
    .filter(Boolean)
    .map((p) => ({
      plan: p!.plan,
      originalPrice: Number(p!.originalPrice),
      activityPrice: p!.activityPrice ? Number(p!.activityPrice) : null,
    }));

  const creditPacks = parseConfigValue<CreditPack>(creditCfg?.configValue);
  const coinPacks = parseConfigValue<CoinPack>(coinCfg?.configValue);

  return NextResponse.json({
    memberships,
    creditPacks,
    coinPacks,
  });
}
