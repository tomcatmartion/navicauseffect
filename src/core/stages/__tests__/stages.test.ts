/**
 * 阶段模块单元测试
 *
 * 使用真实 iztro 排盘数据作为 fixture，验证每个阶段的输出结构。
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'
import { routeMatter } from '@/core/router/decision-tree'
import { CHART_FIXTURE } from './chart-fixture'

let stage1Output: ReturnType<typeof executeStage1>

describe('Stage 1: 宫位评分', () => {
  beforeAll(() => {
    stage1Output = executeStage1({ chartData: CHART_FIXTURE })
  })

  it('应返回十二宫评分', () => {
    expect(stage1Output.palaceScores).toHaveLength(12)
  })

  it('每宫评分应在 0-10 之间', () => {
    for (const score of stage1Output.palaceScores) {
      expect(score.finalScore).toBeGreaterThanOrEqual(0)
      expect(score.finalScore).toBeLessThanOrEqual(10)
    }
  })

  it('应包含原局四化', () => {
    expect(stage1Output.mergedSihua).toBeDefined()
    expect(stage1Output.mergedSihua.entries.length).toBeGreaterThanOrEqual(4)
  })

  it('应包含知识片段（非空）', () => {
    expect(stage1Output.knowledgeSnippets.length).toBeGreaterThan(0)
  })

  it('应包含格局匹配结果', () => {
    expect(stage1Output.allPatterns).toBeDefined()
    expect(Array.isArray(stage1Output.allPatterns)).toBe(true)
  })

  it('应包含评分上下文', () => {
    expect(stage1Output.scoringCtx).toBeDefined()
    expect(stage1Output.scoringCtx.birthGan).toBe('庚') // 1990年 = 庚年
  })
})

describe('Stage 2: 性格定性', () => {
  it('应返回三宫四维标签', () => {
    const output = executeStage2({ stage1: stage1Output, question: '帮我看看性格' })
    expect(output.mingGongTags).toBeDefined()
    expect(output.shenGongTags).toBeDefined()
    expect(output.taiSuiTags).toBeDefined()
  })

  it('应包含命宫全息底色', () => {
    const output = executeStage2({ stage1: stage1Output, question: '性格分析' })
    expect(output.mingGongHolographic).toBeDefined()
    expect(output.mingGongHolographic.summary).toBeTruthy()
  })

  it('应包含知识片段（非空）', () => {
    const output = executeStage2({ stage1: stage1Output, question: '性格' })
    expect(output.knowledgeSnippets.length).toBeGreaterThan(0)
  })

  it('应包含整体性格基调', () => {
    const output = executeStage2({ stage1: stage1Output, question: '性格' })
    expect(output.overallTone).toBeTruthy()
  })
})

describe('Stage 3: 事项分析', () => {
  it('应返回事项分析结果', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '财运' })
    const routeResult = routeMatter('求财', {})
    const output = executeStage3({
      stage1: stage1Output,
      stage2: stage2Output,
      matterType: '求财',
      routeResult,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(output.matterType).toBe('求财')
    expect(output.primaryAnalysis).toBeDefined()
  })

  it('应返回方向矩阵', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '财运' })
    const routeResult = routeMatter('求财', {})
    const output = executeStage3({
      stage1: stage1Output,
      stage2: stage2Output,
      matterType: '求财',
      routeResult,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(['吉吉', '吉凶', '凶吉', '凶凶']).toContain(output.directionMatrix)
    expect(output.directionWindow).toBeTruthy()
  })

  it('应返回知识片段（非空）', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '财运' })
    const routeResult = routeMatter('求财', {})
    const output = executeStage3({
      stage1: stage1Output,
      stage2: stage2Output,
      matterType: '求财',
      routeResult,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(output.knowledgeSnippets.length).toBeGreaterThan(0)
  })
})

describe('Stage 4: 互动关系分析', () => {
  it('应返回虚拟命盘', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '互动关系' })
    const output = executeStage4({
      stage1: stage1Output,
      stage2: stage2Output,
      partnerBirthYear: 1992,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(output.interaction.virtualChart).toBeDefined()
    expect(output.interaction.virtualChart!.incomingStars.length).toBeGreaterThan(0)
  })

  it('应包含三维合参分析', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '互动关系' })
    const output = executeStage4({
      stage1: stage1Output,
      stage2: stage2Output,
      partnerBirthYear: 1992,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(output.interaction.threeDimension).toBeDefined()
    expect(output.interaction.threeDimension.dimensionA).toBeDefined()
    expect(output.interaction.threeDimension.dimensionB).toBeDefined()
    expect(output.interaction.threeDimension.dimensionC).toBeDefined()
  })

  it('应包含核心张力点', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '互动关系' })
    const output = executeStage4({
      stage1: stage1Output,
      stage2: stage2Output,
      partnerBirthYear: 1992,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(Array.isArray(output.interaction.tensionPoints)).toBe(true)
    expect(output.interaction.tensionPoints.length).toBeLessThanOrEqual(3)
  })

  it('应包含知识片段（非空）', () => {
    const stage2Output = executeStage2({ stage1: stage1Output, question: '互动关系' })
    const output = executeStage4({
      stage1: stage1Output,
      stage2: stage2Output,
      partnerBirthYear: 1992,
      chartData: CHART_FIXTURE,
      targetYear: 2026,
    })

    expect(output.knowledgeSnippets.length).toBeGreaterThan(0)
  })
})
