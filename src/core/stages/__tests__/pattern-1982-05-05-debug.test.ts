/**
 * 1982年5月5日18点男性命盘 — 机梁羊刑克见孤格局详细验证
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { getSanFangSiZheng } from '@/core/energy-evaluator/patterns/types'

const chartData = {
  solarDate: '1982-05-05',
  gender: '男',
  earthlyBranchOfSoulPalace: '申',
  earthlyBranchOfBodyPalace: '寅',
  palaces: [
    { name: '命宫', earthlyBranch: '申', heavenlyStem: '壬', majorStars: [{ name: '天同', brightness: '利', type: 'major' }, { name: '天梁', brightness: '庙', type: 'major' }], minorStars: [{ name: '天马', type: 'soft' }, { name: '天姚', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '父母', earthlyBranch: '酉', heavenlyStem: '癸', majorStars: [{ name: '武曲', brightness: '得', type: 'major' }, { name: '七杀', brightness: '旺', type: 'major' }], minorStars: [], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '福德', earthlyBranch: '戌', heavenlyStem: '甲', majorStars: [{ name: '太阳', brightness: '不', type: 'major' }], minorStars: [{ name: '文昌', brightness: '庙', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '田宅', earthlyBranch: '亥', heavenlyStem: '乙', majorStars: [{ name: '破军', brightness: '陷', type: 'major' }], minorStars: [{ name: '文曲', brightness: '旺', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '官禄', earthlyBranch: '子', heavenlyStem: '丙', majorStars: [{ name: '天机', brightness: '旺', type: 'major' }], minorStars: [{ name: '擎羊', brightness: '庙', type: 'hard' }, { name: '铃星', brightness: '旺', type: 'hard' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '仆役', earthlyBranch: '丑', heavenlyStem: '丁', majorStars: [], minorStars: [], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '迁移', earthlyBranch: '寅', heavenlyStem: '戊', majorStars: [], minorStars: [{ name: '地劫', brightness: '陷', type: 'hard' }], adjectiveStars: [], isBodyPalace: true, decadal: null },
    { name: '疾厄', earthlyBranch: '卯', heavenlyStem: '己', majorStars: [{ name: '廉贞', brightness: '平', type: 'major' }, { name: '贪狼', brightness: '旺', type: 'major' }], minorStars: [], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '财帛', earthlyBranch: '辰', heavenlyStem: '庚', majorStars: [{ name: '太阴', brightness: '庙', type: 'major' }], minorStars: [{ name: '天魁', brightness: '旺', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '子女', earthlyBranch: '巳', heavenlyStem: '辛', majorStars: [], minorStars: [{ name: '天钺', brightness: '庙', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '夫妻', earthlyBranch: '午', heavenlyStem: '壬', majorStars: [{ name: '紫微', brightness: '旺', type: 'major' }], minorStars: [], adjectiveStars: [], isBodyPalace: false, decadal: null },
    { name: '兄弟', earthlyBranch: '未', heavenlyStem: '癸', majorStars: [{ name: '天府', brightness: '庙', type: 'major' }], minorStars: [{ name: '左辅', brightness: '旺', type: 'soft' }], adjectiveStars: [], isBodyPalace: false, decadal: null },
  ],
}

describe('1982年5月5日18点男性 — 机梁羊刑克见孤验证', () => {
  const input = {
    chartData: chartData as Record<string, unknown>,
    parentBirthYears: {},
  }

  test('应输出命宫三方四正星曜分布', () => {
    const result = executeStage1(input)
    const chart = result.scoringCtx
    const palaces = chart.palaces

    console.log('\n=== 1982年5月5日命盘 ===')
    console.log('命宫索引:', 0, '地支:', palaces[0]?.diZhi)

    const sf = getSanFangSiZheng({
      getOppositeIndex: (i: number) => (i + 6) % 12,
      getTrineIndices: (i: number) => [(i + 4) % 12, (i + 8) % 12],
      getStarsInPalace: () => [],
      getAuxStarsInPalace: () => [],
      hasStarInPalace: () => false,
      hasSihuaInPalace: () => false,
      getPalaceBrightness: () => '平',
      getPalaceDiZhi: () => '子',
    } as unknown as Parameters<typeof getSanFangSiZheng>[0], 0)

    console.log('三方四正宫位索引:', sf)
    for (const idx of sf) {
      const p = palaces[idx]
      const stars = p.stars.map((s: { name: string; sihua?: string }) => s.name + (s.sihua ? `(${s.sihua})` : '')).join(', ')
      console.log(`  ${idx}宫(${p.diZhi}): ${stars || '(空)'}`)
    }

    expect(sf.length).toBe(4)
  })

  test('应正确识别机梁羊刑克见孤格局', () => {
    const result = executeStage1(input)
    const patternNames = result.allPatterns.map(p => p.name)

    console.log('\n=== 识别到的格局 ===')
    for (const p of result.allPatterns) {
      console.log(`  [${p.level}] ${p.name} (${p.category}) - 倍率:${p.multiplier}`)
    }

    // 验证机梁羊刑克见孤被识别
    expect(patternNames).toContain('机梁羊刑克见孤')

    // 找到该格局的详细信息
    const pattern = result.allPatterns.find(p => p.name === '机梁羊刑克见孤')
    expect(pattern).toBeDefined()
    expect(pattern?.level).toBe('中凶')
    expect(pattern?.category).toBe('机梁同')
  })

  test('应验证机梁羊刑克见孤的成格条件', () => {
    const result = executeStage1(input)
    const chart = result.scoringCtx
    const palaces = chart.palaces

    // 手动验证成格条件
    // 命宫三方四正 = 命宫(0) + 对宫迁移(6) + 三合官禄(4) + 三合财帛(8)
    const mingIdx = 0
    const sf = [mingIdx, (mingIdx + 6) % 12, (mingIdx + 4) % 12, (mingIdx + 8) % 12]

    const targetStars = ['天机', '天梁', '擎羊', '陀罗']
    const foundStars: string[] = []

    for (const star of targetStars) {
      for (const idx of sf) {
        const p = palaces[idx]
        const hasStar = p.stars.some((s: { name: string }) => s.name === star)
        if (hasStar) {
          foundStars.push(`${star}(${p.diZhi}宫)`)
          break
        }
      }
    }

    console.log('\n=== 机梁羊刑克见孤成格验证 ===')
    console.log('目标星曜:', targetStars.join(', '))
    console.log('在三方四正中找到的星曜:', foundStars.join(', '))
    console.log('找到数量:', foundStars.length)

    // 天机在官禄宫(子)，天梁在命宫(申)，擎羊在官禄宫(子)
    // 至少3颗在命宫三方四正
    expect(foundStars.length).toBeGreaterThanOrEqual(3)
  })
})
