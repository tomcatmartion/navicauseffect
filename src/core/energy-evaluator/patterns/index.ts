/**
 * M2: 格局判定 — 统一导出
 *
 * 格局判定现在优先使用 JSON 动态解析（pattern_library.json + json-evaluator）。
 * 硬编码格局文件保留作为 fallback，但默认不再使用。
 */

// 硬编码格局（保留但不默认使用）
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

// JSON 动态格局
export { evaluateCondition } from './json-evaluator'
export type { Condition, ConditionValue } from './json-evaluator'
export { getJsonPatterns, getAllJsonPatterns, clearJsonPatternsCache } from './json-patterns'

import { getJsonPatterns } from './json-patterns'
import { getPatternConfig } from '../../knowledge-dict/loader'

/**
 * 所有格局的扁平数组（优先从 JSON 动态加载）
 *
 * 每个宫位作为锚定宫位时，都使用这组格局进行独立判定。
 * JSON condition 中的 "锚定宫" 会在运行时解析为当前 anchorPalaceIndex。
 */
export const allPatterns = getJsonPatterns()

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
  const config = getPatternConfig() as { patterns?: Array<Record<string, unknown>> }
  return config.patterns?.find(p => p.id === name) ?? null
}
