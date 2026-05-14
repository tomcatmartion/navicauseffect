/**
 * pipeline.hybrid.ts 单元测试
 *
 * 测试命盘转换器、ChartAccessor 适配器、阶段判断逻辑
 */

import { describe, it, expect } from 'vitest'

import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { evaluateAllPalaces } from '@/core/energy-evaluator'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { allPatterns } from '@/core/energy-evaluator'
import { createInitialState, advanceStage } from '@/core/orchestrator/state-machine'
import { detectMatterIntent } from '@/core/router/decision-tree'
import { buildVirtualChart } from '@/core/tai-sui-rua-gua/virtual-chart'
import { buildPrompt, STAGE1_HINT, STAGE2_HINT } from '@/core/llm-wrapper/prompt-builder'
import type { DiZhi, TianGan, PalaceBrightness, MajorStar, IRStage1, IRStage2 } from '@/core/types'
import type { ChartAccessor } from '@/core/energy-evaluator/patterns/types'

function buildTestScoringContext(): ScoringContext {
  const palaces: PalaceForScoring[] = Array.from({ length: 12 }, (_, i) => ({
    palaceIndex: i,
    diZhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][i] as DiZhi,
    brightness: '平' as PalaceBrightness,
    majorStars: [] as Array<{ star: MajorStar; brightness: PalaceBrightness }>,
    stars: [] as Array<{ name: string; sihua?: '化禄' | '化权' | '化科' | '化忌'; sihuaSource?: string }>,
    hasLuCun: false,
  }))

  palaces[0].majorStars = [
    { star: '紫微', brightness: '旺' },
    { star: '天相', brightness: '旺' },
  ]
  palaces[0].stars = [
    { name: '紫微' },
    { name: '天相' },
    { name: '左辅' },
    { name: '右弼' },
  ]

  palaces[6].majorStars = [{ star: '破军', brightness: '平' }]
  palaces[6].stars = [
    { name: '破军' },
    { name: '禄存' },
  ]

  palaces[4].majorStars = [
    { star: '武曲', brightness: '旺' },
    { star: '贪狼', brightness: '平' },
  ]
  palaces[4].stars = [{ name: '武曲' }, { name: '贪狼' }]

  return {
    skeletonId: 'P01',
    palaces,
    birthGan: '壬',
    taiSuiZhi: '戌',
    patterns: [],
  }
}

function buildChartAccessor(ctx: ScoringContext): ChartAccessor {
  const palaces = ctx.palaces
  return {
    getStarsInPalace(idx: number) {
      return palaces[idx]?.majorStars ?? []
    },
    getAuxStarsInPalace(idx: number) {
      const p = palaces[idx]
      if (!p) return []
      const majorNames = new Set(p.majorStars.map(ms => ms.star as string))
      return p.stars.filter(s => !majorNames.has(s.name)).map(s => s.name)
    },
    hasStarInPalace(idx: number, star: string) {
      const p = palaces[idx]
      if (!p) return false
      return p.stars.some(s => s.name === star) || p.majorStars.some(ms => ms.star === star)
    },
    hasSihuaInPalace(idx: number, type: '化禄' | '化权' | '化科' | '化忌') {
      return palaces[idx]?.stars.some(s => s.sihua === type) ?? false
    },
    getPalaceBrightness(idx: number) {
      return palaces[idx]?.brightness ?? '平'
    },
    getPalaceDiZhi(idx: number): DiZhi {
      return palaces[idx]?.diZhi ?? '子'
    },
    getOppositeIndex(idx: number) {
      return (idx + 6) % 12
    },
    getTrineIndices(idx: number): [number, number] {
      return [(idx + 4) % 12, (idx + 8) % 12]
    },
    getFlankingIndices(idx: number): [number, number] {
      return [(idx - 1 + 12) % 12, (idx + 1) % 12]
    },
    hasFlanking(idx: number) {
      const left = palaces[(idx - 1 + 12) % 12]
      const right = palaces[(idx + 1) % 12]
      return (left?.stars.length ?? 0) > 0 && (right?.stars.length ?? 0) > 0
    },
    countAuspiciousInPalaces(indices: number[]) {
      let count = 0
      for (const idx of indices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'].includes(s.name)) count++
          if (s.sihua === '化禄') count++
        }
      }
      return count
    },
    countInauspiciousInPalaces(indices: number[]) {
      let count = 0
      for (const idx of indices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(s.name)) count++
          if (s.sihua === '化忌') count++
        }
      }
      return count
    },
    mingGongIndex: 0,
    shenGongIndex: 6,
    birthGan: ctx.birthGan,
    birthZhi: palaces[0]?.diZhi ?? '子',
    hasStarSihua(star: string, type: '化禄' | '化权' | '化科' | '化忌') {
      for (const p of palaces) {
        for (const s of p.stars) {
          if (s.name === star && s.sihua === type) return true
        }
      }
      return false
    },
    countSihuaInPalacesFromSource(indices: number[], type: string, _source: string) {
      let count = 0
      for (const idx of indices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (s.sihua === type) count++
        }
      }
      return count
    },
  }
}

