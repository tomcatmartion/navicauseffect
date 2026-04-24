import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const section = request.nextUrl.searchParams.get("section") || "overview";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  if (section === "overview") {
    const [
      totalUsers,
      todayNewUsers,
      premiumUsers,
      todayRevenue,
      todayCharts,
      todayAnalyses,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.membership.count({
        where: { plan: { not: "FREE" }, status: "ACTIVE" },
      }),
      prisma.paymentOrder.aggregate({
        where: { createdAt: { gte: today }, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.consultationRecord.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.aIAnalysis.count({
        where: { createdAt: { gte: today } },
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      todayNewUsers,
      premiumUsers,
      todayRevenue: todayRevenue._sum.amount?.toNumber() ?? 0,
      todayCharts,
      todayAnalyses,
    });
  }

  if (section === "users") {
    const [todayNew, weekActive, monthActive, totalUsers] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { updatedAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { updatedAt: { gte: monthAgo } } }),
      prisma.user.count(),
    ]);

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await prisma.user.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        count,
      });
    }

    return NextResponse.json({
      todayNew,
      weekActive,
      monthActive,
      totalUsers,
      trend: last7Days,
    });
  }

  if (section === "revenue") {
    const [todayRev, monthRev, wechatRev, alipayRev] = await Promise.all([
      prisma.paymentOrder.aggregate({
        where: { createdAt: { gte: today }, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.paymentOrder.aggregate({
        where: { createdAt: { gte: monthAgo }, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.paymentOrder.aggregate({
        where: { status: "PAID", channel: "WECHAT", createdAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
      prisma.paymentOrder.aggregate({
        where: { status: "PAID", channel: "ALIPAY", createdAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
    ]);

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const rev = await prisma.paymentOrder.aggregate({
        where: { createdAt: { gte: dayStart, lt: dayEnd }, status: "PAID" },
        _sum: { amount: true },
      });
      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        amount: rev._sum.amount?.toNumber() ?? 0,
      });
    }

    return NextResponse.json({
      todayRevenue: todayRev._sum.amount?.toNumber() ?? 0,
      monthRevenue: monthRev._sum.amount?.toNumber() ?? 0,
      wechatRevenue: wechatRev._sum.amount?.toNumber() ?? 0,
      alipayRevenue: alipayRev._sum.amount?.toNumber() ?? 0,
      trend: last7Days,
    });
  }

  if (section === "usage") {
    const categories = [
      "PERSONALITY", "FORTUNE", "MARRIAGE", "CAREER",
      "HEALTH", "PARENT_CHILD", "EMOTION",
    ] as const;

    const usageData = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.aIAnalysis.count({
          where: { category: cat },
        });
        return { category: cat, count };
      })
    );

    const totalCharts = await prisma.consultationRecord.count();

    return NextResponse.json({
      categories: usageData,
      totalCharts,
    });
  }

  if (section === "behavior") {
    const [totalVisitors, totalCharts, totalAnalyses, totalRegistered, totalPaid] =
      await Promise.all([
        prisma.user.count(),
        prisma.consultationRecord.count(),
        prisma.aIAnalysis.count(),
        prisma.user.count({ where: { phone: { not: null } } }),
        prisma.paymentOrder.count({ where: { status: "PAID" } }),
      ]);

    return NextResponse.json({
      funnel: [
        { step: "访问首页", count: totalVisitors + totalCharts },
        { step: "输入排盘信息", count: totalCharts },
        { step: "生成命盘", count: totalCharts },
        { step: "查看 AI 分析", count: totalAnalyses },
        { step: "注册登录", count: totalRegistered },
        { step: "付费转化", count: totalPaid },
      ],
    });
  }

  return NextResponse.json({ error: "未知 section" }, { status: 400 });
}
