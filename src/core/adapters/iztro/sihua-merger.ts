/**
 * 四化合并薄封装 — 与 Stage1 内 `applySihuaAndAnnotate` 对齐
 */

import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { readChartFromData, normalizedChartToScoringContext } from '@/core/data-reader/iztro-reader'
import { applySihuaAndAnnotate } from '@/core/stages/helpers/sihua-applier'
import type { MergedSihua } from '@/core/types'

export function mergeSihuaFromChartData(chartData: Record<string, unknown>): MergedSihua {
  const chart = readChartFromData(chartData)
  const scoringCtx = normalizedChartToScoringContext(chart)
  const rawSihua = calculateOriginalSihua(scoringCtx.birthGan, scoringCtx.taiSuiZhi)
  return applySihuaAndAnnotate(scoringCtx, rawSihua)
}
