/**
 * pattern_library.json condition 算子审计 — 确保 JSON 中使用的算子均有实现
 */

import { describe, test, expect } from 'vitest'
import patternLibrary from '../../../../../data/pattern_library.json'

const IMPLEMENTED_OPERATORS = new Set([
  'and', 'or', 'any', 'not',
  'clampStars', 'palaceBrightness', 'palaceMajorEmpty',
  'sameSourceSanJi', 'shengNianGan', 'palaceHasJiHua',
  'starInPalace', 'anyStarInPalace', 'star', 'palaceName', 'dizhi', 'brightness',
  'anyStarInTriples', 'allStarsInTriples', 'countStarsInTriples', 'basePalace', 'samePalace',
  'starIn',
  // 新增算子
  'sihuaInTriples', 'sihuaInPalace', 'starSihua', 'hasLuInTriples',
  'jiGeYinDong', 'xiongGeYinDong',
])

const STRUCTURAL_KEYS = new Set(['stars', 'min', 'max', 'left', 'right', 'target', 'source', 'types', 'type', 'scope', 'in'])

function collectConditionKeys(node: unknown, found: Set<string>): void {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach(item => collectConditionKeys(item, found))
    return
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (!STRUCTURAL_KEYS.has(key)) found.add(key)
    collectConditionKeys(value, found)
  }
}

describe('pattern_library.json condition 算子', () => {
  test('所有 condition 算子均有 json-evaluator 实现', () => {
    const used = new Set<string>()
    const patterns = (patternLibrary as { patterns: Array<{ condition?: unknown }> }).patterns
    for (const p of patterns) {
      collectConditionKeys(p.condition, used)
    }

    const unknown = [...used].filter(k => !IMPLEMENTED_OPERATORS.has(k))
    expect(unknown, `未实现算子: ${unknown.join(', ')}`).toEqual([])
  })
})
