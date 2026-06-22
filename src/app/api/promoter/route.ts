import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/promoter
 * 返回当前用户的推广统计：
 *   - 总分享次数（ShareRecord count）
 *   - 总点击（ShareRecord.clicks 求和）
 *   - 注册转化（PromoterTeam 成员数）
 *   - 已得星币（PromoterEarning points 求和）
 *   - 邀请码 + 推广员档案（如有）
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const [shareRecords, promoterProfile, pointStats] = await Promise.all([
    prisma.shareRecord.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { clicks: true, rewardPoints: true },
    }),
    prisma.promoterProfile.findUnique({
      where: { userId },
      include: {
        _count: { select: { team: true, earnings: true } },
      },
    }),
    prisma.pointRecord.aggregate({
      where: {
        userId,
        source: { in: ["SHARE", "INVITE", "PURCHASE_REBATE"] },
      },
      _sum: { points: true },
    }),
  ]);

  const teamCount = promoterProfile?._count.team ?? 0;
  const totalEarned = promoterProfile?.totalEarned ?? 0;
  const shareCount = shareRecords._count.id;
  const totalClicks = shareRecords._sum.clicks ?? 0;
  const shareReward = shareRecords._sum.rewardPoints ?? 0;
  const totalRewardPoints = pointStats._sum.points ?? 0;

  // 用户基础邀请码
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true, totalPoints: true },
  });

  return NextResponse.json({
    inviteCode: user?.inviteCode ?? "",
    totalPoints: user?.totalPoints ?? 0,
    stats: {
      shareCount,
      totalClicks,
      teamCount,
      shareReward,
      totalEarned,
      totalRewardPoints,
    },
    promoterProfile: promoterProfile
      ? {
          id: promoterProfile.id,
          level: promoterProfile.level,
          isActive: promoterProfile.isActive,
          createdAt: promoterProfile.createdAt,
        }
      : null,
  });
}
