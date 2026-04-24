import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { type, plan, channel } = await request.json();

    const priceMap: Record<string, number> = {
      PER_QUERY: 0.5,
      MONTHLY: 10,
      QUARTERLY: 25,
      YEARLY: 99,
    };

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

    // TODO: integrate with actual WeChat Pay / Alipay SDK
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
