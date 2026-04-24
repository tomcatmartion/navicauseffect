import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      membership: true,
      _count: {
        select: {
          consultationRecords: true,
          paymentOrders: true,
          shareRecords: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    totalPoints: user.totalPoints,
    bonusQueries: user.bonusQueries,
    inviteCode: user.inviteCode,
    createdAt: user.createdAt,
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
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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
    where: { id: session.user.id },
    data: { nickname: nickname.trim() },
  });

  return NextResponse.json({
    message: "更新成功",
    nickname: updated.nickname,
  });
}
