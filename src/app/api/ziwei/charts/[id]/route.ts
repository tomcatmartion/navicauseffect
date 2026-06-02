/**
 * GET /api/ziwei/charts/[id] — 查询单个命盘详情
 *
 * 返回命盘数据 + Stage1/2 快照 + 最新报告
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { id } = await params

  const chart = await prisma.consultationRecord.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
      birthSolarDate: true,
      birthLunarDate: true,
      birthCity: true,
      timeIndex: true,
      gender: true,
      astrolabeData: true,
      chartFingerprint: true,
      stage1Snapshot: true,
      stage2Snapshot: true,
      lastMatterType: true,
      latestReport: true,
      sourceSessionId: true,
      createdAt: true,
      analyses: {
        select: {
          id: true,
          category: true,
          previewContent: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!chart) {
    return NextResponse.json({ error: '命盘不存在' }, { status: 404 })
  }

  return NextResponse.json({ chart })
}
