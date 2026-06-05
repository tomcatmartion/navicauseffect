import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// GET /api/promoter — 获取推广员信息
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const profile = await prisma.promoterProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        team: {
          orderBy: { joinAt: 'desc' },
        },
        _count: { select: { team: true, earnings: true } },
      },
    })

    if (!profile) {
      return NextResponse.json({ isPromoter: false })
    }

    // 近30天收益
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentEarnings = await prisma.promoterEarning.aggregate({
      where: {
        promoterId: profile.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { points: true },
    })

    return NextResponse.json({
      isPromoter: true,
      profile,
      recentEarnings: recentEarnings._sum.points || 0,
    })
  } catch (error) {
    console.error('获取推广信息失败:', error)
    return NextResponse.json({ error: '获取推广信息失败' }, { status: 500 })
  }
}
