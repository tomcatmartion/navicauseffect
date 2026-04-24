import type { PaymentOrder } from "@prisma/client";
import { prisma } from "@/lib/db";

export type FulfillOrderResult = {
  alreadyPaid: boolean;
  order: PaymentOrder;
};

/**
 * 将订单置为已支付并履约（会员开通 / 加次）。
 * 已支付订单再次调用会直接返回，避免重复加次。
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
    await prisma.user.update({
      where: { id: order.userId },
      data: { bonusQueries: { increment: 1 } },
    });
  }

  return { alreadyPaid: false, order };
}
