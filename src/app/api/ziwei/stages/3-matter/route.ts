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
import { resolveMatterRoute } from '@/core/router/matter-route-resolver'
import type { MatterType } from '@/core/types'
import { guardZiweiDebugApi } from '@/lib/ziwei/debug-api-guard'
import { hasValidChartPalaces } from '@/lib/ziwei/chart-data-validation'

export async function POST(request: Request) {
  const guard = await guardZiweiDebugApi()
  if (guard) return guard

  try {
    const body = await request.json() as {
      chartData?: Record<string, unknown>
      matterType?: string
      question?: string
      targetYear?: number
      routingAnswers?: Record<string, string>
    }

    if (!hasValidChartPalaces(body.chartData)) {
      return NextResponse.json(
        { error: '缺少有效的 chartData.palaces（至少 12 宫）' },
        { status: 400 },
      )
    }

    const matterType = (body.matterType ?? '求财') as MatterType
    const targetYear = body.targetYear ?? new Date().getFullYear()
    const question = body.question ?? matterType

    const stage1 = executeStage1({ chartData: body.chartData })
    const stage2 = executeStage2({ stage1, question })

    const routeResult = resolveMatterRoute(matterType, question, body.routingAnswers)

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
      routeResult: {
        primaryPalace: routeResult.primaryPalace,
        secondaryPalaces: routeResult.secondaryPalaces,
        specialConditions: routeResult.specialConditions,
        needInteraction: routeResult.needInteraction,
        routingAnswers: routeResult.routingAnswers,
        extractConfidence: routeResult.extractConfidence,
        missingFields: routeResult.missingFields,
      },
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
      compositeScore: stage3.compositeScore,
      scoreLabel: stage3.scoreLabel,
      scoreAction: stage3.scoreAction,
      currentDaXianQualitative: stage3.currentDaXianQualitative,
      protectionMechanisms: stage3.protectionMechanisms,
      liuNianSihuaPositions: stage3.liuNianSihuaPositions,
      liuYueDataAvailable: stage3.liuYueDataAvailable,
      personalityAnchor: stage3.personalityAnchor,
      analysisSummary: stage3.analysisSummary,
      knowledgeSnippetCount: stage3.knowledgeSnippets.length,
      fourDimension: stage3.fourDimension,
      scoreBreakdown: stage3.scoreBreakdown,
      causalChain: stage3.causalChain,
      luluJiFlow: stage3.luluJiFlow,
      resilience: stage3.resilience,
      daXianTimeline: stage3.daXianTimeline,
      slimmedDescriptions: stage3.slimmedDescriptions,
      sihuaLandingReport: stage3.sihuaLandingReport,
    })
  } catch (error) {
    console.error('[Stage3 API] 执行失败:', error)
    return NextResponse.json(
      { error: '阶段三执行失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
