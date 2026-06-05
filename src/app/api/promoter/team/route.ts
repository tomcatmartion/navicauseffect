import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// GET /api/promoter/team — 获取推广团队成员
export async function GET() {
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

    const team = await prisma.promoterTeam.findMany({
      where: { promoterId: profile.id },
      orderBy: { joinAt: 'desc' },
    })

    return NextResponse.json({ team })
  } catch (error) {
    console.error('获取团队失败:', error)
    return NextResponse.json({ error: '获取团队失败' }, { status: 500 })
  }
}
