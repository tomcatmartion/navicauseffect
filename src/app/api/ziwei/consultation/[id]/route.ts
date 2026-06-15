/**
 * API Route: 获取咨询记录（含评分快照）
 *
 * GET /api/ziwei/consultation/[id]
 *
 * 返回指定咨询记录的完整数据，包括：
 * - Stage1 快照（宫位评分、格局、四化）
 * - Stage2 快照（性格定性、全息底色）
 * - 最新报告
 */

import { NextResponse } from 'next/server'
import { scoringService } from '@/core/services/scoring-service'
import { auth } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const record = await scoringService.getConsultation(id)

    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    // 权限检查：只能查看自己的记录
    if (record.userId !== session.user.id) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    return NextResponse.json({
      id: record.id,
      chartFingerprint: record.chartFingerprint,
      birthSolarDate: record.birthSolarDate,
      gender: record.gender,
      timeIndex: record.timeIndex,
      stage1Snapshot: record.stage1Snapshot,
      stage2Snapshot: record.stage2Snapshot,
      lastMatterType: record.lastMatterType,
      latestReport: record.latestReport,
      createdAt: record.createdAt,
    })
  } catch (error) {
    console.error('[Consultation API] 查询失败:', error)
    return NextResponse.json(
      { error: '查询失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
