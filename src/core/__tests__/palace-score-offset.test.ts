/**
 * PalaceEnergyIndex 专项测试
 *
 * 验证地支宫位能级索引的核心功能：
 * - 宫位能级得分绑定在地支宫位上
 * - 层偏移量正确映射功能宫名到地支位置
 * - toLayerBriefs 返回层内视角的正确数据
 */
import { describe, it, expect } from 'vitest'
import type { DiZhi, MajorStar, PalaceBrightness, PalaceName } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { PalaceEnergyIndex } from '@/core/energy-evaluator/palace-energy-index'
import { PALACE_NAME_TO_INDEX } from '@/core/types'

/**
 * 构建一个测试用 ScoringContext，12宫按标准地支排列
 */
function buildTestCtx(): ScoringContext {
  const diZhiList: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const palaces: PalaceForScoring[] = diZhiList.map((dz, palaceIndex) => ({
    palaceIndex,
    diZhi: dz,
    brightness: '平' as PalaceBrightness,
    majorStars: palaceIndex === 0
      ? [{ star: '紫微' as MajorStar, brightness: '旺' as PalaceBrightness }]
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

describe('PalaceEnergyIndex — 静态映射方法', () => {
  it('mapToNatalIndex: 原局 offset=0 时映射不变', () => {
    expect(PalaceEnergyIndex.mapToNatalIndex('命宫', 0)).toBe(0)
    expect(PalaceEnergyIndex.mapToNatalIndex('官禄', 0)).toBe(4)
    expect(PalaceEnergyIndex.mapToNatalIndex('财帛', 0)).toBe(8)
  })

  it('mapToNatalIndex: 大限 offset=3 时正确映射', () => {
    expect(PalaceEnergyIndex.mapToNatalIndex('命宫', 3)).toBe(3)
    expect(PalaceEnergyIndex.mapToNatalIndex('官禄', 3)).toBe(7)
    expect(PalaceEnergyIndex.mapToNatalIndex('财帛', 3)).toBe(11)
    expect(PalaceEnergyIndex.mapToNatalIndex('夫妻', 3)).toBe(1)
  })

  it('mapToNatalIndex: 流年 offset=6 时正确映射', () => {
    expect(PalaceEnergyIndex.mapToNatalIndex('命宫', 6)).toBe(6)
    expect(PalaceEnergyIndex.mapToNatalIndex('官禄', 6)).toBe(10)
    expect(PalaceEnergyIndex.mapToNatalIndex('夫妻', 6)).toBe(4)
  })

  it('mapToLayerPalaceName: 反向映射正确', () => {
    expect(PalaceEnergyIndex.mapToLayerPalaceName(3, 3)).toBe('命宫')
    expect(PalaceEnergyIndex.mapToLayerPalaceName(7, 3)).toBe('官禄')
    expect(PalaceEnergyIndex.mapToLayerPalaceName(11, 3)).toBe('财帛')
  })
})

describe('PalaceEnergyIndex — 实例方法', () => {
  const ctx = buildTestCtx()
  const natalScores = evaluateAllPalaces(ctx)
  const index = new PalaceEnergyIndex(natalScores)

  it('getByNatalIndex: 按原局索引取 PalaceScore', () => {
    const score = index.getByNatalIndex(0)
    expect(score.palace).toBe('命宫')
    expect(score.finalScore).toBeGreaterThan(0)
  })

  it('getByLayerPalace: 原局 offset=0 取原局官禄宫', () => {
    const score = index.getByLayerPalace('官禄', 0)
    expect(score).toBe(natalScores[4])
    expect(score.palace).toBe('官禄')
  })

  it('getByLayerPalace: 大限 offset=3 取原局 index 7 的分数', () => {
    const score = index.getByLayerPalace('官禄', 3)
    expect(score).toBe(natalScores[7])
  })

  it('getByLayerPalace: 流年 offset=6 取原局 index 10 的分数', () => {
    const score = index.getByLayerPalace('夫妻', 6)
    expect(score).toBe(natalScores[4])
  })

  it('getByNatalIndex 边界: index 12 回绕到 0', () => {
    expect(index.getByNatalIndex(12)).toBe(natalScores[0])
  })

  it('toLayerBriefs: offset=0 返回12宫摘要，与原局对齐', () => {
    const briefs = index.toLayerBriefs(0)
    expect(briefs).toHaveLength(12)
    expect(briefs[4]!.palaceName).toBe('官禄')
    expect(briefs[4]!.score).toBe(natalScores[4]!.finalScore)
  })

  it('toLayerBriefs: offset=3 大限视角', () => {
    const briefs = index.toLayerBriefs(3)
    // briefs[4] = 大限官禄宫 = natalScores[7]
    expect(briefs[4]!.palaceName).toBe('官禄')
    expect(briefs[4]!.score).toBe(natalScores[7]!.finalScore)
  })

  it('toLayerBriefs: offset=0 和 offset=3 命宫分数不同（地支绑定）', () => {
    const briefs0 = index.toLayerBriefs(0)
    const briefs3 = index.toLayerBriefs(3)
    // offset=0: 命宫 = natalScores[0] (紫微所在，有加成)
    // offset=3: 命宫 = natalScores[3] (空宫，无主星)
    expect(briefs0[0]!.score).not.toBe(briefs3[0]!.score)
  })

  it('toLayerBriefs: offset=6 夫妻宫 = natalScores[(6+10)%12=4]', () => {
    const briefs = index.toLayerBriefs(6)
    expect(briefs[10]!.score).toBe(natalScores[4]!.finalScore)
  })
})
