/**
 * POST /api/ziwei/chart-pipeline-debug
 * 排盘页调试：返回 Stage1–4 与 Hybrid 对齐的快照（须传 serializeAstrolabeForReading 的 chartData）。
 */

import { NextRequest, NextResponse } from 'next/server'
import type { MatterType } from '@/core/types'
import { buildChartPipelineDebugSnapshot } from '@/lib/ziwei/chart-pipeline-debug'

const AFFAIRS = new Set<string>(['求学', '求爱', '求财', '求职', '求健康', '求名'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const chartData = body?.chartData as Record<string, unknown> | undefined
    if (!chartData || typeof chartData !== 'object' || !Array.isArray(chartData.palaces)) {
      return NextResponse.json({ error: '缺少有效的 chartData（须含 palaces）' }, { status: 400 })
    }

    const affairType = (body?.affairType as string) || '求财'
    if (!AFFAIRS.has(affairType)) {
      return NextResponse.json({ error: '无效的 affairType' }, { status: 400 })
    }

    const affair = typeof body?.affair === 'string' ? body.affair : '排盘页调试'
    const targetYear =
      typeof body?.targetYear === 'number' && Number.isFinite(body.targetYear)
        ? body.targetYear
        : new Date().getFullYear()

    const rawPartner = body?.partnerBirthYear
    let partnerBirthYear: number | null =
      typeof rawPartner === 'number' && Number.isFinite(rawPartner) ? Math.round(rawPartner) : null
    if (rawPartner === null) partnerBirthYear = null
    if (partnerBirthYear !== null && (!Number.isInteger(partnerBirthYear) || partnerBirthYear < 1900 || partnerBirthYear > 2100)) {
      return NextResponse.json({ error: 'partnerBirthYear 须在 1900–2100 或 null' }, { status: 400 })
    }

    const snapshot = buildChartPipelineDebugSnapshot(chartData, {
      affairType: affairType as MatterType,
      affair,
      targetYear,
      partnerBirthYear: partnerBirthYear ?? null,
    })

    return NextResponse.json({ ok: true, data: snapshot })
  } catch (e) {
    console.error('[chart-pipeline-debug]', e)
    const message = e instanceof Error ? e.message : '服务器错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
