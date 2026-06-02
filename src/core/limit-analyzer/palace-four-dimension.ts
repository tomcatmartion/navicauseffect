/**
 * 事项主宫四维空间投射（limit_direction.json palaceProjection）
 */

import type { PalaceBrightness, PalaceName, Stage1Output, FourDimensionProjection } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import {
  getOppositeIndex,
  getTrineIndices,
  getFlankingIndices,
  getWeakerBrightness,
} from '@/core/energy-evaluator/scoring-flow'
import {
  getPalaceProjectionFactor,
  getFlankingProjectionFactor,
} from '@/core/knowledge-dict/limit-direction'

function rowMajorBrightness(row: Stage1Output['palaceScores'][number] | undefined): PalaceBrightness {
  return row?.majorStars[0]?.brightness ?? '平'
}

function warmCoolToWangRuo(
  label: Stage1Output['palaceScores'][number]['warmCoolLabel'] | undefined,
): '旺' | '平' | '弱' {
  if (!label) return '平'
  if (label === '旺' || label === '旺偏磨炼') return '旺'
  if (label === '虚浮' || label === '凶危') return '弱'
  return '平'
}

export type { FourDimensionProjection } from '@/core/types'

function brightnessToWangRuo(brightness: string): '旺' | '平' | '弱' {
  if (brightness === '庙' || brightness === '旺' || brightness === '得') return '旺'
  if (brightness === '陷' || brightness === '不') return '弱'
  return '平'
}

export function computePalaceFourDimension(
  primaryIdx: number,
  palaceScores: Stage1Output['palaceScores'],
): FourDimensionProjection {
  const selfRow = palaceScores[primaryIdx]
  const selfScore = selfRow?.finalScore ?? 5
  const selfFactor = getPalaceProjectionFactor('本宫')
  const selfPalace = PALACE_NAMES[primaryIdx] as PalaceName

  const oppIdx = getOppositeIndex(primaryIdx)
  const oppRow = palaceScores[oppIdx]
  const oppFactor = getPalaceProjectionFactor('对宫')
  const oppScore = (oppRow?.finalScore ?? 5) * oppFactor

  const [t1, t2] = getTrineIndices(primaryIdx)
  const trineFactor = getPalaceProjectionFactor('三合宫')
  const trinePalaces = [PALACE_NAMES[t1], PALACE_NAMES[t2]] as PalaceName[]
  const trineScore =
    (((palaceScores[t1]?.finalScore ?? 5) + (palaceScores[t2]?.finalScore ?? 5)) / 2) * trineFactor

  const [leftIdx, rightIdx] = getFlankingIndices(primaryIdx)
  const leftRow = palaceScores[leftIdx]
  const rightRow = palaceScores[rightIdx]
  const flankBrightness = getWeakerBrightness(
    rowMajorBrightness(leftRow),
    rowMajorBrightness(rightRow),
  )
  const selfWangRuo = warmCoolToWangRuo(selfRow?.warmCoolLabel)
  const flankWangRuo = brightnessToWangRuo(flankBrightness)
  const flankFactor = getFlankingProjectionFactor(selfWangRuo, flankWangRuo)
  const flankPalaces = [PALACE_NAMES[leftIdx], PALACE_NAMES[rightIdx]] as PalaceName[]
  const flankAvg = ((leftRow?.finalScore ?? 5) + (rightRow?.finalScore ?? 5)) / 2
  const flankScore = flankAvg * flankFactor

  const weightedTotal = selfScore * selfFactor + oppScore + trineScore + flankScore

  const summary = [
    `本宫${selfPalace}${selfRow?.tone ?? '平'}（${selfScore.toFixed(1)}×${selfFactor}）`,
    `对宫${PALACE_NAMES[oppIdx]}投射${(oppScore).toFixed(1)}（×${oppFactor}）`,
    `三合${trinePalaces.join('、')}均投${trineScore.toFixed(1)}（×${trineFactor}）`,
    `夹宫${flankPalaces.join('·')}系数${flankFactor}→${flankScore.toFixed(1)}`,
  ].join('；')

  return {
    self: {
      palace: selfPalace,
      score: selfScore,
      factor: selfFactor,
      tone: selfRow?.tone ?? '平',
    },
    opposite: {
      palace: PALACE_NAMES[oppIdx] as PalaceName,
      score: oppScore,
      factor: oppFactor,
      tone: oppRow?.tone ?? '平',
    },
    trine: { palaces: trinePalaces, score: trineScore, factor: trineFactor },
    flanking: {
      palaces: flankPalaces,
      score: flankScore,
      factor: flankFactor,
      tone: `${selfWangRuo}×${flankWangRuo}`,
    },
    weightedTotal,
    summary,
  }
}
