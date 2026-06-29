/**
 * 统一权益消耗 API
 *
 * 业务 API(reports/reading/compatibility/ai-personality-analysis)共用此函数,
 * 替代各自实现的"会员判断 + 折扣 + 扣费"散落逻辑。
 *
 * 优先级(从高到低,先命中先用):
 *   1. MEMBERSHIP  会员免费(memberFree=true 且 membershipPlan !== FREE 且未过期)
 *   2. BONUS_QUERY 按次付费(bonusQueries > 0 且 baseCost > 0,扣 1 次)
 *   3. POINTS      星币付费(totalPoints >= actualCost,扣 actualCost + PointRecord)
 *   4. FREE_QUOTA  免费额度(baseCost = 0 时,通过日限流控制)
 *
 * 两种业务模式:
 *   - baseCost = 0 + memberFree(默认 true):
 *       会员免费,非会员走免费额度(READING / ANALYSIS / COMPATIBILITY)
 *   - baseCost > 0 + memberFree = false:
 *       会员折扣后扣星币,非会员全额扣星币,星币不足返回 INSUFFICIENT_FUNDS(REPORT)
 *
 * 事务性:POINTS 扣减在 prisma.$transaction 内,失败回滚。
 *
 * 错误码:INSUFFICIENT_FUNDS / DAILY_LIMIT_EXCEEDED / MEMBERSHIP_EXPIRED
 */

import { prisma } from "@/lib/db";
import { checkDailyLimit, incrementDailyUsage } from "@/lib/rate-limit";

export type ResourceType =
  | "REPORT"
  | "READING"
  | "COMPATIBILITY"
  | "ANALYSIS";

export type ConsumeSource = "MEMBERSHIP" | "BONUS_QUERY" | "POINTS" | "FREE_QUOTA";

export type ConsumeError =
  | "INSUFFICIENT_FUNDS"
  | "DAILY_LIMIT_EXCEEDED"
  | "MEMBERSHIP_EXPIRED"
  | "USER_NOT_FOUND";

export type ConsumeResult =
  | { ok: true; source: ConsumeSource; cost: number; remaining?: { points?: number; bonusQueries?: number } }
  | { ok: false; error: ConsumeError };

export type ConsumeOptions = {
  userId: string;
  ip: string;
  resourceType: ResourceType;
  /** 星币原价。0 表示不扣星币,走免费额度模式 */
  baseCost: number;
  /**
   * 会员是否完全免费
   * - true(默认):会员直接放行,不扣任何东西
   * - false:会员享受折扣(YEARLY 7折/QUARTERLY 8折/MONTHLY 9折)但仍扣星币
   */
  memberFree?: boolean;
};

/** 会员折扣表 */
const MEMBERSHIP_DISCOUNT: Record<string, number> = {
  YEARLY: 0.7,
  QUARTERLY: 0.8,
  MONTHLY: 0.9,
};

/** 判断会员是否有效(非 FREE 且未过期) */
function isMembershipActive(plan: string | null | undefined, endDate: Date | null | undefined): boolean {
  if (!plan || plan === "FREE") return false;
  if (!endDate) return true; // 无结束时间视为永久(向后兼容老数据)
  return new Date(endDate) > new Date();
}

/** 应用会员折扣,返回实际扣费 */
function applyMemberDiscount(baseCost: number, plan: string): number {
  const rate = MEMBERSHIP_DISCOUNT[plan];
  if (!rate) return baseCost;
  return Math.ceil(baseCost * rate);
}

/**
 * 统一权益消耗(主入口)
 *
 * 用法:
 *   const result = await consumeRights({
 *     userId: session.user.id,
 *     ip: getClientIp(req),
 *     resourceType: "READING",
 *     baseCost: 0, // 免费额度模式
 *   });
 *   if (!result.ok) {
 *     return NextResponse.json({ error: result.error }, { status: 402 });
 *   }
 *   // result.source 可用于日志/反馈给前端
 */
