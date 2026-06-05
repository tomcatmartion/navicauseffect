/**
 * 大限/流年独立十二宫评分摘要
 *
 * 委托到 PalaceEnergyIndex 统一实现。
 * 支持增量模式：传入 baseScores + layerLabel 时使用增量评分。
 */

import type { PalaceScore, PalaceScoreBrief, PalaceTone } from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { PalaceEnergyIndex } from '@/core/energy-evaluator/palace-energy-index'
import { buildDeltaLayerBriefs } from '@/core/energy-evaluator/layer-delta-scoring'
import type { LiuNianExtraStar } from './liu-nian-extra-stars'

/** 将原生基调映射为三档能级 */
export function mapToneToBriefLevel(tone: PalaceTone): PalaceScoreBrief['level'] {
  if (tone === '实旺' || tone === '实旺偏磨炼') return '吉旺'
  if (tone === '磨炼') return '平'
  return '凶弱'
}

/**
 * 对给定 ScoringContext 评估十二宫并返回 brief 列表
 *
 * 支持两种模式：
 *   - 增量模式：传入 baseScores + layerLabel，在基础分上叠加增量
 *   - 全量模式：不传 baseScores，从头跑完整评分（兼容旧调用）
 *
 * @param ctx 评分上下文
 * @param layerOffset 层偏移量（用于 toLayerBriefs）
 * @param baseScores 基础层评分（传入时启用增量模式）
 * @param layerLabel 层标签（'大限' 或 '流年'）
 * @param extraStars 流年额外星曜
 */
export function scorePalacesToBrief(
  ctx: ScoringContext | null,
  layerOffset: number = 0,
  baseScores?: readonly PalaceScore[],
  layerLabel?: '大限' | '流年',
  extraStars?: readonly LiuNianExtraStar[],
): PalaceScoreBrief[] {
  if (!ctx) return []
  if (baseScores && layerLabel) {
    // 增量模式
    return buildDeltaLayerBriefs(baseScores, {
      layerCtx: ctx,
      layerLabel,
      extraStars,
    })
  }
  // 兜底：全量模式（兼容旧调用）
  const scores = evaluateAllPalaces(ctx)
  const index = new PalaceEnergyIndex(scores)
  return index.toLayerBriefs(layerOffset)
}
