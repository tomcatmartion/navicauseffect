import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const [pricingList, perQueryConfig] = await Promise.all([
    prisma.membershipPricing.findMany({
      orderBy: { plan: "asc" },
    }),
    prisma.adminConfig.findUnique({
      where: { configKey: "per_query_price" },
    }),
  ]);

  return NextResponse.json({
    pricing: pricingList,
    perQueryPrice: perQueryConfig?.configValue ?? 0.5,
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  const { action } = body as { action?: string };

  if (action === "updatePerQueryPrice") {
    const { price } = body as { price?: number };
    if (typeof price !== "number" || price < 0 || !Number.isFinite(price)) {
      return NextResponse.json({ error: "price 必须为非负数字" }, { status: 400 });
    }
    await prisma.adminConfig.upsert({
      where: { configKey: "per_query_price" },
      update: { configValue: price },
      create: { configKey: "per_query_price", configValue: price },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "updatePlan") {
    const { id, originalPrice, activityPrice, isActive, plan } = body as {
      id?: string;
      originalPrice?: number;
      activityPrice?: number | null;
      isActive?: boolean;
      plan?: string;
    };
    if (typeof originalPrice !== "number" || originalPrice < 0) {
      return NextResponse.json({ error: "originalPrice 必须为非负数字" }, { status: 400 });
    }
    if (activityPrice !== null && activityPrice !== undefined && (typeof activityPrice !== "number" || activityPrice < 0)) {
      return NextResponse.json({ error: "activityPrice 必须为非负数字或 null" }, { status: 400 });
    }

    if (id) {
      const updated = await prisma.membershipPricing.update({
        where: { id },
        data: {
          originalPrice,
          activityPrice: activityPrice ?? null,
          isActive,
        },
      });
      return NextResponse.json(updated);
    } else {
      if (!plan || !["MONTHLY", "QUARTERLY", "YEARLY"].includes(plan)) {
        return NextResponse.json({ error: "plan 必须为 MONTHLY/QUARTERLY/YEARLY" }, { status: 400 });
      }
      const created = await prisma.membershipPricing.create({
        data: {
          plan: plan as "MONTHLY" | "QUARTERLY" | "YEARLY",
          originalPrice,
          activityPrice: activityPrice ?? null,
          isActive: isActive ?? true,
        },
      });
      return NextResponse.json(created);
    }
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
