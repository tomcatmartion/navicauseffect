import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type CreditPack = { id: string; count: number; price: number; label?: string };
type CoinPack = { id: string; amount: number; price: number; bonus: number; label?: string };

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

async function fetchPackConfigs(): Promise<{ creditPacks: CreditPack[]; coinPacks: CoinPack[] }> {
  const [creditCfg, coinCfg] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { configKey: "credit_packs" } }),
    prisma.adminConfig.findUnique({ where: { configKey: "coin_packs" } }),
  ]);
  const creditPacks = parseConfigValue<CreditPack>(creditCfg?.configValue);
  const coinPacks = parseConfigValue<CoinPack>(coinCfg?.configValue);
  return { creditPacks, coinPacks };
}

async function fetchMembershipPrice(plan: string): Promise<number | null> {
  const pricing = await prisma.membershipPricing.findFirst({
    where: { plan: plan as "MONTHLY" | "QUARTERLY" | "YEARLY", isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!pricing) return null;
  return Number(pricing.activityPrice ?? pricing.originalPrice);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
    }
    const { type, plan, packId, channel } = body as {
      type?: string;
      plan?: string;
      packId?: string;
      channel?: string;
    };

    if (!type) {
      return NextResponse.json({ error: "缺少 type 参数" }, { status: 400 });
    }
    if (channel !== undefined && !["WECHAT", "ALIPAY"].includes(channel)) {
      return NextResponse.json({ error: "channel 必须为 WECHAT 或 ALIPAY" }, { status: 400 });
    }

    let amount = 0;
    let orderType: "MEMBERSHIP" | "PER_QUERY" | "COIN_PACK" | "CREDIT_PACK";
    let metadata: object = {};

    if (type === "MEMBERSHIP") {
      if (!plan || !["MONTHLY", "QUARTERLY", "YEARLY"].includes(plan)) {
        return NextResponse.json({ error: "无效的会员套餐" }, { status: 400 });
      }
      const price = await fetchMembershipPrice(plan);
      if (price === null || price <= 0) {
        return NextResponse.json({ error: "会员价格未配置" }, { status: 400 });
      }
      amount = price;
      orderType = "MEMBERSHIP";
      metadata = { plan };
    } else if (type === "PER_QUERY") {
      // 兼容旧接口：单次按次付费
      const perQueryPrice = Number(process.env.PRICE_PER_QUERY ?? 0.5);
      amount = perQueryPrice;
      orderType = "PER_QUERY";
      metadata = { count: 1 };
    } else if (type === "CREDIT_PACK") {
      if (!packId) {
        return NextResponse.json({ error: "缺少 packId" }, { status: 400 });
      }
      const { creditPacks } = await fetchPackConfigs();
      const pack = creditPacks.find((p) => p.id === packId);
      if (!pack) {
        return NextResponse.json({ error: "无效的按次套餐" }, { status: 400 });
      }
      amount = pack.price;
      orderType = "CREDIT_PACK";
      metadata = { packId: pack.id, count: pack.count };
    } else if (type === "COIN_PACK") {
      if (!packId) {
        return NextResponse.json({ error: "缺少 packId" }, { status: 400 });
      }
      const { coinPacks } = await fetchPackConfigs();
      const pack = coinPacks.find((p) => p.id === packId);
      if (!pack) {
        return NextResponse.json({ error: "无效的星币充值包" }, { status: 400 });
      }
      amount = pack.price;
      orderType = "COIN_PACK";
      metadata = { packId: pack.id, amount: pack.amount, bonus: pack.bonus };
    } else {
      return NextResponse.json({ error: "无效的支付类型" }, { status: 400 });
    }

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.user.id,
        type: orderType,
        amount,
        channel: (channel as "WECHAT" | "ALIPAY") || "WECHAT",
        status: "PENDING",
        metadata,
      },
    });

    const paymentEnabled = process.env.PAYMENT_ENABLED === "true";
    if (!paymentEnabled) {
      return NextResponse.json({
        orderId: order.id,
        amount,
        message: "支付功能开发中，当前为演示模式",
        mock: true,
      });
    }

    // TODO: 接入 WeChat Pay / Alipay SDK
    console.warn("[payment] Payment SDK not integrated yet");
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
