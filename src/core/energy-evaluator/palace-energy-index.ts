/**
 * 地支宫位能级索引 — 宫位能级得分的统一查询入口
 *
 * 核心原则：宫位能级得分绑定在地支宫位上，不随功能名移动。
 *
 * 原局12个地支位置各有固定的能级得分（骨架基础分 + 天花板）。
 * 大限/流年的功能宫名（如"官禄"）落在不同的地支位置时，
 * 其能级得分取该地支位置的基础值，而非原局同名功能宫的值。
 *
 * 四化加减分会随层变化（大限四化、流年四化），但骨架基础分始终不变。
 *
 * 用法：
 *   // 从评分结果构建索引
 *   const natalIndex = new PalaceEnergyIndex(stage1.palaceScores)
 *   const daXianIndex = new PalaceEnergyIndex(daXianEvalScores)
 *
 *   // 查原局官禄宫得分
 *   natalIndex.getByLayerPalace('官禄')
 *
 *   // 查大限官禄宫得分（大限命宫在原局 index 3）
 *   daXianIndex.getByLayerPalace('官禄', 3)
 *
 *   // 查流年12宫摘要（流年命宫在原局 index 10）
 *   natalIndex.toLayerBriefs(10)
 */

import type { PalaceScore, PalaceScoreBrief, PalaceName, PalaceTone } from '../types'
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '../types'

/** 将原生基调映射为三档能级 */
function mapToneToBriefLevel(tone: PalaceTone): PalaceScoreBrief['level'] {
  if (tone === '实旺' || tone === '实旺偏磨炼') return '吉旺'
  if (tone === '磨炼') return '平'
  return '凶弱'
}

/**
 * 地支宫位能级索引
 *
 * 将 evaluateAllPalaces() 返回的 PalaceScore[] 封装为
 * 支持层偏移量查询的索引对象。
 */
export class PalaceEnergyIndex {
  private readonly scores: readonly PalaceScore[]

  /**
   * @param scores evaluateAllPalaces() 返回的12宫评分结果
   *   scores[0] = 原局命宫位置的评分, scores[4] = 原局官禄宫位置的评分, ...
   */
  constructor(scores: readonly PalaceScore[]) {
    this.scores = scores
  }

  /**
   * 按层内功能宫名取完整 PalaceScore
   *
   * @param palaceName 功能宫名（如 '官禄'、'财帛'）
   * @param layerOffset 层偏移量
   *   - 原局：0
   *   - 大限：currentDaXian.palaceIndex
   *   - 流年：natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
   */
  getByLayerPalace(palaceName: PalaceName, layerOffset: number = 0): PalaceScore {
    const natalIdx = PalaceEnergyIndex.mapToNatalIndex(palaceName, layerOffset)
    return this.scores[natalIdx]!
  }

  /**
   * 按原局地支索引取 PalaceScore
   *
   * @param idx 原局12宫索引（0-11）
   */
  getByNatalIndex(idx: number): PalaceScore {
    return this.scores[idx % 12]!
  }

  /**
   * 取层内12宫评分摘要
   *
   * 返回结果按层内功能宫排列：
   *   result[0] = 该层命宫
   *   result[4] = 该层官禄宫
   *   result[10] = 该层夫妻宫
   *
   * @param layerOffset 层偏移量
   * @param toneOverride 可选的基调覆盖（用于外部 tone 映射）
   */
  toLayerBriefs(layerOffset: number = 0): PalaceScoreBrief[] {
    const result: PalaceScoreBrief[] = []
    for (let layerIdx = 0; layerIdx < 12; layerIdx++) {
      const natalIdx = (layerOffset + layerIdx) % 12
      const row = this.scores[natalIdx]
      if (!row) continue
      result.push({
        palaceIndex: layerIdx,
        palaceName: PALACE_NAMES[layerIdx] as PalaceScoreBrief['palaceName'],
        score: row.finalScore,
        grade: row.tone,
        level: mapToneToBriefLevel(row.tone),
      })
    }
    return result
  }

  // ═══════════════════════════════════════════════════════════
  // 静态工具方法（纯函数，不需要实例）
  // ═══════════════════════════════════════════════════════════

  /**
   * 将层内功能宫名映射到原局地支位置索引
   *
   * @param palaceName 功能宫名（如 '官禄'）
   * @param layerOffset 层偏移量（原局传 0）
   * @returns 该功能宫在原局中的实际地支位置索引
   */
  static mapToNatalIndex(palaceName: PalaceName, layerOffset: number): number {
    const nameIdx = PALACE_NAME_TO_INDEX[palaceName]
    return (layerOffset + nameIdx) % 12
  }

  /**
   * 反向映射：原局地支索引 → 层内功能宫名
   *
   * @param natalIdx 原局地支位置索引
   * @param layerOffset 层偏移量
   */
  static mapToLayerPalaceName(natalIdx: number, layerOffset: number): PalaceName {
    const layerIdx = (natalIdx - layerOffset + 12) % 12
    return PALACE_NAMES[layerIdx] as PalaceName
  }
}
