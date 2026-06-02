/**
 * 确定性 Stage1–4 共享执行（Hybrid 编排与排盘页调试共用）
 */
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'
import { resolveMatterRoute } from '@/core/router/matter-route-resolver'
import type {
  MatterType,
  PalaceName,
  Stage1Output,
  Stage2Output,
  Stage3Output,
  Stage4Output,
} from '@/core/types'
import type { MatterRouteResult } from '@/core/types'

export interface RunChartStagesOptions {
  question?: string
  matterType?: MatterType
  targetYear?: number
  partnerBirthYear?: number | null
  parentBirthYears?: { father?: number; mother?: number }
  focusContext?: { matterType: MatterType; primaryPalace: PalaceName }
  /** 显式问诊 answers（与 data/router.json 字段对应） */
  routingAnswers?: Record<string, string>
}

export interface RunChartStagesResult {
  stage1: Stage1Output
  stage2: Stage2Output
  stage3: Stage3Output
  stage4: Stage4Output
  route: MatterRouteResult
  matterType: MatterType
  targetYear: number
  routingAnswers: Record<string, string>
  routeExtractConfidence: number
}

export function runCoreChartStages(
  chartData: Record<string, unknown>,
  opts: RunChartStagesOptions = {},
): RunChartStagesResult {
  const matterType = (opts.matterType ?? '求财') as MatterType
  const targetYear = opts.targetYear ?? new Date().getFullYear()
  const question = opts.question ?? '请分析命盘'

  const stage1 = executeStage1({ chartData, parentBirthYears: opts.parentBirthYears })
  const stage2 = executeStage2({ stage1, question })
  const resolvedRoute = resolveMatterRoute(matterType, question, opts.routingAnswers, {
    partnerBirthYear: opts.partnerBirthYear,
  })
  const route = resolvedRoute
  const stage3 = executeStage3({
    stage1,
    stage2,
    matterType,
    routeResult: route,
    chartData,
    targetYear,
  })
  const stage4 = executeStage4({
    stage1,
    stage2,
    partnerBirthYear: opts.partnerBirthYear ?? null,
    chartData,
    targetYear,
    focusContext: opts.focusContext ?? {
      matterType,
      primaryPalace: route.primaryPalace,
    },
  })

  return {
    stage1,
    stage2,
    stage3,
    stage4,
    route,
    matterType,
    targetYear,
    routingAnswers: resolvedRoute.routingAnswers,
    routeExtractConfidence: resolvedRoute.extractConfidence,
  }
}
