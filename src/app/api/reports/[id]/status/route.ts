import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/reports/[id]/status — 轮询报告生成状态
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
      select: {
        id: true,
        status: true,
        progress: true,
        errorMessage: true,
        children: {
          select: {
            id: true,
            status: true,
            progress: true,
            templateId: true,
            template: { select: { name: true } },
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('获取报告状态失败:', error)
    return NextResponse.json(
      { error: '获取报告状态失败' },
      { status: 500 }
    )
  }
}
