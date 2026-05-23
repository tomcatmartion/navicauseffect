import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function getPriceMap(): Record<string, number> {
  return {
    PER_QUERY: Number(process.env.PRICE_PER_QUERY ?? 0.5),
    MONTHLY: Number(process.env.PRICE_MONTHLY ?? 10),
    QUARTERLY: Number(process.env.PRICE_QUARTERLY ?? 25),
    YEARLY: Number(process.env.PRICE_YEARLY ?? 99),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { type, plan, channel } = await request.json();

    const priceMap = getPriceMap();

    const amount = type === "PER_QUERY" ? priceMap.PER_QUERY : priceMap[plan];
    if (!amount) {
      return NextResponse.json({ error: "无效的支付类型" }, { status: 400 });
    }

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.user.id,
        type: type === "PER_QUERY" ? "PER_QUERY" : "MEMBERSHIP",
        amount,
        channel: channel || "WECHAT",
        status: "PENDING",
        metadata: plan ? { plan } : undefined,
      },
    });

    const paymentEnabled = process.env.PAYMENT_ENABLED === 'true';
    if (!paymentEnabled) {
      return NextResponse.json({
        orderId: order.id,
        amount,
        message: "支付功能开发中，当前为演示模式",
        mock: true,
      });
    }

    // TODO: 接入 WeChat Pay / Alipay SDK
    console.warn('[payment] Payment SDK not integrated yet');
    return NextResponse.json({
      orderId: order.id,
      amount,
      message: "订单已创建，支付接口接入后将跳转支付页面",
    });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}
