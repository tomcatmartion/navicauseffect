/**
 * 心理承载力评估 — 命宫分 − 方向矩阵压力值 + 事项宫自身状态 + 保护机制
 */

import type { DirectionMatrix, MatterResilienceResult, PalaceScoreBrief } from '@/core/types'
import { getMatrixStressValue, getResilienceThresholds } from '@/core/knowledge-dict/limit-direction'

export function evaluateResilience(
  mingPalaceScore: number,
  directionMatrix: DirectionMatrix,
  matterPalaceScore?: number,
  hasProtection?: boolean,
): MatterResilienceResult {
  const stress = getMatrixStressValue(directionMatrix)
  let score = mingPalaceScore - stress

  // 事项宫自身状态良好时的缓冲
  if (matterPalaceScore !== undefined && matterPalaceScore >= 6) {
    score += 0.5
  }

  // 有保护机制时的缓冲
  if (hasProtection) {
    score += 0.5
  }

  const thresholds = getResilienceThresholds()

  if (score < thresholds.crisis) {
    return {
      score,
      strategy: '危机干预',
      promptSuffix: thresholds.crisisPromptSuffix,
    }
  }
  if (score < thresholds.development) {
    return {
      score,
      strategy: '发展性咨询',
      promptSuffix: thresholds.developmentPromptSuffix,
    }
  }
  return {
    score,
    strategy: '赋能性咨询',
    promptSuffix: thresholds.empowermentPromptSuffix,
  }
}

/** 人生趋势判断（命宫 vs 身宫三档能级） */
export function evaluateLifeTrend(
  mingLevel: PalaceScoreBrief['level'],
  shenLevel: PalaceScoreBrief['level'],
): string {
  if (mingLevel === '吉旺' && shenLevel === '凶弱') return '先升后降'
  if (mingLevel === '凶弱' && shenLevel === '吉旺') return '先抑后扬'
  return '平稳'
}

/** 能力与机会匹配度（原局命宫 × 大限命宫） */
export function evaluateCapabilityMatch(
  yuanJuMingLevel: PalaceScoreBrief['level'],
  daXianMingLevel: PalaceScoreBrief['level'],
): string {
  const coeff: Record<PalaceScoreBrief['level'], number> = {
    吉旺: 1.2,
    平: 1.0,
    凶弱: 0.8,
  }
  const match = coeff[yuanJuMingLevel] * coeff[daXianMingLevel]
  if (match < 0.9) return '能力不足'
  if (match > 1.1) return '能力超配'
  return '匹配'
}