export async function consumeRights(opts: ConsumeOptions): Promise<ConsumeResult> {
  const { userId, ip, resourceType, baseCost } = opts;
  const memberFree = opts.memberFree ?? true;

  // 1. 查用户(含会员)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { membership: true },
  });
  if (!user) {
    return { ok: false, error: "USER_NOT_FOUND" };
  }

  const plan = user.membership?.plan ?? "FREE";
  const membershipActive = isMembershipActive(plan, user.membership?.endDate);

  // 2. 会员免费(memberFree = true 时)
  if (membershipActive && memberFree) {
    return { ok: true, source: "MEMBERSHIP", cost: 0 };
  }

  // 3. baseCost > 0 的扣费逻辑(会员折扣 / POINTS / BONUS_QUERY)
  if (baseCost > 0) {
    // 会员折扣后实际扣费(仅 memberFree = false 场景)
    const actualCost = membershipActive
      ? applyMemberDiscount(baseCost, plan)
      : baseCost;

    // 3a. BONUS_QUERY 优先(按次付费)
    if (user.bonusQueries > 0) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { bonusQueries: { decrement: 1 } },
        select: { bonusQueries: true, totalPoints: true },
      });
      return {
        ok: true,
        source: "BONUS_QUERY",
        cost: 1,
        remaining: {
          bonusQueries: updated.bonusQueries,
          points: updated.totalPoints,
        },
      };
    }

    // 3b. POINTS(星币付费)
    if (user.totalPoints >= actualCost) {
      const [updated] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { totalPoints: { decrement: actualCost } },
          select: { totalPoints: true, bonusQueries: true },
        }),
        prisma.pointRecord.create({
          data: {
            userId,
            points: -actualCost,
            source: "CONSUME",
            detail: `${resourceType} 消耗${membershipActive ? `(${getDiscountLabel(plan)})` : ""}`,
          },
        }),
      ]);
      return {
        ok: true,
        source: "POINTS",
        cost: actualCost,
        remaining: {
          points: updated.totalPoints,
          bonusQueries: updated.bonusQueries,
        },
      };
    }

    // 3c. 星币不足
    return { ok: false, error: "INSUFFICIENT_FUNDS" };
  }

  // 4. baseCost = 0 的免费额度逻辑(走日限流)
  //    会员理论上在步骤 2 已返回,这里只有非会员或过期会员
  const limitResult = await checkDailyLimit(userId, ip, plan);
  if (!limitResult.allowed) {
    return { ok: false, error: "DAILY_LIMIT_EXCEEDED" };
  }
  await incrementDailyUsage(userId, ip);
  return {
    ok: true,
    source: "FREE_QUOTA",
    cost: 0,
    remaining: { points: user.totalPoints, bonusQueries: user.bonusQueries },
  };
}

function getDiscountLabel(plan: string): string {
  if (plan === "YEARLY") return "年度7折";
  if (plan === "QUARTERLY") return "季度8折";
  if (plan === "MONTHLY") return "月度9折";
  return "";
}

/**
 * 把 ConsumeResult 的错误码转换为 HTTP 状态 + 标准化响应
 *
 * 业务 API 调用方式:
 *   const result = await consumeRights({...});
 *   if (!result.ok) {
 *     return consumeErrorToResponse(result.error);
 *   }
 */
export function consumeErrorToResponse(error: ConsumeError): {
  status: number;
  body: { error: ConsumeError; message: string };
} {
  switch (error) {
    case "INSUFFICIENT_FUNDS":
      return {
        status: 402,
        body: {
          error: "INSUFFICIENT_FUNDS",
          message: "星币不足,请充值或升级会员",
        },
      };
    case "DAILY_LIMIT_EXCEEDED":
      return {
        status: 429,
        body: {
          error: "DAILY_LIMIT_EXCEEDED",
          message: "今日免费额度已用完,升级会员无限使用",
        },
      };
    case "MEMBERSHIP_EXPIRED":
      return {
        status: 403,
        body: {
          error: "MEMBERSHIP_EXPIRED",
          message: "会员已过期,请续费",
        },
      };
    case "USER_NOT_FOUND":
      return {
        status: 401,
        body: {
          error: "USER_NOT_FOUND",
          message: "用户不存在,请重新登录",
        },
      };
  }
}
