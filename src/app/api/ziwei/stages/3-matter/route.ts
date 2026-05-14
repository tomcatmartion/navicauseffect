/**
 * API Route: 阶段三 — 事项分析
 *
 * POST /api/ziwei/stages/3-matter
 *
 * 自动补全阶段一+二，返回事项分析 + 行运数据 + 方向矩阵。
 * LLM 不参与本阶段计算。
 */

import { NextResponse } from 'next/server'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { routeMatter } from '@/core/router/decision-tree'
import type { MatterType } from '@/core/types'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      chartData?: Record<string, unknown>
      matterType?: string
      question?: string
      targetYear?: number
    }

    if (!body.chartData) {
      return NextResponse.json(
        { error: '缺少 chartData 参数' },
        { status: 400 },
      )
    }

    const matterType = (body.matterType ?? '求财') as MatterType
    const targetYear = body.targetYear ?? new Date().getFullYear()

    // 自动补全阶段一+二
    const stage1 = executeStage1({ chartData: body.chartData })
    const stage2 = executeStage2({ stage1, question: body.question ?? matterType })

    // 事项路由
    const routeResult = routeMatter(matterType, {})

    // 执行阶段三
    const stage3 = executeStage3({
      stage1,
      stage2,
      matterType,
      routeResult,
      chartData: body.chartData,
      targetYear,
    })

    return NextResponse.json({
      stage: 3,
      matterType,
      primaryAnalysis: stage3.primaryAnalysis,
      daXianCount: stage3.allDaXianMappings.length,
      daXianMappings: stage3.allDaXianMappings.map(d => ({
        index: d.index,
        ageRange: d.ageRange,
        daXianGan: d.daXianGan,
        mingPalace: d.mingPalaceName,
        mutagen: d.mutagen,
      })),
      directionMatrix: stage3.directionMatrix,
      directionWindow: stage3.directionWindow,
      knowledgeSnippetCount: stage3.knowledgeSnippets.length,
    })
  } catch (error) {
    console.error('[Stage3 API] 执行失败:', error)
    return NextResponse.json(
      { error: '阶段三执行失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
