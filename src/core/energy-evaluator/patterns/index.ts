/**
 * M2: 格局判定 — 统一导出
 *
 * 格局元数据从 data/patterns.json 加载，判定函数保留在 TypeScript 中
 */

export { greatAuspiciousPatterns } from './great-auspicious'
export { mediumAuspiciousPatterns } from './medium-auspicious'
export { smallAuspiciousPatterns } from './small-auspicious'
export { smallInauspiciousPatterns } from './small-inauspicious'
export { mediumInauspiciousPatterns } from './medium-inauspicious'
export { greatInauspiciousPatterns } from './great-inauspicious'
export type { PatternPredicate, PatternLevel, ChartAccessor } from './types'
export {
  getSanFangSiZheng,
  hasStarInSanFang,
  hasSihuaInSanFang,
  hasZuoYouInSanFang,
  hasLuInSanFang,
  isJiGeYinDong,
  isMiaoWang,
  isLuoXian,
  checkSanQiFromSameSource,
} from './types'

import { greatAuspiciousPatterns } from './great-auspicious'
import { mediumAuspiciousPatterns } from './medium-auspicious'
import { smallAuspiciousPatterns } from './small-auspicious'
import { smallInauspiciousPatterns } from './small-inauspicious'
import { mediumInauspiciousPatterns } from './medium-inauspicious'
import { greatInauspiciousPatterns } from './great-inauspicious'
import { getPatternConfig } from '../../knowledge-dict/loader'

/** 所有格局的扁平数组（从代码加载） */
export const allPatterns = [
  ...greatAuspiciousPatterns,
  ...mediumAuspiciousPatterns,
  ...smallAuspiciousPatterns,
  ...smallInauspiciousPatterns,
  ...mediumInauspiciousPatterns,
  ...greatInauspiciousPatterns,
]

/** 获取格局倍率（从 JSON 加载） */
export function getPatternMultiplier(level: string): number {
  const config = getPatternConfig() as { multipliers?: Record<string, number> }
  return config.multipliers?.[level] ?? 1.0
}

/** 获取格局分类（从 JSON 加载） */
export function getPatternCategories(): Record<string, string[]> {
  const config = getPatternConfig() as { categories?: Record<string, string[]> }
  return config.categories ?? {}
}

/** 获取格局定义（从 JSON 加载） */
export function getPatternDefinition(name: string): Record<string, unknown> | null {
  const config = getPatternConfig() as { definitions?: Record<string, Record<string, unknown>> }
  return config.definitions?.[name] ?? null
}
