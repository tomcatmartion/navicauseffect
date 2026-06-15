/**
 * API Route: 获取用户的咨询记录列表
 *
 * GET /api/ziwei/consultation?userId=xxx
 *
 * 返回用户所有命盘记录的摘要列表。
 */

import { NextResponse } from 'next/server'
import { scoringService } from '@/core/services/scoring-service'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  // 只能查看自己的记录
  const userId = session.user.id

  try {
    const records = await scoringService.listConsultations(userId)

    return NextResponse.json({
      records: records.map(r => ({
        id: r.id,
        chartFingerprint: r.chartFingerprint,
        birthSolarDate: r.birthSolarDate,
        gender: r.gender,
        timeIndex: r.timeIndex,
        lastMatterType: r.lastMatterType,
        createdAt: r.createdAt,
      })),
      total: records.length,
    })
  } catch (error) {
    console.error('[Consultation List API] 查询失败:', error)
    return NextResponse.json(
      { error: '查询失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
