/**
 * 1982-09-24 04:00 男命 — 锚定宫格局与能级验收
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { getPatternDefinition, getPatternMultiplierByLevel } from '@/core/knowledge-dict/loader'

const chartData = {
  solarDate: '1982-09-24',
  gender: '男',
  earthlyBranchOfSoulPalace: '未',
  earthlyBranchOfBodyPalace: '亥',
  palaces: [
    { name: '命宫', earthlyBranch: '未', heavenlyStem: '己', majorStars: [], minorStars: [], adjectiveStars: [{ name: '天月', type: 'adjective' }, { name: '天德', type: 'adjective' }, { name: '寡宿', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '父母', earthlyBranch: '申', heavenlyStem: '庚', majorStars: [], minorStars: [{ name: '文昌', brightness: '庙', type: 'soft' }, { name: '天马', type: 'soft' }], adjectiveStars: [{ name: '天姚', type: 'adjective' }, { name: '八座', type: 'adjective' }, { name: '台辅', type: 'adjective' }, { name: '天哭', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '福德', earthlyBranch: '酉', heavenlyStem: '辛', majorStars: [{ name: '廉贞', brightness: '平', type: 'major' }, { name: '破军', brightness: '陷', type: 'major' }], minorStars: [{ name: '地空', brightness: '陷', type: 'hard' }], adjectiveStars: [{ name: '天寿', type: 'adjective' }, { name: '天厨', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '田宅', earthlyBranch: '戌', heavenlyStem: '壬', majorStars: [], minorStars: [{ name: '陀罗', brightness: '庙', type: 'hard' }], adjectiveStars: [{ name: '华盖', type: 'adjective' }, { name: '天官', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '官禄', earthlyBranch: '亥', heavenlyStem: '癸', majorStars: [{ name: '天府', brightness: '得', type: 'major' }], minorStars: [{ name: '左辅', brightness: '旺', type: 'soft', mutagen: '化科' }, { name: '禄存', brightness: '庙', type: 'soft' }], adjectiveStars: [{ name: '天喜', type: 'adjective' }, { name: '天巫', type: 'adjective' }, { name: '天空', type: 'adjective' }, { name: '孤辰', type: 'adjective' }], isBodyPalace: true, decadal: null },
    { name: '仆役', earthlyBranch: '子', heavenlyStem: '甲', majorStars: [{ name: '天同', brightness: '旺', type: 'major' }, { name: '太阴', brightness: '庙', type: 'major' }], minorStars: [{ name: '擎羊', brightness: '陷', type: 'hard' }], adjectiveStars: [{ name: '天贵', type: 'adjective' }, { name: '凤阁', type: 'adjective' }, { name: '旬空', type: 'adjective' }, { name: '蜚廉', type: 'adjective' }, { name: '阴煞', type: 'adjective' }, { name: '天伤', type: 'adjective' }, { name: '年解', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '迁移', earthlyBranch: '丑', heavenlyStem: '乙', majorStars: [{ name: '武曲', brightness: '庙', type: 'major', mutagen: '化忌' }, { name: '贪狼', brightness: '庙', type: 'major' }], minorStars: [{ name: '地劫', brightness: '陷', type: 'hard' }], adjectiveStars: [{ name: '破碎', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '疾厄', earthlyBranch: '寅', heavenlyStem: '丙', majorStars: [{ name: '太阳', brightness: '旺', type: 'major' }, { name: '巨门', brightness: '庙', type: 'major' }], minorStars: [], adjectiveStars: [{ name: '解神', type: 'adjective' }, { name: '恩光', type: 'adjective' }, { name: '龙池', type: 'adjective' }, { name: '截路', type: 'adjective' }, { name: '天使', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '财帛', earthlyBranch: '卯', heavenlyStem: '丁', majorStars: [{ name: '天相', brightness: '陷', type: 'major' }], minorStars: [{ name: '右弼', brightness: '旺', type: 'soft' }, { name: '天魁', brightness: '旺', type: 'soft' }, { name: '火星', brightness: '陷', type: 'hard' }], adjectiveStars: [{ name: '咸池', type: 'adjective' }, { name: '月德', type: 'adjective' }, { name: '空亡', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '子女', earthlyBranch: '辰', heavenlyStem: '戊', majorStars: [{ name: '天机', brightness: '利', type: 'major' }, { name: '天梁', brightness: '庙', type: 'major', mutagen: '化禄' }], minorStars: [], adjectiveStars: [{ name: '封诰', type: 'adjective' }, { name: '天刑', type: 'adjective' }, { name: '天虚', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '夫妻', earthlyBranch: '巳', heavenlyStem: '己', majorStars: [{ name: '紫微', brightness: '旺', type: 'major', mutagen: '化权' }, { name: '七杀', brightness: '平', type: 'major' }], minorStars: [{ name: '天钺', brightness: '庙', type: 'soft' }, { name: '铃星', brightness: '陷', type: 'hard' }], adjectiveStars: [{ name: '红鸾', type: 'adjective' }, { name: '天才', type: 'adjective' }], isBodyPalace: false, decadal: null },
    { name: '兄弟', earthlyBranch: '午', heavenlyStem: '庚', majorStars: [], minorStars: [{ name: '文曲', brightness: '旺', type: 'soft' }], adjectiveStars: [{ name: '三台', type: 'adjective' }, { name: '天福', type: 'adjective' }], isBodyPalace: false, decadal: null },
  ],
}

const input = {
  chartData: chartData as Record<string, unknown>,
  parentBirthYears: {},
}

describe('1982-09-24 锚定宫格局与能级', () => {
  test('疾厄(7)作锚定不含官封三代（无太阳/巨门引动）', () => {
    const { scoringCtx } = executeStage1(input)
    const jiEPatterns = scoringCtx.palacePatterns![7]
    const names = jiEPatterns.map(p => p.name)

    expect(names).not.toContain('官封三代')
    expect(names).not.toContain('半空折翅')
    expect(names).not.toContain('悭吝之人')
  })

  test('命宫(0)作锚定含命无正曜', () => {
    const { scoringCtx } = executeStage1(input)
    const mingPatterns = scoringCtx.palacePatterns![0]
    expect(mingPatterns.map(p => p.name)).toContain('命无正曜')
  })

  test('锚定宫吉格写入 palaceScore 并参与 2.8 倍率（非 corePalaces 过滤）', () => {
    const { scoringCtx, palaceScores } = executeStage1(input)
    const idx = 4 // 官禄（非命宫锚定）
    const anchorPatterns = scoringCtx.palacePatterns![idx]
    const bonusPatterns = anchorPatterns.filter(p => getPatternDefinition(p.name)?.stage === 'bonus')

    expect(bonusPatterns.length).toBeGreaterThan(0)
    expect(palaceScores[idx].patterns.map(p => p.name)).toEqual(anchorPatterns.map(p => p.name))

    const expectedG = Math.max(
      ...bonusPatterns.map(p => {
        const def = getPatternDefinition(p.name)
        return def?.multiplier ?? getPatternMultiplierByLevel(p.level) ?? 1.0
      }),
    )
    expect(palaceScores[idx].bonusDetails['2.8_吉格倍率']).toBe(expectedG)
    expect(palaceScores[idx].patternMultiplier).toBe(expectedG)
  })

  test('palacePatterns 为 12×矩阵且与 allPatterns(命宫锚定)一致', () => {
    const result = executeStage1(input)
    expect(result.scoringCtx.palacePatterns).toHaveLength(12)
    expect(result.allPatterns.map(p => p.name)).toEqual(
      (result.scoringCtx.palacePatterns![0] ?? []).map(p => p.name),
    )
  })
})