describe('混合架构 Pipeline', () => {
  describe('命盘数据转换', () => {
    it('天干年份提取正确', () => {
      const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
      expect(GAN_TABLE[(2024 - 4) % 10]).toBe('甲')
      expect(GAN_TABLE[(1982 - 4) % 10]).toBe('壬')
      expect(GAN_TABLE[(1990 - 4) % 10]).toBe('庚')
    })
  })

  describe('ChartAccessor 适配器', () => {
    const ctx = buildTestScoringContext()
    const accessor = buildChartAccessor(ctx)

    it('能查到命宫紫微', () => {
      expect(accessor.hasStarInPalace(0, '紫微')).toBe(true)
    })

    it('能查到对宫破军', () => {
      expect(accessor.hasStarInPalace(6, '破军')).toBe(true)
    })

    it('能获取宫位地支', () => {
      expect(accessor.getPalaceDiZhi(0)).toBe('子')
      expect(accessor.getPalaceDiZhi(6)).toBe('午')
    })

    it('三方四正关系正确', () => {
      const [t1, t2] = accessor.getTrineIndices(0)
      expect(t1).toBe(4)
      expect(t2).toBe(8)
      expect(accessor.getOppositeIndex(0)).toBe(6)
    })

    it('吉星统计正确', () => {
      const sf = [0, accessor.getOppositeIndex(0), ...accessor.getTrineIndices(0)]
      const auspCount = accessor.countAuspiciousInPalaces(sf)
      expect(auspCount).toBeGreaterThanOrEqual(2)
    })

    it('命宫主星获取正确', () => {
      const stars = accessor.getStarsInPalace(0)
      expect(stars.length).toBe(2)
      expect(stars[0].star).toBe('紫微')
    })
  })

  describe('完整评分流程', () => {
    it('十二宫评分完成', () => {
      const ctx = buildTestScoringContext()
      const mergedSihua = calculateOriginalSihua(ctx.birthGan, ctx.taiSuiZhi)

      for (const entry of mergedSihua.entries) {
        for (const palace of ctx.palaces) {
          for (const star of palace.stars) {
            if (star.name === entry.star && !star.sihua) {
              star.sihua = entry.type
              star.sihuaSource = entry.source
            }
          }
        }
      }

      const accessor = buildChartAccessor(ctx)
      allPatterns.filter(p => p.evaluate(accessor))

      const scores = evaluateAllPalaces(ctx)

      expect(scores.length).toBe(12)
      for (const s of scores) {
        expect(s.finalScore).toBeGreaterThanOrEqual(0)
        expect(s.finalScore).toBeLessThanOrEqual(10)
      }

      const mingScore = scores[0]
      expect(mingScore.palace).toBe('命宫')
      expect(mingScore.finalScore).toBeGreaterThan(5)
    })
  })

  describe('状态机流程', () => {
    it('完整阶段推进 1→2→3', () => {
      let state = createInitialState()
      expect(state.currentStage).toBe(1)

      state = advanceStage(state, 2)
      expect(state.stage1Completed).toBe(true)
      expect(state.currentStage).toBe(2)

      state.stage2Completed = true
      state = advanceStage(state, 3, '求财')
      expect(state.currentStage).toBe(3)
      expect(state.currentMatterType).toBe('求财')
    })
  })

  describe('Prompt 组装', () => {
    it('阶段一 IR 能组装正确', () => {
      const ir: IRStage1 = {
        stage: 1,
        palaceScores: [],
        allPatterns: [],
        mergedSihua: {
          shengNian: { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' },
          dunGan: { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' },
          entries: [
            { type: '化禄', star: '天梁', source: '生年' },
            { type: '化忌', star: '武曲', source: '生年' },
          ],
          specialOverlaps: [],
          palaceAnnotations: [],
        },
        hasParentInfo: false,
      }

      const messages = buildPrompt(ir, [], '你好，请帮我看看命盘', STAGE1_HINT)
      expect(messages.length).toBeGreaterThanOrEqual(3)
      expect(messages[0].role).toBe('system')
      expect(messages[messages.length - 1].role).toBe('user')
    })

    it('阶段二 IR 能组装正确', () => {
      const ir: IRStage2 = {
        stage: 2,
        mingGongTags: {
          palace: '命宫',
          diZhi: '申',
          selfTags: ['天同旺'],
          oppositeTags: ['加强'],
          trineTags: ['支撑'],
          flankingTags: ['均衡'],
          summary: '强旺',
        },
        shenGongTags: {
          palace: '迁移',
          diZhi: '子',
          selfTags: [],
          oppositeTags: [],
          trineTags: [],
          flankingTags: [],
          summary: '',
        },
        taiSuiTags: {
          palace: '父母',
          diZhi: '酉',
          selfTags: [],
          oppositeTags: [],
          trineTags: [],
          flankingTags: [],
          summary: '',
        },
        overallTone: '强旺',
        mingGongHolographic: {
          sihuaDirection: '',
          auspiciousEffect: '',
          inauspiciousEffect: '',
          minorEffect: '',
          summary: '中性',
        },
      }

      const messages = buildPrompt(ir, [], '你觉得我是什么样的人？', STAGE2_HINT)
      expect(messages.length).toBeGreaterThanOrEqual(3)
      const systemContent = messages.find(m => m.role === 'system' && m.content.includes('IR'))
      expect(systemContent).toBeTruthy()
    })
  })

  describe('意图识别', () => {
    it('能识别求财意图', () => {
      expect(detectMatterIntent('我想看看财运怎么样')).toBe('求财')
    })

    it('能识别互动关系意图', () => {
      expect(detectMatterIntent('我和我男朋友相处怎么样')).toBe('互动关系')
    })

    it('能识别求职意图', () => {
      expect(detectMatterIntent('我最近想换工作')).toBe('求职')
    })

    it('无法识别时返回 null', () => {
      expect(detectMatterIntent('今天天气真好')).toBeNull()
    })
  })

  describe('太岁入卦', () => {
    it('能构建虚拟命盘', () => {
      const chart = buildVirtualChart('庚', '午')
      expect(chart.gan).toBe('庚')
      expect(chart.zhi).toBe('午')
      expect(chart.incomingStars.length).toBeGreaterThan(0)
    })
  })
})
