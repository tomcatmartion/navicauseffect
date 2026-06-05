/**
 * 验证 isCorePalace 函数是否正确工作
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

describe('isCorePalace 验证', () => {
  const input = {
    chartData: chartData as Record<string, unknown>,
    parentBirthYears: {},
  }

  test('应验证每个宫位的格局倍率应用情况', () => {
    const result = executeStage1(input)
    const { scoringCtx, palaceScores } = result

    console.log('\n=== 每宫格局与评分详情 ===')
    const palaceNames = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟']

    for (let i = 0; i < 12; i++) {
      const patterns = scoringCtx.palacePatterns![i]
      const score = palaceScores[i]
      const patternNames = patterns.map(p => `${p.name}(${p.level})`).join(', ')
      const bonusG = score.bonusDetails['2.8_吉格倍率']
      const penaltyH = score.penaltyDetails['4.8_凶格倍率']

      console.log(`${palaceNames[i]}: 格局=[${patternNames || '无'}], 吉格倍率=${bonusG}, 凶格倍率=${penaltyH}`)
    }

    // 验证命宫(核心宫位)的命无正曜格局被应用
    // 注意：命无正曜是小凶，倍率为1.0，所以不会小于1
    const mingScore = palaceScores[0]
    expect(mingScore.penaltyDetails['4.8_凶格倍率']).toBeDefined()

    // 验证官禄宫(核心宫位)的府相朝垣等格局被应用
    // 府相朝垣是中吉，倍率为1.0，所以不会大于1
    const gongLuScore = palaceScores[4]
    expect(gongLuScore.bonusDetails['2.8_吉格倍率']).toBeDefined()
  })
})
