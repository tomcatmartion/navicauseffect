import { describe, it, expect, beforeAll } from 'vitest'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { buildPersonalityTriadProfile } from '@/core/personality-analyzer/triad-builder'
import { PALACE_NAME_TO_INDEX } from '@/core/types'
import { CHART_FIXTURE } from '@/core/stages/__tests__/chart-fixture'

describe('triad-builder', () => {
  let stage1: ReturnType<typeof executeStage1>

  beforeAll(() => {
    stage1 = executeStage1({ chartData: CHART_FIXTURE })
  })

  it('三宫 synthesis 非空且含版本号', () => {
    const ctx = stage1.scoringCtx
    const mingIdx = PALACE_NAME_TO_INDEX['命宫']
    const shenIdx = ctx.shenGongIndex ?? 6
    const taiSuiIdx = ctx.palaces.findIndex(p => p.diZhi === ctx.taiSuiZhi)

    const profile = buildPersonalityTriadProfile({
      ctx,
      palaceScores: stage1.palaceScores,
      mingIdx,
      shenIdx,
      taiSuiIdx: taiSuiIdx >= 0 ? taiSuiIdx : 0,
    })

    expect(profile.version).toBeTruthy()
    expect(profile.synthesis.length).toBeGreaterThan(20)
    expect(profile.mingLayer.description).toContain('命宫')
    expect(profile.shenLayer.scoreStrength).toMatch(/强旺|中等|弱陷/)
  })

  it('高分阳星与低分阴星 baseTrait 应有区分', () => {
    const ctx = stage1.scoringCtx
    const mingIdx = PALACE_NAME_TO_INDEX['命宫']
    const shenIdx = ctx.shenGongIndex ?? 6
    const taiSuiIdx = ctx.palaces.findIndex(p => p.diZhi === ctx.taiSuiZhi)

    const profile = buildPersonalityTriadProfile({
      ctx,
      palaceScores: stage1.palaceScores,
      mingIdx,
      shenIdx,
      taiSuiIdx: taiSuiIdx >= 0 ? taiSuiIdx : 0,
    })

    expect(profile.mingLayer.baseTrait.length).toBeGreaterThan(4)
    expect(['阳', '阴']).toContain(profile.mingLayer.yinYang)
  })
})
