import type { PaymentOrder } from "@prisma/client";
import { prisma } from "@/lib/db";

export type FulfillOrderResult = {
  alreadyPaid: boolean;
  order: PaymentOrder;
};

/** 推广返点比例（好友充值金额的 10%） */
const PROMOTER_REBATE_RATE = 0.1;
/** 返点最少 1 星币 */
const MIN_REBATE = 1;

/**
 * 将订单置为已支付并履约（会员开通 / 加次 / 加星币）。
 * 已支付订单再次调用会直接返回，避免重复加次。
 *
 * 履约完成后，若该用户有推广人（被邀请注册），按订单金额 10% 返点给推广人。
 */
export async function fulfillPaymentOrder(
  orderId: string,
  transactionId: string
): Promise<FulfillOrderResult> {
  const existing = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!existing) {
    throw new Error("订单不存在");
  }

  if (existing.status === "PAID") {
    return { alreadyPaid: true, order: existing };
  }

  if (existing.status !== "PENDING") {
    throw new Error(`订单状态为 ${existing.status}，无法完成支付`);
  }

  const order = await prisma.paymentOrder.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      transactionId,
    },
  });

  // ── 按订单类型履约 ──────────────────────────────────────
  if (order.type === "MEMBERSHIP") {
    const metadata = order.metadata as { plan?: string } | null;
    const plan = metadata?.plan;
    const durationDays =
      plan === "MONTHLY" ? 30 : plan === "QUARTERLY" ? 90 : plan === "YEARLY" ? 365 : 0;

    if (durationDays > 0) {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + durationDays * 86400000);

      await prisma.membership.upsert({
        where: { userId: order.userId },
        update: {
          plan: plan as "MONTHLY" | "QUARTERLY" | "YEARLY",
          status: "ACTIVE",
          startDate,
          endDate,
          pricePaid: order.amount,
        },
        create: {
          userId: order.userId,
          plan: plan as "MONTHLY" | "QUARTERLY" | "YEARLY",
          status: "ACTIVE",
          startDate,
          endDate,
          pricePaid: order.amount,
        },
      });
    }
  } else if (order.type === "PER_QUERY") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: order.userId },
        data: { bonusQueries: { increment: 1 } },
      }),
      prisma.pointRecord.create({
        data: {
          userId: order.userId,
          points: -1,
          source: "CONSUME",
          detail: `按次付费订单履约（订单 ${order.id.slice(0, 8)}）`,
        },
      }),
    ]);
  } else if (order.type === "COIN_PACK") {
    // 星币充值包：增量 totalPoints（amount + bonus）
    const metadata = order.metadata as { amount?: number; bonus?: number; packId?: string } | null;
    const totalGain = (metadata?.amount ?? 0) + (metadata?.bonus ?? 0);
    if (totalGain > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: order.userId },
          data: { totalPoints: { increment: totalGain } },
        }),
        prisma.pointRecord.create({
          data: {
            userId: order.userId,
            points: totalGain,
            source: "COIN_PACK",
            detail: `星币充值包 ${metadata?.packId ?? ""}（${metadata?.amount ?? 0}+${metadata?.bonus ?? 0} 赠送）`,
          },
        }),
      ]);
    }
  } else if (order.type === "CREDIT_PACK") {
    // 按次付费套餐：增量 bonusQueries
    const metadata = order.metadata as { count?: number; packId?: string } | null;
    const count = metadata?.count ?? 0;
    if (count > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: order.userId },
          data: { bonusQueries: { increment: count } },
        }),
        prisma.pointRecord.create({
          data: {
            userId: order.userId,
            points: count,
            source: "CREDIT_PACK",
            detail: `按次付费套餐 ${metadata?.packId ?? ""}（+${count} 次）`,
          },
        }),
      ]);
    }
  }

  // ── 推广返点（好友付费给邀请人返 10%）──────────────────────
  await applyPromoterRebate(order);

  return { alreadyPaid: false, order };
}

/**
 * 推广返点逻辑：
 * 1. 通过 PromoterTeam 反查当前用户的推广人（promoterId）
 * 2. 若推广人存在且订单金额 > 0，按 10% 计算返点（最少 1）
 * 3. 给推广人加星币 + 流水 + PromoterEarning 记录
 */
async function applyPromoterRebate(order: PaymentOrder): Promise<void> {
  const amount = Number(order.amount);
  if (amount <= 0) return;

  // 反查推广人
  const teamEntry = await prisma.promoterTeam.findFirst({
    where: { memberId: order.userId },
    select: { promoterId: true },
  });
  if (!teamEntry) return;

  const promoterProfile = await prisma.promoterProfile.findUnique({
    where: { id: teamEntry.promoterId },
    select: { id: true, userId: true },
  });
  if (!promoterProfile) return;

  // 计算返点（向下取整，最少 1）
  const rebate = Math.max(MIN_REBATE, Math.floor(amount * PROMOTER_REBATE_RATE));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: promoterProfile.userId },
      data: { totalPoints: { increment: rebate } },
    }),
    prisma.pointRecord.create({
      data: {
        userId: promoterProfile.userId,
        points: rebate,
        source: "PURCHASE_REBATE",
        detail: `好友充值返点 ¥${amount.toFixed(2)}（订单 ${order.id.slice(0, 8)}）`,
      },
    }),
    prisma.promoterEarning.create({
      data: {
        promoterId: promoterProfile.id,
        userId: order.userId,
        eventType: "PURCHASE",
        points: rebate,
      },
    }),
    prisma.promoterProfile.update({
      where: { id: promoterProfile.id },
      data: { totalEarned: { increment: rebate } },
    }),
  ]);
}
