import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 星币流水 — 分页
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const perPage = Math.min(50, Math.max(1, Number(searchParams.get("per_page") || 20)));

  const [records, total] = await Promise.all([
    prisma.pointRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.pointRecord.count({ where: { userId: session.user.id } }),
  ]);

  // 源类型中文映射
  const sourceLabel: Record<string, string> = {
    SHARE: "分享奖励",
    ADMIN_GRANT: "系统赠送",
    REDEEM: "兑换码",
    INVITE: "邀请奖励",
    RECHARGE: "充值",
    CONSUME: "报告消费",
  };

  return NextResponse.json({
    data: records.map((r: { id: string; points: number; source: string; detail: string | null; createdAt: Date }) => ({
      id: r.id,
      type: r.points > 0 ? "income" : "expense",
      amount: r.points,
      source: r.source,
      sourceLabel: sourceLabel[r.source] || r.source,
      detail: r.detail,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}
