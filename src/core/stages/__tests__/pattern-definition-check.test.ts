/**
 * 验证 getPatternDefinition 是否能正确找到格局定义
 */

import { describe, test, expect } from 'vitest'
import { getPatternDefinition } from '@/core/knowledge-dict/loader'

describe('格局定义查找验证', () => {
  test('应能找到命无正曜的定义', () => {
    const def = getPatternDefinition('命无正曜')
    console.log('命无正曜定义:', def)
    expect(def).toBeDefined()
    expect(def?.stage).toBe('penalty')
    expect(def?.scope).toBe('corePalaces')
  })

  test('应能找到日月并明的定义', () => {
    const def = getPatternDefinition('日月并明')
    console.log('日月并明定义:', def)
    expect(def).toBeDefined()
    expect(def?.stage).toBe('bonus')
    expect(def?.scope).toBe('corePalaces')
  })

  test('应能找到府相朝垣的定义', () => {
    const def = getPatternDefinition('府相朝垣')
    console.log('府相朝垣定义:', def)
    expect(def).toBeDefined()
    expect(def?.stage).toBe('bonus')
    expect(def?.scope).toBe('corePalaces')
  })

  test('应能找到官封三代的定义', () => {
    const def = getPatternDefinition('官封三代')
    console.log('官封三代定义:', def)
    expect(def).toBeDefined()
    expect(def?.stage).toBe('bonus')
  })
})
