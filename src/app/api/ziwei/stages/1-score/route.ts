/**
 * API Route: 阶段一 — 排盘 + 宫位评分
 *
 * POST /api/ziwei/stages/1-score
 *
 * 接收命盘数据，返回十二宫评分 + 格局 + 四化。
 * LLM 不参与本阶段计算。
 */

import { NextResponse } from 'next/server'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { guardZiweiDebugApi } from '@/lib/ziwei/debug-api-guard'
import { hasValidChartPalaces } from '@/lib/ziwei/chart-data-validation'

export async function POST(request: Request) {
  const guard = await guardZiweiDebugApi()
  if (guard) return guard

  try {
    const body = await request.json() as {
      chartData?: Record<string, unknown>
      parentBirthYears?: { father?: number; mother?: number }
    }

    if (!hasValidChartPalaces(body.chartData)) {
      return NextResponse.json(
        { error: '缺少有效的 chartData.palaces（至少 12 宫）' },
        { status: 400 },
      )
    }

    const result = executeStage1({
      chartData: body.chartData,
      parentBirthYears: body.parentBirthYears,
    })

    return NextResponse.json({
      stage: 1,
      palaceScores: result.palaceScores.map(p => ({
        palace: p.palace,
        diZhi: p.diZhi,
        finalScore: p.finalScore,
        tone: p.tone,
        majorStars: p.majorStars.map(ms => ms.star),
        patterns: p.patterns.map(pt => pt.name),
      })),
      allPatterns: result.allPatterns,
      mergedSihua: {
        entries: result.mergedSihua.entries.map(e => `${e.type}${e.star}(${e.source})`),
        specialOverlaps: result.mergedSihua.specialOverlaps.map(o => `${o.type}: ${o.star}`),
      },
      knowledgeSnippetCount: result.knowledgeSnippets.length,
    })
  } catch (error) {
    console.error('[Stage1 API] 执行失败:', error)
    return NextResponse.json(
      { error: '阶段一执行失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
