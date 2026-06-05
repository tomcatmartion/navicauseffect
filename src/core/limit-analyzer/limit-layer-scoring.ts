/**
 * 大限/流年独立十二宫评分摘要
 *
 * 委托到 PalaceEnergyIndex 统一实现。
 */

import type { PalaceScoreBrief, PalaceTone } from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { PalaceEnergyIndex } from '@/core/energy-evaluator/palace-energy-index'

/** 将原生基调映射为三档能级 */
export function mapToneToBriefLevel(tone: PalaceTone): PalaceScoreBrief['level'] {
  if (tone === '实旺' || tone === '实旺偏磨炼') return '吉旺'
  if (tone === '磨炼') return '平'
  return '凶弱'
}

/**
 * 对给定 ScoringContext 评估十二宫并返回 brief 列表
 *
 * 委托到 PalaceEnergyIndex.toLayerBriefs()
 *
 * @param ctx 评分上下文（原局/大限/流年）
 * @param layerOffset 层偏移量 — 该层命宫在原局中的索引
 *   - 原局：0（默认）
 *   - 大限：currentDaXian.palaceIndex
 *   - 流年：natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
 */
export function scorePalacesToBrief(
  ctx: ScoringContext | null,
  layerOffset: number = 0,
): PalaceScoreBrief[] {
  if (!ctx) return []
  const scores = evaluateAllPalaces(ctx)
  const index = new PalaceEnergyIndex(scores)
  return index.toLayerBriefs(layerOffset)
}
