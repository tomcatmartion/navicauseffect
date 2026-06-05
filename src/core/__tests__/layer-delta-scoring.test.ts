/**
 * 层增量评分（Delta Scoring）测试
 *
 * 验证增量评分算法的正确性：
 * 1. 基础增量：只影响含四化星的三方四正宫位
 * 2. 加分/减分分值精确
 * 3. 天花板截断
 * 4. 链式叠加：原局 → 大限 → 流年
 * 5. 流年额外星曜
 */

import { describe, it, expect } from 'vitest'
import type { DiZhi, PalaceBrightness, MajorStar, SihuaType } from '@/core/types'
import type {
  ScoringContext,
  PalaceForScoring,
  StarInPalaceForScoring,
} from '@/core/energy-evaluator/scoring-flow'
import type { PalaceScore } from '@/core/types'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import {
  computeSingleLayerDelta,
  computeAllLayerDeltas,
  scoreLayerByDelta,
  combineBaseWithDelta,
  buildDeltaLayerBriefs,
  type LayerDeltaConfig,
} from '@/core/energy-evaluator/layer-delta-scoring'

// ═══════════════════════════════════════════════════════════
// 测试工具函数
// ═══════════════════════════════════════════════════════════

const DI_ZHI_LIST: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** 构建最小测试用 ScoringContext */
function buildTestCtx(overrides?: {
  stars?: Partial<Record<number, StarInPalaceForScoring[]>>
  birthGan?: string
}): ScoringContext {
  const palaces: PalaceForScoring[] = DI_ZHI_LIST.map((dz, i) => ({
    palaceIndex: i,
    diZhi: dz,
    brightness: '平' as PalaceBrightness,
    majorStars: [],
    stars: overrides?.stars?.[i] ?? [],
    hasLuCun: false,
  }))
  return {
    skeletonId: 'P01',
    palaces,
    birthGan: (overrides?.birthGan ?? '甲') as ScoringContext['birthGan'],
    taiSuiZhi: '子',
    patterns: [],
  }
}

/** 构建一个带大限四化的 ScoringContext（模拟 buildDaXianScoringContext） */
function buildDaXianTestCtx(
  natalCtx: ScoringContext,
  sihua: { lu?: string; quan?: string; ke?: string; ji?: string },
): ScoringContext {
  const palaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const mapping: { star: string; type: SihuaType }[] = []
  if (sihua.lu) mapping.push({ star: sihua.lu, type: '化禄' })
  if (sihua.quan) mapping.push({ star: sihua.quan, type: '化权' })
  if (sihua.ke) mapping.push({ star: sihua.ke, type: '化科' })
  if (sihua.ji) mapping.push({ star: sihua.ji, type: '化忌' })

  for (const { star, type } of mapping) {
    for (const palace of palaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '大限'
        }
      }
    }
  }

  return {
    ...natalCtx,
    palaces,
    birthGan: '壬' as ScoringContext['birthGan'],
  }
}

/** 构建一个带流年四化的 ScoringContext（模拟 buildYearlyScoringContext） */
function buildLiuNianTestCtx(
  baseCtx: ScoringContext,
  sihua: { lu?: string; quan?: string; ke?: string; ji?: string },
): ScoringContext {
  const palaces: PalaceForScoring[] = baseCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const mapping: { star: string; type: SihuaType }[] = []
  if (sihua.lu) mapping.push({ star: sihua.lu, type: '化禄' })
  if (sihua.quan) mapping.push({ star: sihua.quan, type: '化权' })
  if (sihua.ke) mapping.push({ star: sihua.ke, type: '化科' })
  if (sihua.ji) mapping.push({ star: sihua.ji, type: '化忌' })

  for (const { star, type } of mapping) {
    for (const palace of palaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '流年'
        }
      }
    }
  }

  return {
    ...baseCtx,
    palaces,
    birthGan: '丙' as ScoringContext['birthGan'],
  }
}

