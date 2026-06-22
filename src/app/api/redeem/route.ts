import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// POST /api/redeem — 兑换码兑换
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
    }
    const { code } = body as { code?: string }
    if (!code) {
      return NextResponse.json({ error: '请输入兑换码' }, { status: 400 })
    }

    // 查找兑换码
    const redeemCode = await prisma.redeemCode.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!redeemCode) {
      return NextResponse.json({ error: '兑换码不存在' }, { status: 404 })
    }

    if (!redeemCode.isActive) {
      return NextResponse.json({ error: '兑换码已失效' }, { status: 400 })
    }

    if (redeemCode.usedCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: '兑换码已用完' }, { status: 400 })
    }

    if (new Date() > redeemCode.expiresAt) {
      return NextResponse.json({ error: '兑换码已过期' }, { status: 400 })
    }

    // 检查用户是否已使用
    const existingUsage = await prisma.redeemUsage.findUnique({
      where: { userId_codeId: { userId: session.user.id, codeId: redeemCode.id } },
    })

    if (existingUsage) {
      return NextResponse.json({ error: '您已使用过此兑换码' }, { status: 400 })
    }

    // 事务：增加积分 + 记录 + 更新使用次数
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { totalPoints: { increment: redeemCode.pointValue } },
      }),
      prisma.pointRecord.create({
        data: {
          userId: session.user.id,
          points: redeemCode.pointValue,
          source: 'REDEEM',
          detail: `兑换码: ${redeemCode.code}`,
        },
      }),
      prisma.redeemUsage.create({
        data: {
          userId: session.user.id,
          codeId: redeemCode.id,
        },
      }),
      prisma.redeemCode.update({
        where: { id: redeemCode.id },
        data: { usedCount: { increment: 1 } },
      }),
    ])

    return NextResponse.json({
      success: true,
      points: redeemCode.pointValue,
      message: `兑换成功！获得 ${redeemCode.pointValue} 积分`,
    })
  } catch (error) {
    console.error('兑换失败:', error)
    return NextResponse.json({ error: '兑换失败' }, { status: 500 })
  }
}
