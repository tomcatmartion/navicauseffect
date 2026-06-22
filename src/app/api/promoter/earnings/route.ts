import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/promoter/earnings?page=1&limit=20
 * 返回当前用户的推广收益流水（PromoterEarning）。
 *
 * eventType 取值：
 *   - REGISTER：好友注册奖励
 *   - PURCHASE：好友充值返点
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const promoterProfile = await prisma.promoterProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!promoterProfile) {
    return NextResponse.json({ earnings: [], total: 0, page: 1, limit: 20 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  const [earnings, total] = await Promise.all([
    prisma.promoterEarning.findMany({
      where: { promoterId: promoterProfile.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promoterEarning.count({
      where: { promoterId: promoterProfile.id },
    }),
  ]);

  return NextResponse.json({
    earnings: earnings.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      points: e.points,
      fromUserId: e.userId,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
}
