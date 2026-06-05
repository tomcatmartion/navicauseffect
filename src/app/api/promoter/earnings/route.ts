import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// GET /api/promoter/earnings — 获取推广收益记录
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const profile = await prisma.promoterProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: '非推广员' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const [earnings, total] = await Promise.all([
      prisma.promoterEarning.findMany({
        where: { promoterId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.promoterEarning.count({
        where: { promoterId: profile.id },
      }),
    ])

    return NextResponse.json({ earnings, total, page, limit })
  } catch (error) {
    console.error('获取收益记录失败:', error)
    return NextResponse.json({ error: '获取收益记录失败' }, { status: 500 })
  }
}
