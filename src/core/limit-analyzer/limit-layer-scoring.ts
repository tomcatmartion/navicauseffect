/**
 * 大限/流年独立十二宫评分摘要
 */

import type { PalaceScoreBrief, PalaceTone } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'

/** 将原生基调映射为三档能级 */
export function mapToneToBriefLevel(tone: PalaceTone): PalaceScoreBrief['level'] {
  if (tone === '实旺' || tone === '实旺偏磨炼') return '吉旺'
  if (tone === '磨炼') return '平'
  return '凶弱'
}

/** 对给定 ScoringContext 评估十二宫并返回 brief 列表 */
export function scorePalacesToBrief(ctx: ScoringContext | null): PalaceScoreBrief[] {
  if (!ctx) return []
  const scores = evaluateAllPalaces(ctx)
  return scores.map((row, palaceIndex) => ({
    palaceIndex,
    palaceName: PALACE_NAMES[palaceIndex] ?? row.palace,
    score: row.finalScore,
    grade: row.tone,
    level: mapToneToBriefLevel(row.tone),
  }))
}
