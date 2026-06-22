import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { extractMiniprogramUser } from "@/lib/jwt-miniprogram";

/**
 * 统一身份解析：同时支持
 *   1. NextAuth session（H5/Web 端 httpOnly cookie）
 *   2. 小程序 Bearer JWT（Authorization: Bearer xxx）
 *
 * 返回 userId 或 null
 */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1. 优先用 NextAuth session
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  // 2. fallback 到小程序 Bearer JWT
  const authHeader = request.headers.get("authorization");
  const mpUser = await extractMiniprogramUser(authHeader);
  if (mpUser?.userId) return mpUser.userId;

  return null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      membership: true,
      _count: {
        select: {
          consultationRecords: true,
          paymentOrders: true,
          shareRecords: true,
          identities: true,
          reports: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // ChartRecord 通过 userId 关联，但 User 模型未声明反向关系，单独 count
  const chartCount = await prisma.chartRecord.count({ where: { userId } });

  return NextResponse.json({
    id: user.id,
    // name 字段：小程序前端期望，优先 nickname → username → 默认值
    name: user.nickname || user.username || "用户",
    nickname: user.nickname,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    totalPoints: user.totalPoints,
    bonusQueries: user.bonusQueries,
    inviteCode: user.inviteCode,
    createdAt: user.createdAt,
    // chartCount: 小程序 profile.tsx 直接消费的别名
    chartCount,
    membership: user.membership
      ? {
          plan: user.membership.plan,
          status: user.membership.status,
          startDate: user.membership.startDate,
          endDate: user.membership.endDate,
        }
      : null,
    stats: {
      consultations: user._count.consultationRecords,
      orders: user._count.paymentOrders,
      shares: user._count.shareRecords,
      charts: chartCount,
      identities: user._count.identities,
      reports: user._count.reports,
    },
  });
}

export async function PUT(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { nickname } = await request.json();

  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });
  }

  if (nickname.length > 20) {
    return NextResponse.json({ error: "昵称不能超过20个字符" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { nickname: nickname.trim() },
  });

  return NextResponse.json({
    message: "更新成功",
    nickname: updated.nickname,
  });
}
