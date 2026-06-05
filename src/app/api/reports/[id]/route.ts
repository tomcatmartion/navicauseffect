import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/reports/[id] — 获取报告详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params

    const report = await prisma.report.findFirst({
      where: { id, userId: session.user.id },
      include: {
        template: true,
        identity: true,
        children: {
          include: { template: true },
          orderBy: { createdAt: 'asc' },
        },
        questions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('获取报告详情失败:', error)
    return NextResponse.json(
      { error: '获取报告详情失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/reports/[id] — 删除报告
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

    const report = await prisma.report.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 })
    }

    // 级联删除子报告和问答
    await prisma.report.deleteMany({
      where: { parentReportId: id },
    })

    await prisma.report.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除报告失败:', error)
    return NextResponse.json(
      { error: '删除报告失败' },
      { status: 500 }
    )
  }
}
