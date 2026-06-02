import { describe, it, expect } from 'vitest'
import type { DiZhi, MajorStar, PalaceBrightness } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { mapToneToBriefLevel, scorePalacesToBrief } from '../limit-layer-scoring'

function buildCtx(): ScoringContext {
  const palaces: PalaceForScoring[] = Array.from({ length: 12 }, (_, palaceIndex) => ({
    palaceIndex,
    diZhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][palaceIndex] as DiZhi,
    brightness: '平' as PalaceBrightness,
    majorStars: palaceIndex === 0
      ? [{ star: '紫微' as MajorStar, brightness: '庙' as PalaceBrightness }]
      : [],
    stars: palaceIndex === 0 ? [{ name: '紫微' }] : [],
    hasLuCun: false,
  }))
  return {
    skeletonId: 'P01',
    palaces,
    birthGan: '甲',
    taiSuiZhi: '子',
    patterns: [],
  }
}

describe('limit-layer-scoring', () => {
  it('mapToneToBriefLevel 三档映射', () => {
    expect(mapToneToBriefLevel('实旺')).toBe('吉旺')
    expect(mapToneToBriefLevel('磨炼')).toBe('平')
    expect(mapToneToBriefLevel('凶危')).toBe('凶弱')
  })

  it('scorePalacesToBrief 返回 12 宫', () => {
    const briefs = scorePalacesToBrief(buildCtx())
    expect(briefs).toHaveLength(12)
    expect(briefs[0]?.palaceName).toBe('命宫')
    expect(briefs[0]?.score).toBeGreaterThan(0)
  })

  it('null ctx 返回空数组', () => {
    expect(scorePalacesToBrief(null)).toEqual([])
  })
})
