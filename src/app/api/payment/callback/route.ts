import { NextRequest, NextResponse } from "next/server";
import { fulfillPaymentOrder } from "@/lib/payment/fulfill-order";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    // TODO: verify WeChat Pay / Alipay callback signature

    const { orderId, transactionId } = JSON.parse(body) as {
      orderId?: string;
      transactionId?: string;
    };

    if (!orderId || !transactionId) {
      return NextResponse.json({ error: "缺少 orderId 或 transactionId" }, { status: 400 });
    }

    await fulfillPaymentOrder(orderId, transactionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payment callback error:", error);
    const message = error instanceof Error ? error.message : "处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
