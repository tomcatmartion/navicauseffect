import { auth } from "@/lib/auth"
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/report-templates — 获取所有报告模板（分组返回）
export async function GET() {
  try {
    const templates = await prisma.reportTemplate.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // 按类型分组
    const basicTemplates = templates.filter((t: { type: string }) => t.type === 'BASIC')
    const advancedTemplates = templates.filter((t: { type: string }) => t.type === 'ADVANCED')

    return NextResponse.json({
      basicTemplates,
      advancedTemplates,
    })
  } catch (error) {
    console.error('获取报告模板失败:', error)
    return NextResponse.json(
      { error: '获取报告模板失败' },
      { status: 500 }
    )
  }
}
