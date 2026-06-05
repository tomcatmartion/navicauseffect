/**
 * 调试 isCorePalace 函数
 */

import { describe, test, expect } from 'vitest'
import { getPatternDefinition } from '@/core/knowledge-dict/loader'

describe('调试 isCorePalace', () => {
  test('检查格局定义', () => {
    const patterns = ['命无正曜', '日月并明', '府相朝垣', '官封三代']
    for (const name of patterns) {
      const def = getPatternDefinition(name)
      console.log(`${name}:`, def)
    }
    expect(true).toBe(true)
  })
})
