/**
 * limit_direction.json palaceWeights 动态键解析（科星落位宫 / 太阳落位宫）
 */

import type { PalaceName, Stage3Input } from '@/core/types'
import { PALACE_NAME_TO_INDEX, PALACE_NAMES } from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { getPalaceWeights, getSihuaRuleAdjustment } from '@/core/knowledge-dict/limit-direction'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import type { LiuYueHoroscopeSnapshot } from './limit-scoring-context'

const PALACE_WEIGHT_KEY: Record<PalaceName, string> = {
  命宫: '命宫',
  兄弟: '兄弟宫',
  夫妻: '夫妻宫',
  子女: '子女宫',
  财帛: '财帛宫',
  疾厄: '疾厄宫',
  迁移: '迁移宫',
  仆役: '仆役宫',
  官禄: '官禄宫',
  田宅: '田宅宫',
  福德: '福德宫',
  父母: '父母宫',
}

export function findStarPalaceIndex(ctx: ScoringContext, starName: string): number | null {
  for (let i = 0; i < ctx.palaces.length; i++) {
    const palace = ctx.palaces[i]
    if (palace.stars.some(s => s.name === starName)) return i
    if (palace.majorStars.some(ms => ms.star === starName)) return i
  }
  return null
}

/** 定位生年化科星（或四化表科星）所在宫位 */
export function findKeStarPalaceIndex(ctx: ScoringContext): number | null {
  for (let i = 0; i < ctx.palaces.length; i++) {
    if (ctx.palaces[i].stars.some(s => s.sihua === '化科')) return i
  }
  const keStar = getSihuaTable()[ctx.birthGan]?.科
  if (keStar) return findStarPalaceIndex(ctx, keStar)
  return null
}

/** 将 limit_direction.json palaceWeights 键解析为实际宫位 */
export function resolveWeightKeyToPalaces(
  weightKey: string,
  ctx: ScoringContext,
): PalaceName[] {
  if (weightKey === '科星落位宫') {
    const idx = findKeStarPalaceIndex(ctx)
    return idx !== null ? [PALACE_NAMES[idx]] : []
  }
  if (weightKey === '太阳落位宫') {
    const idx = findStarPalaceIndex(ctx, '太阳')
    return idx !== null ? [PALACE_NAMES[idx]] : []
  }

  for (const [palace, jsonKey] of Object.entries(PALACE_WEIGHT_KEY)) {
    if (jsonKey === weightKey) return [palace as PalaceName]
  }
  if (weightKey in PALACE_NAME_TO_INDEX) {
    return [weightKey as PalaceName]
  }
  return []
}

export function weightedOriginScore(
  matterType: Stage3Input['matterType'],
  ctx: ScoringContext,
  palaceScores: Stage3Input['stage1']['palaceScores'],
): number {
  const weights = getPalaceWeights(matterType)
  let sum = 0
  let wSum = 0

  for (const [weightKey, w] of Object.entries(weights)) {
    if (w <= 0) continue
    const palaces = resolveWeightKeyToPalaces(weightKey, ctx)
    for (const p of palaces) {
      const idx = PALACE_NAME_TO_INDEX[p]
      const score = palaceScores[idx]?.finalScore ?? 5
      sum += score * w
      wSum += w
    }
  }

  if (wSum === 0) {
    const idx = PALACE_NAME_TO_INDEX['命宫']
    return palaceScores[idx]?.finalScore ?? 5
  }
  return sum / wSum
}

/** 流月四化是否引动事项主宫（对齐 liuYueSihua.rules） */
export function matchLiuYueSihuaRule(
  primaryPalace: PalaceName,
  ctx: ScoringContext,
  monthly: LiuYueHoroscopeSnapshot | null,
): { ruleKey: string; adjustment: number } {
  if (!monthly) {
    return { ruleKey: '无流月数据', adjustment: 0 }
  }

  const primaryIdx = PALACE_NAME_TO_INDEX[primaryPalace]
  const palace = ctx.palaces[primaryIdx]
  if (!palace) {
    return { ruleKey: '无流月数据', adjustment: 0 }
  }

  const jiStar = monthly.mutagen[3]
  if (jiStar && palace.stars.some(s => s.name === jiStar)) {
    return {
      ruleKey: '忌化引动事项宫',
      adjustment: getSihuaRuleAdjustment('liuYueSihua', '忌化引动事项宫'),
    }
  }

  const auspiciousStars = monthly.mutagen.slice(0, 3).filter(Boolean)
  if (auspiciousStars.some(star => palace.stars.some(s => s.name === star))) {
    return {
      ruleKey: '吉化引动事项宫',
      adjustment: getSihuaRuleAdjustment('liuYueSihua', '吉化引动事项宫'),
    }
  }

  return { ruleKey: '流月无显著引动', adjustment: 0 }
}

/** 测试别名 */
export const matchLiuYueSihuaRuleForTest = matchLiuYueSihuaRule
