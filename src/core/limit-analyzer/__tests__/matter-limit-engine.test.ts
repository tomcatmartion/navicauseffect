import { describe, it, expect } from 'vitest'
import {
  getDirectionWindowFromMatrix,
  getInnateLevelDetail,
  computeCompositeScore,
} from '@/core/knowledge-dict/limit-direction'
import { getDirectionWindow } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import type { DiZhi, PalaceBrightness, MajorStar } from '@/core/types'
import {
  buildLiuYueScoringContext,
  extractMonthlyHoroscope,
} from '../limit-scoring-context'
import {
  resolveWeightKeyToPalaces,
  weightedOriginScore,
  matchLiuYueSihuaRuleForTest,
} from '../palace-weight-resolver'

function buildCtx(starsByPalace: Array<Array<{ name: string; sihua?: '化禄' | '化权' | '化科' | '化忌' }>>): ScoringContext {
  const palaces: PalaceForScoring[] = starsByPalace.map((stars, palaceIndex) => ({
    palaceIndex,
    diZhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][palaceIndex] as DiZhi,
    brightness: '平' as PalaceBrightness,
    majorStars: stars
      .filter(s => ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'].includes(s.name))
      .map(s => ({ star: s.name as MajorStar, brightness: '平' as PalaceBrightness })),
    stars,
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

describe('matter-limit-engine helpers (limit-direction)', () => {
  it('DirectionWindow 四档与 JSON 对齐（无转机期）', () => {
    expect(getDirectionWindowFromMatrix('吉吉')).toBe('推进窗口')
    expect(getDirectionWindowFromMatrix('吉凶')).toBe('挑战期')
    expect(getDirectionWindowFromMatrix('凶吉')).toBe('蛰伏期')
    expect(getDirectionWindowFromMatrix('凶凶')).toBe('风险期')
    expect(getDirectionWindow('吉凶')).toBe('挑战期')
  })

  it('innateLevelMap 映射结构化字段', () => {
    const detail = getInnateLevelDetail(7.8)
    expect(detail.level).toBe('实旺')
    expect(detail.carryingCapacity).toBeTruthy()
    expect(detail.advice).toBeTruthy()
  })

  it('compositeScoring 加权求和', () => {
    const score = computeCompositeScore(6, 4, 3, 2)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(10)
  })
})

describe('palace-weight-resolver', () => {
  it('科星落位宫解析为生年化科所在宫', () => {
    const ctx = buildCtx([
      [], [], [], [], [], [],
      [{ name: '太阳', sihua: '化科' }],
      [], [], [], [], [],
    ])
    expect(resolveWeightKeyToPalaces('科星落位宫', ctx)).toEqual(['迁移'])
  })

  it('太阳落位宫解析为太阳所在宫', () => {
    const ctx = buildCtx([
      [{ name: '太阳' }], [], [], [], [], [], [], [], [], [], [], [],
    ])
    expect(resolveWeightKeyToPalaces('太阳落位宫', ctx)).toEqual(['命宫'])
  })

  it('求名原局加权包含科星落位宫权重', () => {
    const ctx = buildCtx([
      [{ name: '紫微' }],
      [],
      [],
      [],
      [{ name: '天府' }],
      [],
      [{ name: '太阳', sihua: '化科' }],
      [],
      [],
      [],
      [],
      [],
    ])
    const palaceScores = ctx.palaces.map((_, i) => ({
      palaceIndex: i,
      finalScore: i === 4 ? 8 : i === 6 ? 7 : 5,
      tone: '平',
      patterns: [],
      bonusDetails: {} as never,
      penaltyDetails: {} as never,
    }))
    const score = weightedOriginScore('求名', ctx, palaceScores as never)
    expect(score).toBeGreaterThan(5)
    expect(score).toBeLessThan(8)
  })
})

describe('liuYue horoscope integration', () => {
  it('extractMonthlyHoroscope 读取 monthly 四化', () => {
    const snap = extractMonthlyHoroscope({
      horoscope: {
        monthly: {
          heavenlyStem: '庚',
          mutagen: ['太阳', '武曲', '太阴', '天同'],
        },
      },
    })
    expect(snap?.heavenlyStem).toBe('庚')
    expect(snap?.mutagen[3]).toBe('天同')
  })

  it('buildLiuYueScoringContext 叠流月四化', () => {
    const natal = buildCtx([
      [{ name: '天同' }],
      [], [], [], [], [], [], [], [], [], [], [],
    ])
    const ctx = buildLiuYueScoringContext(
      { heavenlyStem: '庚', mutagen: ['太阳', '武曲', '太阴', '天同'] },
      natal,
    )
    expect(ctx?.palaces[0].stars.find(s => s.name === '天同')?.sihua).toBe('化忌')
    expect(ctx?.palaces[0].stars.find(s => s.name === '天同')?.sihuaSource).toBe('流月')
  })

  it('matchLiuYueSihuaRule 识别忌化引动事项宫', () => {
    const natal = buildCtx([
      [{ name: '天同' }],
      [], [], [], [], [], [], [], [], [], [], [],
    ])
    const rule = matchLiuYueSihuaRuleForTest(
      '命宫',
      natal,
      { heavenlyStem: '庚', mutagen: ['太阳', '武曲', '太阴', '天同'] },
    )
    expect(rule.ruleKey).toBe('忌化引动事项宫')
    expect(rule.adjustment).toBe(-0.5)
  })
})
