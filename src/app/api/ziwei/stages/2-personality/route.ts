/**
 * API Route: 阶段二 — 性格定性
 *
 * POST /api/ziwei/stages/2-personality
 *
 * 自动补全阶段一，返回四维标签 + 命宫全息底色。
 * LLM 不参与本阶段计算。
 */

import { NextResponse } from 'next/server'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { guardZiweiDebugApi } from '@/lib/ziwei/debug-api-guard'
import { hasValidChartPalaces } from '@/lib/ziwei/chart-data-validation'

export async function POST(request: Request) {
  const guard = await guardZiweiDebugApi()
  if (guard) return guard

  try {
    const body = await request.json() as {
      chartData?: Record<string, unknown>
      question?: string
    }

    if (!hasValidChartPalaces(body.chartData)) {
      return NextResponse.json(
        { error: '缺少有效的 chartData.palaces（至少 12 宫）' },
        { status: 400 },
      )
    }

    // 自动补全阶段一
    const stage1 = executeStage1({ chartData: body.chartData })

    // 执行阶段二
    const stage2 = executeStage2({
      stage1,
      question: body.question ?? '请分析我的性格',
    })

    return NextResponse.json({
      stage: 2,
      personality: {
        mingGong: {
          tags: stage2.mingGongTags.selfTags,
          summary: stage2.mingGongTags.summary,
        },
        shenGong: {
          tags: stage2.shenGongTags.selfTags,
          summary: stage2.shenGongTags.summary,
        },
        taiSui: {
          tags: stage2.taiSuiTags.selfTags,
          summary: stage2.taiSuiTags.summary,
        },
        overallTone: stage2.overallTone,
        holographicBase: stage2.mingGongHolographic.summary,
      },
      knowledgeSnippetCount: stage2.knowledgeSnippets.length,
    })
  } catch (error) {
    console.error('[Stage2 API] 执行失败:', error)
    return NextResponse.json(
      { error: '阶段二执行失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
