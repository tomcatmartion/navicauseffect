import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/promoter/team?page=1&limit=20
 * 返回当前用户邀请的好友列表（推广团队）。
 *
 * 隐私保护：仅返回昵称首字 + ** + 注册时间 + 累计为推广人贡献的星币，
 * 不返回好友的真实昵称、手机号、邮箱等敏感信息。
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
    return NextResponse.json({ members: [], total: 0, page: 1, limit: 20 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  const [teamEntries, total] = await Promise.all([
    prisma.promoterTeam.findMany({
      where: { promoterId: promoterProfile.id },
      orderBy: { joinAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promoterTeam.count({
      where: { promoterId: promoterProfile.id },
    }),
  ]);

  if (teamEntries.length === 0) {
    return NextResponse.json({ members: [], total, page, limit });
  }

  // 单独查询成员用户信息（PromoterTeam 无 member 关系）
  const memberIds = teamEntries.map((t) => t.memberId);
  const [members, earnings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, nickname: true, username: true, createdAt: true },
    }),
    prisma.promoterEarning.groupBy({
      by: ["userId"],
      where: {
        promoterId: promoterProfile.id,
        userId: { in: memberIds },
      },
      _sum: { points: true },
    }),
  ]);

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const earningsMap = new Map(earnings.map((e) => [e.userId, e._sum.points ?? 0]));

  return NextResponse.json({
    members: teamEntries.map((entry) => {
      const member = memberMap.get(entry.memberId);
      const nickname = member?.nickname ?? member?.username ?? "用户";
      return {
        id: entry.memberId,
        // 仅展示昵称首字 + **，保护隐私
        displayName: nickname.length > 1 ? `${nickname.charAt(0)}**` : nickname,
        joinedAt: entry.joinAt.toISOString(),
        memberCreatedAt: member?.createdAt?.toISOString() ?? entry.joinAt.toISOString(),
        contributedPoints: earningsMap.get(entry.memberId) ?? 0,
      };
    }),
    total,
    page,
    limit,
  });
}
