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

  const body = await request.json();
  const { action } = body;

  if (action === "updatePerQueryPrice") {
    const { price } = body;
    await prisma.adminConfig.upsert({
      where: { configKey: "per_query_price" },
      update: { configValue: price },
      create: { configKey: "per_query_price", configValue: price },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "updatePlan") {
    const { id, originalPrice, activityPrice, isActive } = body;

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
      const created = await prisma.membershipPricing.create({
        data: {
          plan: body.plan,
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
