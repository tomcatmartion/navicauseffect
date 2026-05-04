/**
 * GET /api/admin/sentiment/reports
 * 获取历史舆情报告
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  try {
    const reports = await prisma.sentimentReport.findMany({
      orderBy: { reportDate: 'desc' },
      take: 90, // 最近 90 天
    })
    return NextResponse.json(reports)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 }
    )
  }
}