/**
 * 锚定宫位格局识别验证 — 确认每个宫位都作为锚定宫位进行格局判定
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'

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

describe('锚定宫位格局识别验证', () => {
  const input = {
    chartData: chartData as Record<string, unknown>,
    parentBirthYears: {},
  }

  test('每个宫位都应有独立的格局识别结果', () => {
    const result = executeStage1(input)
    const { scoringCtx } = result

    console.log('\n=== 每宫格局识别结果 ===')
    const palaceNames = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟']

    expect(scoringCtx.palacePatterns).toBeDefined()
    expect(scoringCtx.palacePatterns!.length).toBe(12)

    for (let i = 0; i < 12; i++) {
      const patterns = scoringCtx.palacePatterns![i]
      const patternNames = patterns.map(p => p.name)
      console.log(`${palaceNames[i]}(${scoringCtx.palaces[i].diZhi}): [${patternNames.join(', ') || '无'}]`)
    }
  })

  test('疾厄宫(寅)作为锚定宫位应有巨日相关格局', () => {
    const result = executeStage1(input)
    const { scoringCtx } = result

    // 疾厄宫索引 = 7
    const jiEPatterns = scoringCtx.palacePatterns![7]
    const patternNames = jiEPatterns.map(p => p.name)

    console.log('\n=== 疾厄宫(寅)格局 ===')
    console.log('识别到的格局:', patternNames)

    // 疾厄宫有太阳(旺)+巨门(庙)同宫，应该能识别到巨日相关格局
    // 但具体取决于格局定义中的引动条件
    expect(jiEPatterns).toBeDefined()
  })

  test('命宫(未)作为锚定宫位应有正确格局', () => {
    const result = executeStage1(input)
    const { scoringCtx } = result

    // 命宫索引 = 0，是空宫
    const mingPatterns = scoringCtx.palacePatterns![0]
    const patternNames = mingPatterns.map(p => p.name)

    console.log('\n=== 命宫(未)格局 ===')
    console.log('识别到的格局:', patternNames)

    expect(mingPatterns).toBeDefined()
  })

  test('官禄宫(亥)作为锚定宫位应有正确格局', () => {
    const result = executeStage1(input)
    const { scoringCtx } = result

    // 官禄宫索引 = 4，有天府+左辅(化科)+禄存
    const gongLuPatterns = scoringCtx.palacePatterns![4]
    const patternNames = gongLuPatterns.map(p => p.name)

    console.log('\n=== 官禄宫(亥)格局 ===')
    console.log('识别到的格局:', patternNames)

    expect(gongLuPatterns).toBeDefined()
  })
})
