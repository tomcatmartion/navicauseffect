/**
 * 四化合并薄封装 — 与 Stage1 内 `applySihuaAndAnnotate` 对齐
 */

import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { convertIztroToScoringContext } from '@/core/stages/helpers/chart-converter'
import { applySihuaAndAnnotate } from '@/core/stages/helpers/sihua-applier'
import type { MergedSihua } from '@/core/types'

export function mergeSihuaFromChartData(chartData: Record<string, unknown>): MergedSihua {
  const scoringCtx = convertIztroToScoringContext(chartData)
  const rawSihua = calculateOriginalSihua(scoringCtx.birthGan, scoringCtx.taiSuiZhi)
  return applySihuaAndAnnotate(scoringCtx, rawSihua)
}
