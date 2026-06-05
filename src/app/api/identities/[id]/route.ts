import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PUT /api/identities/[id] — 编辑命主
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, gender, birthday, birthCity, region, relation } = body

    // 验证归属
    const existing = await prisma.identity.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '命主不存在' }, { status: 404 })
    }

    const identity = await prisma.identity.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(gender !== undefined && { gender }),
        ...(birthday !== undefined && { birthday }),
        ...(birthCity !== undefined && { birthCity }),
        ...(region !== undefined && { region }),
        ...(relation !== undefined && { relation }),
      },
    })

    return NextResponse.json({ identity })
  } catch (error) {
    console.error('编辑命主失败:', error)
    return NextResponse.json(
      { error: '编辑命主失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/identities/[id] — 删除命主
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.identity.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '命主不存在' }, { status: 404 })
    }

    await prisma.identity.delete({ where: { id } })

    // 如果删除的是活跃命主，将第一个剩余命主设为活跃
    if (existing.isActive) {
      const first = await prisma.identity.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'asc' },
      })
      if (first) {
        await prisma.identity.update({
          where: { id: first.id },
          data: { isActive: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除命主失败:', error)
    return NextResponse.json(
      { error: '删除命主失败' },
      { status: 500 }
    )
  }
}
