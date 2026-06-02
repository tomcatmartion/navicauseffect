/**
 * GET /api/ziwei/charts — 查询用户的命盘列表
 *
 * 返回当前用户的所有 ConsultationRecord，按创建时间倒序
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const charts = await prisma.consultationRecord.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      birthSolarDate: true,
      gender: true,
      birthCity: true,
      chartFingerprint: true,
      lastMatterType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ charts })
}