/** 创建模拟的原局 PalaceScore 数组（12宫，全部 same score） */
function createMockBaseScores(finalScore: number, ceiling: number = 8.0): PalaceScore[] {
  return DI_ZHI_LIST.map((dz, i) => ({
    palace: `宫${i}` as PalaceScore['palace'],
    diZhi: dz,
    majorStars: [],
    skeletonScore: finalScore,
    ceiling,
    bonusTotal: 0,
    penaltyTotal: 0,
    luCunDelta: 0,
    finalScore,
    tone: '磨炼' as PalaceScore['tone'],
    subdueLevel: '无' as PalaceScore['subdueLevel'],
    patterns: [],
    patternMultiplier: 1.0,
    criticalStatus: '无临界' as PalaceScore['criticalStatus'],
    isAbsoluteFail: false,
    specialFlags: [],
    scoreAfterBonus: finalScore,
    scoreAfterPenalty: finalScore,
    scoreAfterLuCun: finalScore,
    warmCoolLabel: '平' as PalaceScore['warmCoolLabel'],
    bonusDetails: {} as PalaceScore['bonusDetails'],
    penaltyDetails: {} as PalaceScore['penaltyDetails'],
    flankingPairs: [],
  })) as PalaceScore[]
}

// ═══════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════

describe('layer-delta-scoring', () => {
  describe('computeSingleLayerDelta', () => {
    it('无四化时增量为零', () => {
      const natalCtx = buildTestCtx()
      const baseScores = createMockBaseScores(5.0)

      const result = computeSingleLayerDelta({
        baseScore: 5.0,
        natalPalaceIndex: 0,
        layerCtx: natalCtx,
        layerLabel: '大限',
        ceiling: 8.0,
      })

      expect(result.rawDelta).toBe(0)
      expect(result.finalScore).toBe(5.0)
      expect(result.tone).toBe('磨炼')
    })

    it('大限化禄落入本宫 → base + 0.5', () => {
      // 宫0（子）有紫微星，大限化禄落在紫微上
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })

      const result = computeSingleLayerDelta({
        baseScore: 5.0,
        natalPalaceIndex: 0,
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: 8.0,
      })

      // 化禄在本宫: +0.5 × 1.0 (本宫衰减) = +0.5
      expect(result.bonusDelta).toBeCloseTo(0.5, 1)
      expect(result.finalScore).toBeCloseTo(5.5, 1)
    })

    it('大限化忌落入本宫 → base - 0.5 × intensityFactor', () => {
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { ji: '紫微' })

      const result = computeSingleLayerDelta({
        baseScore: 5.0,
        natalPalaceIndex: 0,
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: 8.0,
      })

      // 加分阶段无四化 → 旺弱不变(平) → intensityFactor=0.7
      // 化忌在本宫: -0.5 × 1.0 × 0.7 = -0.35
      expect(result.penaltyDelta).toBeLessThan(0)
      expect(result.finalScore).toBeLessThan(5.0)
    })

    it('天花板截断', () => {
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })

      const result = computeSingleLayerDelta({
        baseScore: 7.8, // 接近天花板
        natalPalaceIndex: 0,
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: 8.0, // 天花板 8.0
      })

      // 7.8 + 0.5 = 8.3 → 截断到 8.0
      expect(result.finalScore).toBe(8.0)
    })

    it('对宫四化使用衰减系数 0.8', () => {
      // 宫6（午）有紫微星，宫0的化禄落入对宫(宫6)
      const natalCtx = buildTestCtx({
        stars: {
          6: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })

      const result = computeSingleLayerDelta({
        baseScore: 5.0,
        natalPalaceIndex: 0, // 宫0的视角，对宫是宫6
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: 8.0,
      })

      // 化禄在对宫: +0.5 × 0.8 = +0.4
      expect(result.bonusDelta).toBeCloseTo(0.4, 1)
      expect(result.finalScore).toBeCloseTo(5.4, 1)
    })

    it('三合宫四化使用衰减系数 0.7', () => {
      // 宫4（辰）有紫微星，宫0的化禄落入三合(宫4)
      const natalCtx = buildTestCtx({
        stars: {
          4: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })

      const result = computeSingleLayerDelta({
        baseScore: 5.0,
        natalPalaceIndex: 0, // 宫0的三合: 宫4, 宫8
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: 8.0,
      })

      // 化禄在三合: +0.5 × 0.7 = +0.35
      expect(result.bonusDelta).toBeCloseTo(0.35, 1)
    })
  })

  describe('computeAllLayerDeltas', () => {
    it('无层上下文时返回零增量', () => {
      const baseScores = createMockBaseScores(5.0)

      const deltas = computeAllLayerDeltas(baseScores, {
        layerCtx: null,
        layerLabel: '大限',
      })

      expect(deltas).toHaveLength(12)
      deltas.forEach(d => {
        expect(d.rawDelta).toBe(0)
        expect(d.finalScore).toBe(5.0)
      })
    })

    it('12宫批量增量返回正确数量', () => {
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
          6: [{ name: '太阳' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微', ji: '太阳' })
      const baseScores = createMockBaseScores(5.0)

      const deltas = computeAllLayerDeltas(baseScores, {
        layerCtx: daXianCtx,
        layerLabel: '大限',
      })

      expect(deltas).toHaveLength(12)
    })
  })

  describe('scoreLayerByDelta', () => {
    it('返回完整 PalaceScore[] 可传入 PalaceEnergyIndex', () => {
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })
      const baseScores = evaluateAllPalaces(natalCtx)

      const layerScores = scoreLayerByDelta(baseScores, {
        layerCtx: daXianCtx,
        layerLabel: '大限',
      })

      expect(layerScores).toHaveLength(12)
      // 宫0（紫微所在）的得分应该比原局高
      expect(layerScores[0]!.finalScore).toBeGreaterThan(baseScores[0]!.finalScore)
      // 其他宫位不受影响（假设三方四正内没有紫微）
    })
  })

  describe('combineBaseWithDelta', () => {
    it('合并后保留原局基础信息', () => {
      const baseScores = createMockBaseScores(5.0)
      const deltas = computeAllLayerDeltas(baseScores, {
        layerCtx: null,
        layerLabel: '大限',
      })

      const combined = combineBaseWithDelta(baseScores, deltas)
      expect(combined).toHaveLength(12)
      // 零增量时结果应该等于原局
      combined.forEach((s, i) => {
        expect(s.finalScore).toBe(baseScores[i]!.finalScore)
      })
    })
  })

  describe('buildDeltaLayerBriefs', () => {
    it('返回 12 个 PalaceScoreBrief', () => {
      const baseScores = createMockBaseScores(5.0)
      const natalCtx = buildTestCtx()

      const briefs = buildDeltaLayerBriefs(baseScores, {
        layerCtx: natalCtx,
        layerLabel: '大限',
      })

      expect(briefs).toHaveLength(12)
      briefs.forEach(b => {
        expect(b).toHaveProperty('palaceIndex')
        expect(b).toHaveProperty('palaceName')
        expect(b).toHaveProperty('score')
        expect(b).toHaveProperty('level')
      })
    })
  })

  describe('链式叠加：原局 → 大限 → 流年', () => {
    it('流年在当前大限的基础上继续叠加', () => {
      // 宫0有紫微，大限化禄在紫微；宫0还有天梁，流年化禄在天梁
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }, { name: '天梁' }],
        },
      })

      // 大限：紫微化禄
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })
      // 流年：天梁化禄（在大限基础上）
      const liuNianCtx = buildLiuNianTestCtx(daXianCtx, { lu: '天梁' })

      const natalScores = evaluateAllPalaces(natalCtx)

      // 大限增量
      const daXianScores = scoreLayerByDelta(natalScores, {
        layerCtx: daXianCtx,
        layerLabel: '大限',
      })

      // 流年增量（在大限基础上）
      const liuNianScores = scoreLayerByDelta(daXianScores, {
        layerCtx: liuNianCtx,
        layerLabel: '流年',
      })

      // 验证链式递增：原局 < 大限 < 流年（宫0本宫）
      expect(daXianScores[0]!.finalScore).toBeGreaterThan(natalScores[0]!.finalScore)
      expect(liuNianScores[0]!.finalScore).toBeGreaterThan(daXianScores[0]!.finalScore)
    })

    it('无四化的宫位在各层间得分不变', () => {
      const natalCtx = buildTestCtx({
        stars: {
          0: [{ name: '紫微' }],
          // 宫1 没有任何星曜，也不是宫0的三方四正
        },
      })
      const daXianCtx = buildDaXianTestCtx(natalCtx, { lu: '紫微' })

      const natalScores = evaluateAllPalaces(natalCtx)
      const daXianScores = scoreLayerByDelta(natalScores, {
        layerCtx: daXianCtx,
        layerLabel: '大限',
      })

      // 宫1 不在宫0的三方四正内（宫0的三方四正: 0,6,4,8），也不在大限四化影响范围
      // 宫1 是否受影响取决于它的三方四正是否包含宫0
      // 宫1的三方四正: 1,7,5,9 → 不包含宫0 → 不受影响
      expect(daXianScores[1]!.finalScore).toBe(natalScores[1]!.finalScore)
    })
  })
})
