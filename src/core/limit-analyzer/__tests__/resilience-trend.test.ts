import { describe, it, expect } from 'vitest'
import { evaluateLifeTrend, evaluateCapabilityMatch } from '../resilience-evaluator'

describe('resilience trend helpers', () => {
  it('evaluateLifeTrend', () => {
    expect(evaluateLifeTrend('吉旺', '凶弱')).toBe('先升后降')
    expect(evaluateLifeTrend('凶弱', '吉旺')).toBe('先抑后扬')
    expect(evaluateLifeTrend('平', '平')).toBe('平稳')
  })

  it('evaluateCapabilityMatch', () => {
    expect(evaluateCapabilityMatch('凶弱', '凶弱')).toBe('能力不足')
    expect(evaluateCapabilityMatch('吉旺', '吉旺')).toBe('能力超配')
    expect(evaluateCapabilityMatch('平', '平')).toBe('匹配')
  })
})
