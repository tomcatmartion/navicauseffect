import { NextRequest, NextResponse } from "next/server";
import { fulfillPaymentOrder } from "@/lib/payment/fulfill-order";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const paymentEnabled = process.env.PAYMENT_ENABLED === 'true';
    if (!paymentEnabled) {
      console.warn('[payment-callback] Payment not enabled, skipping callback processing');
      return NextResponse.json({ success: true, mock: true });
    }

    // TODO: 接入 WeChat Pay / Alipay 回调签名验证
    console.warn('[payment-callback] Signature verification not implemented yet');

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
