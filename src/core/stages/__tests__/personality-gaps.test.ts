/**
 * 性格分析三缺口验证测试
 *
 * 对照「定性命主性格的方案_补充说明.txt」文档验证：
 * - 缺口1：丙丁级星曜在性格分析中的辅助性定性
 * - 缺口2：夹宫成立条件（两侧都有星）
 * - 缺口3：身宫/太岁宫的显现时机（manifestation_timing）
 */

import { describe, it, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { executeStage2 } from '../stage2-personality'
import { generateFourDimensionTags } from '@/core/personality-analyzer/four-dimension'
import type { PalaceInput } from '@/core/personality-analyzer/four-dimension'
import { buildPersonalityData } from '@/core/llm-wrapper/prompt-builder'
import { STAGE2_HINT } from '@/core/llm-wrapper/prompt-builder'

// 使用 stages.test.ts 中的测试 fixture
function makeTestFixture() {
  return {
    palaces: [
      { name: '命宫', earthlyBranch: '辰', heavenlyStem: '甲', majorStars: [{ name: '天机', brightness: '旺', mutagen: null }, { name: '天梁', brightness: '旺', mutagen: null }], minorStars: [{ name: '红鸾' }, { name: '华盖' }], adjectiveStars: [{ name: '天马' }], isBodyPalace: false, stars: [{ name: '天机', sihua: '化禄' }, { name: '天梁', sihua: '化权' }, { name: '红鸾' }, { name: '华盖' }, { name: '天马' }] },
      { name: '兄弟', earthlyBranch: '巳', heavenlyStem: '乙', majorStars: [{ name: '紫微', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '紫微' }] },
      { name: '夫妻', earthlyBranch: '午', heavenlyStem: '丙', majorStars: [], minorStars: [], adjectiveStars: [], isBodyPalace: true, stars: [], decadal: { range: [43, 52], heavenlyStem: '甲' } },
      { name: '子女', earthlyBranch: '未', heavenlyStem: '丁', majorStars: [{ name: '太阳', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '太阳' }] },
      { name: '财帛', earthlyBranch: '申', heavenlyStem: '戊', majorStars: [{ name: '武曲', brightness: '平', mutagen: null }, { name: '天府', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '武曲' }, { name: '天府' }] },
      { name: '疾厄', earthlyBranch: '酉', heavenlyStem: '己', majorStars: [{ name: '太阴', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '太阴', sihua: '化忌' }] },
      { name: '迁移', earthlyBranch: '戌', heavenlyStem: '庚', majorStars: [], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [] },
      { name: '仆役', earthlyBranch: '亥', heavenlyStem: '辛', majorStars: [{ name: '廉贞', brightness: '平', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '廉贞' }] },
      { name: '官禄', earthlyBranch: '子', heavenlyStem: '壬', majorStars: [{ name: '贪狼', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '贪狼' }] },
      { name: '田宅', earthlyBranch: '丑', heavenlyStem: '癸', majorStars: [{ name: '巨门', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '巨门', sihua: '化禄' }] },
      { name: '福德', earthlyBranch: '寅', heavenlyStem: '甲', majorStars: [{ name: '天相', brightness: '平', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '天相' }] },
      { name: '父母', earthlyBranch: '卯', heavenlyStem: '乙', majorStars: [{ name: '天同', brightness: '旺', mutagen: null }, { name: '七杀', brightness: '旺', mutagen: null }], minorStars: [], adjectiveStars: [], isBodyPalace: false, stars: [{ name: '天同', sihua: '化科' }, { name: '七杀' }] },
    ],
    birthGan: '壬',
    taiSuiZhi: '戌',
    zodiac: '狗',
    fiveElementsClass: '水二局',
    soul: '天梁',
    body: '紫微',
    solarDate: '1982-09-24',
    rawDates: { lunarDate: { lunarYear: 1982, lunarMonth: 8, lunarDay: 8, isLeap: false } },
  }
}

describe('性格分析三缺口验证', () => {
  const chartData = makeTestFixture()
  const stage1 = executeStage1({ chartData })
  const stage2 = executeStage2({ stage1, question: '帮我看看性格' })

  // ═══════════════════════════════════════════════════════════════════
  // 缺口3：显现时机（manifestation_timing）
  // ═══════════════════════════════════════════════════════════════════

  describe('缺口3：显现时机（manifestation_timing）', () => {
    it('命宫应有 manifestationTiming 字段，值为"终身显现"', () => {
      expect(stage2.personalityTriad!.mingLayer.manifestationTiming).toBeDefined()
      expect(stage2.personalityTriad!.mingLayer.manifestationTiming).toContain('终身显现')
    })

    it('身宫应有 manifestationTiming 字段，值为"第三大限后"', () => {
      expect(stage2.personalityTriad!.shenLayer.manifestationTiming).toBeDefined()
      expect(stage2.personalityTriad!.shenLayer.manifestationTiming).toContain('第三大限')
    })

    it('太岁宫应有 manifestationTiming 字段，值为"核心利益"', () => {
      expect(stage2.personalityTriad!.taiSuiLayer.manifestationTiming).toBeDefined()
      expect(stage2.personalityTriad!.taiSuiLayer.manifestationTiming).toContain('核心利益')
    })

    it('知识片段中应包含显现时机信息', () => {
      const triadSnippet = stage2.knowledgeSnippets.find(s => s.key === '性格三宫基准')
      expect(triadSnippet).toBeDefined()
      expect(triadSnippet!.content).toContain('显现时机')
    })

    it('buildPersonalityData 输出应包含显现时机提示', () => {
      const personalityText = buildPersonalityData(stage2)
      expect(personalityText).toContain('显现时机')
      expect(personalityText).toContain('终身显现')
      expect(personalityText).toContain('第三大限')
      expect(personalityText).toContain('核心利益')
    })

    it('STAGE2_HINT 应包含显现时机指引', () => {
      expect(STAGE2_HINT).toContain('显现时机')
      expect(STAGE2_HINT).toContain('第三大限')
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 缺口1：丙丁级星曜性格分析
  // ═══════════════════════════════════════════════════════════════════

  describe('缺口1：丙丁级星曜性格分析', () => {
    it('命宫四维标签应包含丙丁级星曜', () => {
      const mingTags = stage2.mingGongTags
      const hasMinorTag = mingTags.selfTags.some(t => t.includes('丙丁级'))
      expect(hasMinorTag).toBe(true)
    })

    it('命宫四维标签应包含丙丁级星曜的定性描述', () => {
      const mingTags = stage2.mingGongTags
      // 红鸾和/或华盖的定性标签
      const hasMinorTrait = mingTags.selfTags.some(t =>
        t.includes('感情丰富') || t.includes('孤独才艺') || t.includes('玄学'),
      )
      expect(hasMinorTrait).toBe(true)
    })

    it('Stage2 知识片段应包含丙丁级星曜赋性', () => {
      const minorSnippets = stage2.knowledgeSnippets.filter(s => s.source === '丙丁级星曜赋性')
      expect(minorSnippets.length).toBeGreaterThan(0)
    })

    it('丙丁级知识片段应包含红鸾和华盖', () => {
      const minorSnippets = stage2.knowledgeSnippets.filter(s => s.source === '丙丁级星曜赋性')
      const keys = minorSnippets.map(s => s.key)
      expect(keys).toContain('红鸾')
      expect(keys).toContain('华盖')
    })

    it('性格画像描述应包含丙丁级修饰', () => {
      // triad 描述中应含丙丁级星曜的修饰文字
      const mingDesc = stage2.personalityTriad!.mingLayer.description
      // 检查是否有"红鸾"或"华盖"的修饰（可能通过 minor_star_effect 占位符填充）
      const hasMinorEffect = mingDesc.includes('红鸾') || mingDesc.includes('华盖') || mingDesc.includes('使其')
      expect(hasMinorEffect).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 缺口2：夹宫成立条件验证
  // ═══════════════════════════════════════════════════════════════════

  describe('缺口2：夹宫成立条件', () => {
    it('双侧有星时应标记"夹宫成立"', () => {
      // 构造双侧都有主星/辅星的输入
      const input: PalaceInput = {
        palaceName: '命宫',
        diZhi: '辰',
        majorStars: [{ star: '天机', brightness: '旺' }],
        brightness: '旺',
        sihua: [],
        auspiciousStars: ['左辅'],
        inauspiciousStars: [],
        minorStars: [],
        finalScore: 7,
        opposite: { majorStars: ['天梁'], brightness: '旺', auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        trine: [
          { majorStars: ['武曲'], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        ],
        flanking: [
          { majorStars: ['太阳'], auspiciousStars: ['文昌'], inauspiciousStars: [], minorStars: [], brightness: '旺' },
          { majorStars: ['太阴'], auspiciousStars: ['文曲'], inauspiciousStars: [], minorStars: [], brightness: '平' },
        ],
      }
      const result = generateFourDimensionTags(input)
      expect(result.flankingTags).toContain('夹宫成立')
    })

    it('仅单侧有主星但有辅星时应标记"夹宫成立"', () => {
      // 一侧无主星但有辅星，另一侧有主星 → 夹宫成立
      const input: PalaceInput = {
        palaceName: '命宫',
        diZhi: '辰',
        majorStars: [{ star: '天机', brightness: '旺' }],
        brightness: '旺',
        sihua: [],
        auspiciousStars: [],
        inauspiciousStars: [],
        minorStars: [],
        finalScore: 7,
        opposite: { majorStars: ['天梁'], brightness: '旺', auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        trine: [
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        ],
        flanking: [
          { majorStars: [], auspiciousStars: ['左辅'], inauspiciousStars: [], minorStars: [], brightness: '平' },
          { majorStars: ['太阴'], auspiciousStars: [], inauspiciousStars: [], minorStars: [], brightness: '平' },
        ],
      }
      const result = generateFourDimensionTags(input)
      expect(result.flankingTags).toContain('夹宫成立')
    })

    it('两侧均无主星也无辅星时应标记"两侧均无星"', () => {
      const input: PalaceInput = {
        palaceName: '命宫',
        diZhi: '辰',
        majorStars: [{ star: '天机', brightness: '旺' }],
        brightness: '旺',
        sihua: [],
        auspiciousStars: [],
        inauspiciousStars: [],
        minorStars: [],
        finalScore: 7,
        opposite: { majorStars: ['天梁'], brightness: '旺', auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        trine: [
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        ],
        flanking: [
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [], brightness: '平' },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [], brightness: '平' },
        ],
      }
      const result = generateFourDimensionTags(input)
      expect(result.flankingTags).toContain('两侧均无星，无夹宫')
    })

    it('仅单侧有星（另一侧完全空）应标记"仅单侧有星"', () => {
      const input: PalaceInput = {
        palaceName: '命宫',
        diZhi: '辰',
        majorStars: [{ star: '天机', brightness: '旺' }],
        brightness: '旺',
        sihua: [],
        auspiciousStars: [],
        inauspiciousStars: [],
        minorStars: [],
        finalScore: 7,
        opposite: { majorStars: ['天梁'], brightness: '旺', auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        trine: [
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [] },
        ],
        flanking: [
          { majorStars: ['太阳'], auspiciousStars: [], inauspiciousStars: [], minorStars: [], brightness: '旺' },
          { majorStars: [], auspiciousStars: [], inauspiciousStars: [], minorStars: [], brightness: '平' },
        ],
      }
      const result = generateFourDimensionTags(input)
      expect(result.flankingTags).toContain('仅单侧有星，夹宫不成立')
    })
  })
})
