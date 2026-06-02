import { describe, it, expect } from 'vitest'
import { evaluateResilience } from '../resilience-evaluator'
import { getCausalChainTemplate, getMatrixStressValue } from '@/core/knowledge-dict/limit-direction'
import { slimEventDescriptions } from '../event-description-slimmer'
import type { PalaceScore } from '@/core/types'

describe('resilience-evaluator', () => {
  it('低命宫 + 凶凶矩阵 → 危机干预', () => {
    const result = evaluateResilience(4, '凶凶')
    expect(result.strategy).toBe('危机干预')
    expect(result.score).toBeLessThan(3)
    expect(result.promptSuffix.length).toBeGreaterThan(0)
  })

  it('高命宫 + 吉吉矩阵 → 赋能性咨询', () => {
    const result = evaluateResilience(8, '吉吉')
    expect(result.strategy).toBe('赋能性咨询')
  })
})

describe('limit-direction extended fields', () => {
  it('causalChainTemplates 与 matrixStressValues 可读', () => {
    expect(getCausalChainTemplate('吉凶')).toContain('吉处藏凶')
    expect(getMatrixStressValue('凶凶')).toBe(5)
  })
})

describe('event-description-slimmer', () => {
  it('求财财帛应返回最多 3 条断语', () => {
    const palaceScores = Array.from({ length: 12 }, (_, i) => ({
      palaceIndex: i,
      palace: ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'][i],
      finalScore: 6,
      tone: '平',
      warmCoolLabel: '平' as const,
      majorStars: i === 4 ? [{ star: '天府' as const, brightness: '庙' as const }] : [],
      patterns: [],
      bonusDetails: {} as never,
      penaltyDetails: {} as never,
    })) as unknown as PalaceScore[]

    const lines = slimEventDescriptions('求财', '财帛', [], palaceScores)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(3)
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80)
    }
  })
})
