import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db'

// GET /api/reports/[id]/questions — 获取报告问答列表
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
    })
    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 })
    }

    const questions = await prisma.reportQuestion.findMany({
      where: { reportId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('获取问答失败:', error)
    return NextResponse.json({ error: '获取问答失败' }, { status: 500 })
  }
}

// POST /api/reports/[id]/questions — 提交报告问答
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
    const { question } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: '请输入问题' }, { status: 400 })
    }

    const report = await prisma.report.findFirst({
      where: { id, userId: session.user.id, status: 'COMPLETED' },
    })
    if (!report) {
      return NextResponse.json({ error: '报告不存在或未完成' }, { status: 404 })
    }

    const q = await prisma.reportQuestion.create({
      data: {
        reportId: id,
        userId: session.user.id,
        question: question.trim(),
      },
    })

    return NextResponse.json({ question: q }, { status: 201 })
  } catch (error) {
    console.error('提交问答失败:', error)
    return NextResponse.json({ error: '提交问答失败' }, { status: 500 })
  }
}
