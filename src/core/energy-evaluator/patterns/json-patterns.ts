/**
 * M2: JSON 动态格局判定
 *
 * 从 pattern_library.json 加载所有格局定义，使用通用 JSON 解析器
 * 动态生成 PatternPredicate 数组，替代硬编码的格局判定函数。
 *
 * 核心设计：
 * - 每个格局的 evaluate 函数直接调用 evaluateCondition 解析 JSON condition
 * - 所有 "锚定宫" / "锚定宫" 在运行时解析为当前 anchorPalaceIndex
 * - 支持 scope 过滤（corePalaces / otherPalaces / allPalaces）
 */

import type { PatternPredicate, PatternLevel } from './types'
import { getPatternConfig, type PatternDefinition } from '../../knowledge-dict/loader'
import { evaluateCondition } from './json-evaluator'

let _jsonPatterns: PatternPredicate[] | null = null

/**
 * 从 pattern_library.json 动态加载所有格局并生成 PatternPredicate
 */
export function getJsonPatterns(): PatternPredicate[] {
  if (_jsonPatterns !== null) return _jsonPatterns

  const config = getPatternConfig() as { patterns?: PatternDefinition[] }
  const patterns = config.patterns ?? []

  _jsonPatterns = patterns.map((def) => {
    const level = (def.level ?? '中吉') as PatternLevel
    return {
      name: def.id,
      level,
      category: def.category ?? '其他',
      evaluate(chart) {
        if (!def.condition) return false
        return evaluateCondition(chart, def.condition)
      },
    }
  })

  return _jsonPatterns
}

/**
 * 清空缓存（用于热重载）
 */
export function clearJsonPatternsCache() {
  _jsonPatterns = null
}

/**
 * 获取所有格局（JSON 动态生成 + 保留部分硬编码作为 fallback）
 *
 * 策略：
 * - JSON 中定义的格局优先使用 JSON condition 解析
 * - 如果 JSON 解析失败或条件为空，跳过该格局
 * - 保留原有硬编码格局作为补充（避免 JSON 未覆盖时丢失格局）
 */
export function getAllJsonPatterns(): PatternPredicate[] {
  return getJsonPatterns()
}
