/**
 * 宫位重叠检测器
 *
 * 检测流年事项宫位与大限/原局事项宫位的重叠关系。
 * 数据来源：MatterRouteResult（主看/兼看宫位）+ 三层宫位映射。
 */

import type { PalaceName } from '../types'
import type { OverlapSpec } from './types'

/**
 * 检测流年与原局/大限事项宫位的重叠
 *
 * 逻辑：
 * 1. 流年事项宫名称 = 大限事项宫名称 → isDirect=true（直接重叠）
 * 2. 流年事项宫在大限事项宫的三方四正中 → 间接关联
 * 3. 收集所有重叠的宫位 → affectedPalaces
 *
 * @param liuNianPrimaryPalaces 流年事项宫位列表
 * @param daXianPrimaryPalaces 大限事项宫位列表
 * @param yuanJuPrimaryPalaces 原局事项宫位列表
 */
export function detectOverlap(
  liuNianPrimaryPalaces: PalaceName[],
  daXianPrimaryPalaces: PalaceName[],
  yuanJuPrimaryPalaces: PalaceName[],
): OverlapSpec {
  // 以第一个事项宫位为主（通常是主看宫位）
  const primaryPalace = liuNianPrimaryPalaces[0] ?? '命宫'

  const affectedPalaces: PalaceName[] = []

  // 检查流年→大限重叠
  let isDirect = false
  for (const lnp of liuNianPrimaryPalaces) {
    if (daXianPrimaryPalaces.includes(lnp)) {
      isDirect = true
      if (!affectedPalaces.includes(lnp)) {
        affectedPalaces.push(lnp)
      }
    }
  }

  // 检查流年→原局重叠
  for (const lnp of liuNianPrimaryPalaces) {
    if (yuanJuPrimaryPalaces.includes(lnp) && !affectedPalaces.includes(lnp)) {
      affectedPalaces.push(lnp)
    }
  }

  // 如果没有重叠，主宫自身也算
  if (affectedPalaces.length === 0) {
    affectedPalaces.push(primaryPalace)
    // 即使不同名也算直接（同宫不同层）
    isDirect = true
  }

  return {
    primaryPalace,
    affectedPalaces,
    isDirect,
  }
}
