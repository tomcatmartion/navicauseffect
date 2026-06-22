/**
 * POST /api/payment/wx-minipay
 *
 * 微信小程序支付签名端点。
 *
 * 流程：
 *   planId → 价格 → 创建 PaymentOrder → 微信统一下单 → 返回 wx.requestPayment 签名参数
 *
 * 响应字段（wx.requestPayment 所需）：
 *   { orderId, timeStamp, nonceStr, package, signType, paySign }
 *
 * mock 模式（默认）：WECHAT_PAY_* 凭证未配置时
 *   返回 fake 签名参数 + 真实 PaymentOrder（PENDING），
 *   前端 wx.requestPayment 会失败，但订单可走 /api/payment/mock 标记已支付完成履约测试
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractMiniprogramUser } from "@/lib/jwt-miniprogram";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { createUnifiedOrder, signPaymentParams, isWechatPayMockMode } from "@/lib/wechat-pay";

type PlanId = "monthly" | "quarterly" | "yearly" | "query";

interface PlanConfig {
  type: "MEMBERSHIP" | "PER_QUERY";
  plan?: string;
  amountYuan: number;
  description: string;
}

const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  monthly: { type: "MEMBERSHIP", plan: "MONTHLY", amountYuan: 10, description: "月度会员" },
  quarterly: { type: "MEMBERSHIP", plan: "QUARTERLY", amountYuan: 25, description: "季度会员" },
  yearly: { type: "MEMBERSHIP", plan: "YEARLY", amountYuan: 99, description: "年度会员" },
  query: { type: "PER_QUERY", amountYuan: 0.5, description: "单次解析加 1 次" },
};

export async function POST(request: NextRequest) {
  const mpUser = await extractMiniprogramUser(request.headers.get("authorization"));
  if (!mpUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 分钟级频率限制：5 次/分钟（防刷下单）
  const rl = await checkMinuteRateLimit(`wxpay:${mpUser.userId}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "下单过于频繁，请稍后再试", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const planId = (body as { planId?: string })?.planId as PlanId | undefined;
  if (!planId || !PLAN_CONFIG[planId]) {
    return NextResponse.json(
      {
        error: "无效的 planId",
        supported: Object.keys(PLAN_CONFIG),
      },
      { status: 400 },
    );
  }

  const config = PLAN_CONFIG[planId];

  // 1. 创建 PaymentOrder（金额单位：元）
  const order = await prisma.paymentOrder.create({
    data: {
      userId: mpUser.userId,
      type: config.type,
      amount: config.amountYuan,
      channel: "WECHAT",
      status: "PENDING",
      metadata: {
        planId,
        plan: config.plan,
        source: "miniprogram",
        openid: mpUser.openid,
        payMock: isWechatPayMockMode(),
      },
    },
  });

  // 2. 微信统一下单（真实/mock）
  // notifyUrl 兜底：环境变量缺失时使用默认值并告警一次
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
  if (!notifyUrl && !isWechatPayMockMode() && process.env.NODE_ENV === "production") {
    console.warn("[wx-minipay] WECHAT_PAY_NOTIFY_URL 未配置，微信回调将无法到达本服务");
  }
  let prepay_id: string;
  try {
    const result = await createUnifiedOrder({
      orderId: order.id,
      amount: Math.round(config.amountYuan * 100), // 元 → 分
      description: config.description,
      openid: mpUser.openid,
      notifyUrl,
    });
    prepay_id = result.prepay_id;
  } catch (err) {
    console.error("[wx-minipay] 统一下单失败:", err);
    // 把订单标记为 FAILED
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      {
        error: "微信统一下单失败",
        detail: err instanceof Error ? err.message : String(err),
        orderId: order.id,
        mockMode: isWechatPayMockMode(),
      },
      { status: 502 },
    );
  }

  // 3. 签名（生成 wx.requestPayment 所需参数）
  const sign = signPaymentParams(prepay_id);

  return NextResponse.json({
    orderId: order.id,
    amount: config.amountYuan,
    description: config.description,
    ...sign,
    mockMode: isWechatPayMockMode(),
  });
}
