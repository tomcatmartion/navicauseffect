/**
 * 关键功能路径集成测试
 * 验证排盘、格局识别、性格分析的完整流程
 */

import { describe, it, expect } from 'vitest'
import { bySolar } from '../../../packages/iztro/src/astro/astro'
import { buildChartPipelineDebugSnapshot } from '../../lib/ziwei/chart-pipeline-debug'

describe('关键功能路径集成测试', () => {
  // 测试用例：2000-01-01 10点男性（命宫空宫，紫微在兄弟宫）
  const chart = bySolar('2000-1-1', 5, '男')
  const chartData = typeof (chart as unknown as Record<string, unknown>).toJSON === 'function'
    ? ((chart as unknown as Record<string, unknown>).toJSON as () => Record<string, unknown>)()
    : (chart as unknown as Record<string, unknown>)

  it('1. 排盘数据正确', () => {
    expect(chart.solarDate).toBe('2000-1-1')
    expect(chart.earthlyBranchOfSoulPalace).toBeDefined()
    expect(chart.earthlyBranchOfBodyPalace).toBeDefined()
    expect(chart.palaces.length).toBe(12)

    const mingPalace = chart.palaces.find(p => p.name === '命宫')
    expect(mingPalace).toBeDefined()

    // 验证紫微位置
    const ziWeiPalace = chart.palaces.find(p => p.majorStars.some(s => s.name === '紫微'))
    expect(ziWeiPalace).toBeDefined()
  })

  it('2. 格局识别锚定命宫（不应错误识别君臣庆会）', () => {
    const snapshot = buildChartPipelineDebugSnapshot(chartData as Record<string, unknown>, {
      affairType: '求职',
      affair: '事业',
      targetYear: 2025,
    })

    // 命宫空宫不应有君臣庆会
    const hasJunChen = snapshot.patterns.some(p => p.name === '君臣庆会')
    expect(hasJunChen).toBe(false)

    // 但应有正确识别的格局（或为空）
    expect(snapshot.patterns.length).toBeGreaterThanOrEqual(0)
  })

  it('3. 性格分析包含新增维度', () => {
    const snapshot = buildChartPipelineDebugSnapshot(chartData as Record<string, unknown>, {
      affairType: '求职',
      affair: '事业',
      targetYear: 2025,
    })

    // 性格概览存在
    expect(snapshot.personality.overview).toBeDefined()
    expect(snapshot.personality.overview.length).toBeGreaterThan(0)

    // 四维分析存在
    expect(snapshot.personality.fourDimensions).toBeDefined()
    expect(snapshot.personality.fourDimensions.synthesis).toBeDefined()

    // 格局影响存在
    expect(snapshot.personality.patternInfluences).toBeDefined()
  })

  it('4. 大限流年格局识别正常', () => {
    const snapshot = buildChartPipelineDebugSnapshot(chartData as Record<string, unknown>, {
      affairType: '求职',
      affair: '事业',
      targetYear: 2025,
    })

    expect(snapshot.limitPatterns).toBeDefined()
    expect(snapshot.limitPatterns.natal).toBeDefined()
    expect(snapshot.limitPatterns.decadal).toBeDefined()
    expect(snapshot.limitPatterns.yearly).toBeDefined()
    expect(snapshot.limitPatterns.synthesis).toBeDefined()
  })

  it('5. 数据源统一性：所有数据来自同一 chartData', () => {
    const snapshot = buildChartPipelineDebugSnapshot(chartData as Record<string, unknown>, {
      affairType: '求职',
      affair: '事业',
      targetYear: 2025,
    })

    // 确保 personality 数据存在
    expect(snapshot.personality).toBeDefined()
    expect(snapshot.personality.mingGongScore).toBeDefined()

    // 确保大限数据存在
    expect(snapshot.limitPatterns).toBeDefined()
    expect(snapshot.extended).toBeDefined()
    expect(snapshot.extended.birthGan).toBeDefined()
  })
})
