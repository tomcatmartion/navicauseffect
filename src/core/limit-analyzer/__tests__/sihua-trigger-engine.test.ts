import { describe, it, expect } from 'vitest'
import type { DiZhi, MajorStar, PalaceBrightness, Stage3Input } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import {
  scoreMutagenLayerForDirection,
  matchDaXianSihuaRule,
  matchLiuNianSihuaRule,
  classifyPalaceQuality,
} from '../sihua-trigger-engine'
import { calculateDirectionMatrix } from '../fortune-engine'

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

function buildPalaceScores(ctx: ScoringContext, overrides: Record<number, number> = {}) {
  return ctx.palaces.map((_, i) => ({
    palaceIndex: i,
    finalScore: overrides[i] ?? 5,
    tone: '平',
    patterns: i === 4 ? [{ name: '测试吉格', level: '小吉' }] : [],
    bonusDetails: {} as never,
    penaltyDetails: {} as never,
    })) as unknown as Stage3Input['stage1']['palaceScores']
}

describe('sihua-trigger-engine', () => {
  it('方向矩阵随事项主宫焦点变化（官禄 vs 兄弟）', () => {
    const ctx = buildCtx([
      [{ name: '紫微' }],
      [],
      [],
      [],
      [{ name: '武曲', sihua: '化禄' }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ])
    const palaceScores = buildPalaceScores(ctx, { 4: 7.5, 0: 5 })

    const daXianMutagen = ['武曲', '破军', '廉贞', '天府'] as [string, string, string, string]
    const daXianMapping = {
      index: 1,
      ageRange: [25, 34] as [number, number],
      daXianGan: '壬' as const,
      mingPalaceName: '官禄' as const,
      palaceIndex: 8,
      mutagen: daXianMutagen,
    }

    const scoreBrother = scoreMutagenLayerForDirection(
      daXianMutagen,
      ctx,
      { primaryPalace: '兄弟', secondaryPalaces: [] },
      palaceScores,
    )
    const scoreCareer = scoreMutagenLayerForDirection(
      daXianMutagen,
      ctx,
      { primaryPalace: '官禄', secondaryPalaces: [] },
      palaceScores,
    )

    expect(scoreCareer).toBeGreaterThan(scoreBrother)

    const matrixBrother = calculateDirectionMatrix(
      daXianMapping,
      2026,
      ctx,
      undefined,
      { primaryPalace: '兄弟', secondaryPalaces: [] },
      palaceScores,
    )
    const matrixCareer = calculateDirectionMatrix(
      daXianMapping,
      2026,
      ctx,
      undefined,
      { primaryPalace: '官禄', secondaryPalaces: [] },
      palaceScores,
    )
    expect(matrixCareer).toBeTruthy()
    expect(matrixBrother).toBeTruthy()
  })

  it('大限忌化落煞宫命中「忌化引动原局煞宫」', () => {
    const ctx = buildCtx([
      [{ name: '天同', sihua: '化忌' }, { name: '擎羊' }],
      [], [], [], [], [], [], [], [], [], [], [],
    ])
    const palaceScores = buildPalaceScores(ctx, { 0: 3.5 })
    const input = {
      stage1: { scoringCtx: ctx, palaceScores },
      routeResult: { primaryPalace: '命宫' as const, secondaryPalaces: [] as const },
    } as unknown as Stage3Input

    const rule = matchDaXianSihuaRule(
      input,
      ['廉贞', '破军', '武曲', '天同'],
      false,
    )
    expect(rule.ruleKey).toBe('忌化引动原局煞宫')
    expect(rule.adjustment).toBeLessThan(0)
  })

  it('流年吉化入好宫命中「吉化多+吉化入好宫」', () => {
    const ctx = buildCtx([
      [{ name: '武曲' }, { name: '太阳' }],
      [],
      [],
      [],
      [{ name: '廉贞' }, { name: '天府' }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ])
    const palaceScores = buildPalaceScores(ctx, { 0: 6.5, 4: 7 })
    const input = {
      stage1: { scoringCtx: ctx, palaceScores },
      routeResult: { primaryPalace: '财帛' as const, secondaryPalaces: ['命宫'] as const },
    } as unknown as Stage3Input

    const rule = matchLiuNianSihuaRule(input, '甲', false, true)
    expect(rule.ruleKey).toBe('吉化多+吉化入好宫')
    expect(rule.adjustment).toBeGreaterThan(0)
  })

  it('classifyPalaceQuality 识别煞星与低分', () => {
    const ctx = buildCtx([
      [{ name: '擎羊' }],
      [], [], [], [], [], [], [], [], [], [], [],
    ])
    const palaceScores = buildPalaceScores(ctx, { 0: 6 })
    expect(classifyPalaceQuality(0, ctx, palaceScores)).toBe('bad')
  })
})
