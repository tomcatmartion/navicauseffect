/**
 * 1982年5月5日18点男性命盘格局识别验证
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'

describe('1982年5月5日18点男性命盘格局识别', () => {
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

  const input = {
    chartData: chartData as Record<string, unknown>,
    parentBirthYears: {},
  }

  test('应该正确识别机月同梁格局', () => {
    const result = executeStage1(input)
    const patternNames = result.allPatterns.map(p => p.name)

    console.log('识别到的格局:', patternNames)

    expect(patternNames).toContain('机月同梁')
  })

  test('机月同梁格局不应重复识别', () => {
    const result = executeStage1(input)
    const patternNames = result.allPatterns.map(p => p.name)

    // 机月同梁只应出现一次
    const jiYueCount = patternNames.filter(n => n === '机月同梁').length
    expect(jiYueCount).toBe(1)
  })
})
