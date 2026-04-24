import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fulfillPaymentOrder } from "@/lib/payment/fulfill-order";
import { isMockPaymentEnabled } from "@/lib/payment/mock-env";

function forbidden() {
  return NextResponse.json(
    { error: "模拟支付未启用（需 NODE_ENV=development 或设置 ENABLE_MOCK_PAYMENT=true）" },
    { status: 403 }
  );
}

/** 列出当前用户待支付订单（仅模拟支付开启时） */
export async function GET() {
  if (!isMockPaymentEnabled()) return forbidden();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const orders = await prisma.paymentOrder.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      type: o.type,
      amount: Number(o.amount),
      channel: o.channel,
      metadata: o.metadata,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

/** 模拟将订单标记为已支付并完成履约 */
export async function POST(request: Request) {
  if (!isMockPaymentEnabled()) return forbidden();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "缺少 orderId" }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findFirst({
    where: { id: orderId, userId: session.user.id },
  });

  if (!order) {
    return NextResponse.json({ error: "订单不存在或无权操作" }, { status: 404 });
  }

  try {
    const txId = `MOCK_${Date.now()}_${orderId.slice(0, 8)}`;
    const result = await fulfillPaymentOrder(orderId, txId);
    return NextResponse.json({
      success: true,
      alreadyPaid: result.alreadyPaid,
      transactionId: txId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "履约失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
