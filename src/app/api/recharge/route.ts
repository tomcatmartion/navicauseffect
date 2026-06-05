import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// GET /api/recharge — 获取充值记录
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const [records, total] = await Promise.all([
      prisma.pointRecord.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pointRecord.count({
        where: { userId: session.user.id },
      }),
    ])

    return NextResponse.json({ records, total, page, limit })
  } catch (error) {
    console.error('获取充值记录失败:', error)
    return NextResponse.json({ error: '获取充值记录失败' }, { status: 500 })
  }
}

// POST /api/recharge — 充值积分（模拟）
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { points, channel } = await req.json()
    if (!points || points <= 0) {
      return NextResponse.json({ error: '无效的充值金额' }, { status: 400 })
    }

    // 模拟充值：直接增加积分
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { totalPoints: { increment: points } },
      }),
      prisma.pointRecord.create({
        data: {
          userId: session.user.id,
          points,
          source: 'RECHARGE',
          detail: `充值 ${points} 积分${channel ? ` (${channel})` : ''}`,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      points,
      message: `充值成功！获得 ${points} 积分`,
    })
  } catch (error) {
    console.error('充值失败:', error)
    return NextResponse.json({ error: '充值失败' }, { status: 500 })
  }
}
