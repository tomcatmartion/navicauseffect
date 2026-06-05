import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 星币统计
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = session.user.id;

  // 一次性聚合各来源的总和
  const records = await prisma.pointRecord.findMany({
    where: { userId },
    select: { points: true, source: true },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  // 按来源分类的收入
  const bySource: Record<string, number> = {};

  for (const r of records) {
    if (r.points > 0) {
      totalIncome += r.points;
      bySource[r.source] = (bySource[r.source] || 0) + r.points;
    } else {
      totalExpense += Math.abs(r.points);
    }
  }

  // 当前余额
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalPoints: true },
  });

  return NextResponse.json({
    data: {
      balance: user?.totalPoints ?? 0,
      totalIncome,
      totalExpense,
      bySource,
    },
  });
}
