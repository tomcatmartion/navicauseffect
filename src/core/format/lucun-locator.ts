/**
 * 禄存宫位定位器
 *
 * 从评分上下文或 PalaceScore[] 中定位禄存所在宫位。
 * 数据来源：
 *   - ScoringContext.palaces[].hasLuCun（scoring-flow.ts）
 *   - PalaceScore.luCunDelta（非零表示该宫有禄存）
 */

import type { PalaceScore } from '../types'
import type { ScoringContext } from '../energy-evaluator/scoring-flow'

/**
 * 从 PalaceScore[] 定位禄存宫位
 *
 * 禄存所在宫的 luCunDelta 非零，或通过 scoring flow 的 hasLuCun 判定。
 * 返回宫位地支名 + "宫" 的格式（如 "巳宫"）。
 *
 * @param palaceScores 来源：stage1.palaceScores 或大限/流年评分
 * @param layerType 层级标识，用于无禄存时的默认返回
 */
export function locateLuCunPalace(
  palaceScores: PalaceScore[],
): string {
  // 优先查找 luCunDelta 非零的宫位
  for (const ps of palaceScores) {
    if (ps.luCunDelta !== 0) {
      return `${ps.diZhi}宫`
    }
  }

  // 回退：scoring context 的 hasLuCun 在 palaceScores 中不一定体现为 luCunDelta
  // 此情况在 layer-extractor 中通过 ScoringContext 补全
  return '未定位'
}

/**
 * 从 ScoringContext 定位禄存宫位（更精确）
 *
 * @param ctx 来源：stage1.scoringCtx 或 buildDaXianScoringContext/buildYearlyScoringContext
 */
export function locateLuCunPalaceFromContext(
  ctx: ScoringContext,
): string {
  for (const palace of ctx.palaces) {
    if (palace.hasLuCun) {
      return `${palace.diZhi}宫`
    }
    // 星曜列表中也检查
    if (palace.stars.some(s => s.name === '禄存')) {
      return `${palace.diZhi}宫`
    }
  }
  return '未定位'
}
