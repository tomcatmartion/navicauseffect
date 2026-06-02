import { describe, it, expect } from 'vitest'
import { buildChartPipelineDebugSnapshot } from '@/lib/ziwei/chart-pipeline-debug'
import { CHART_FIXTURE } from '@/core/stages/__tests__/chart-fixture'

describe('buildChartPipelineDebugSnapshot', () => {
  it('应返回 Hybrid 管线快照且含 prompts 与三层表', () => {
    const snap = buildChartPipelineDebugSnapshot(CHART_FIXTURE as Record<string, unknown>, {
      affairType: '求财',
      affair: '测试',
      targetYear: 2026,
      partnerBirthYear: null,
    })
    expect(snap.engine).toBe('hybrid-stages')
    expect(snap.patterns.length).toBeGreaterThanOrEqual(0)
    expect(Object.keys(snap.allPalaces).length).toBe(12)
    expect(snap.personality.overview).toContain('命宫')
    expect(snap.extended.prompts.stage1).toContain('【system】')
    expect(snap.extended.threeLayerTable).toBeDefined()
    expect(snap.affair.sihuaLandingReport).toBeDefined()
    expect(snap.affair.sihuaLandingReport?.layers.length).toBeGreaterThanOrEqual(2)
    expect(snap.affair.causalChain).toBeTruthy()
    expect(snap.affair.resilience?.strategy).toBeTruthy()
    expect(snap.affair.fourDimension?.self.palace).toBeTruthy()
    expect(snap.affair.scoreBreakdown?.originBase).toBeDefined()
    expect(snap.interaction.threeDimension.dimensionB.tone).toBeTruthy()
    expect(snap.interaction.mode).toBe('solo')
  })

  it('有对方生年时应为 full 模式', () => {
    const snap = buildChartPipelineDebugSnapshot(CHART_FIXTURE as Record<string, unknown>, {
      affairType: '求爱',
      affair: '相处',
      targetYear: 2026,
      partnerBirthYear: 1990,
    })
    expect(snap.interaction.mode).toBe('full')
    expect(snap.interaction.partnerYear).toBe(1990)
  })
})
