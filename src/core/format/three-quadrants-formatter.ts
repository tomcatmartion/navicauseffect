/**
 * 三方四正格式化器
 *
 * 复用 scoring-flow.ts 中的 getOppositeIndex / getTrineIndices
 * 将指定宫位的三方四正转换为 ThreeQuadrantsSpec。
 *
 * 数据来源：
 *   - getOppositeIndex(idx) → 对宫索引
 *   - getTrineIndices(idx) → 两个三合宫索引
 *   - PalaceScore[] → 各宫位评分数据
 *   - PalaceLayerEntry[] → 各宫位天干/地支/星曜/四化
 */

import type { PalaceScore, PalaceLayerEntry, PalaceName } from '../types'
import { getOppositeIndex, getTrineIndices } from '../energy-evaluator/scoring-flow'
import { formatPalaceBase, formatPalaceBaseFromLayer, resolveOriginalPalaceName } from './palace-base-formatter'
import type { ThreeQuadrantsSpec, PalaceBaseSpec } from './types'

interface PalaceDataPair {
  score: PalaceScore
  entry: PalaceLayerEntry
}

/**
 * 构建三方四正结构
 *
 * @param focusIndex 焦点宫位索引（0-11）
 * @param palaceData 12宫完整数据（评分 + 层表条目）
 * @param mingPalaceIndex 该层命宫在原局中的索引（用于计算 originalPalace）
 * @param parentMingPalaceIndex 父层命宫索引（流年→大限映射用，null 表示不需要）
 */
export function formatThreeQuadrants(
  focusIndex: number,
  palaceData: PalaceDataPair[],
  mingPalaceIndex: number,
  parentMingPalaceIndex: number | null = null,
): ThreeQuadrantsSpec {
  const oppIdx = getOppositeIndex(focusIndex)
  const [trine1Idx, trine2Idx] = getTrineIndices(focusIndex)

  const formatPalace = (idx: number): PalaceBaseSpec => {
    const data = palaceData[idx]
    if (!data) {
      // 安全回退：返回空结构
      return createEmptyPalaceBase(idx)
    }
    const originalPalace = resolveOriginalPalaceName(idx, mingPalaceIndex)
    // 流年需要 daXianPalace：通过父层命宫索引计算
    const daXianPalace = parentMingPalaceIndex != null
      ? resolveOriginalPalaceName(idx, parentMingPalaceIndex)
      : null

    return formatPalaceBase(data.score, data.entry, originalPalace, daXianPalace)
  }

  return {
    opposite: formatPalace(oppIdx),
    firstTrine: formatPalace(trine1Idx),
    secondTrine: formatPalace(trine2Idx),
  }
}

/**
 * 仅用 PalaceLayerEntry 构建三方四正（无评分数据时）
 */
export function formatThreeQuadrantsFromLayer(
  focusIndex: number,
  entries: PalaceLayerEntry[],
  scores: Array<number | undefined>,
  mingPalaceIndex: number,
  parentMingPalaceIndex: number | null = null,
): ThreeQuadrantsSpec {
  const oppIdx = getOppositeIndex(focusIndex)
  const [trine1Idx, trine2Idx] = getTrineIndices(focusIndex)

  const formatFromLayer = (idx: number): PalaceBaseSpec => {
    const entry = entries[idx]
    if (!entry) return createEmptyPalaceBase(idx)

    const originalPalace = resolveOriginalPalaceName(idx, mingPalaceIndex)
    const daXianPalace = parentMingPalaceIndex != null
      ? resolveOriginalPalaceName(idx, parentMingPalaceIndex)
      : null

    return formatPalaceBaseFromLayer(entry, scores[idx], originalPalace, daXianPalace)
  }

  return {
    opposite: formatFromLayer(oppIdx),
    firstTrine: formatFromLayer(trine1Idx),
    secondTrine: formatFromLayer(trine2Idx),
  }
}

/** 创建空 PalaceBase（索引越界时的安全回退） */
function createEmptyPalaceBase(idx: number): PalaceBaseSpec {
  const names: readonly PalaceName[] = [
    '命宫', '父母', '福德', '田宅', '官禄', '仆役',
    '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
  ]
  return {
    palaceName: names[idx % 12] ?? '命宫',
    earthlyBranch: '子',
    heavenlyStem: '甲',
    majorStars: '',
    minorStars: '',
    sihua: null,
    score: 0,
    level: '平',
    originalPalace: null,
    daXianPalace: null,
  }
}
