import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/identities/[id]/activate — 设为活跃命主
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params

    // 验证归属
    const identity = await prisma.identity.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!identity) {
      return NextResponse.json({ error: '命主不存在' }, { status: 404 })
    }

    // 事务：取消所有活跃 + 设置新活跃
    await prisma.$transaction([
      prisma.identity.updateMany({
        where: { userId: session.user.id, isActive: true },
        data: { isActive: false },
      }),
      prisma.identity.update({
        where: { id },
        data: { isActive: true },
      }),
    ])

    return NextResponse.json({ success: true, identity: { ...identity, isActive: true } })
  } catch (error) {
    console.error('设置活跃命主失败:', error)
    return NextResponse.json(
      { error: '设置活跃命主失败' },
      { status: 500 }
    )
  }
}
