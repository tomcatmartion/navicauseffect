/**
 * 路由模块 + 状态机 + 太岁入卦 单元测试
 */

import { describe, it, expect } from 'vitest'
import { routeMatter, detectMatterIntent } from '../router/decision-tree'
import { createInitialState, advanceStage, canAdvanceTo } from '../orchestrator/state-machine'
import { buildVirtualChart, groupIncomingByTarget } from '../tai-sui-rua-gua/virtual-chart'
import { buildPrompt, STAGE1_HINT } from '../llm-wrapper/prompt-builder'
import { generateFourDimensionTags, judgeThreePalaceTone } from '../personality-analyzer/four-dimension'
import type { PalaceInput } from '../personality-analyzer/four-dimension'
import type { MajorStar, PalaceBrightness } from '../types'

// ═══════════════════════════════════════════════════════════════════
// M5 路由测试
// ═══════════════════════════════════════════════════════════════════

describe('M5: 事项路由', () => {
  it('求学 — 本地常规', () => {
    const result = routeMatter('求学', { study_1: 'local', study_2: 'normal' })
    expect(result.primaryPalace).toBe('官禄')
    expect(result.secondaryPalaces).toEqual([])
  })

  it('求学 — 异地+备考', () => {
    const result = routeMatter('求学', { study_1: 'remote', study_2: 'exam' })
    expect(result.primaryPalace).toBe('官禄')
    expect(result.secondaryPalaces).toContain('迁移')
    expect(result.secondaryPalaces).toContain('田宅')
  })

  it('求财 — 纯投资', () => {
    const result = routeMatter('求财', { wealth_1: 'invest', wealth_6: 'fund' })
    expect(result.primaryPalace).toBe('福德')
    expect(result.secondaryPalaces).toContain('迁移')
  })

  it('求财 — 合伙当头 + 有生年', () => {
    const result = routeMatter('求财', {
      wealth_1: 'labor', wealth_2a: 'no_site', wealth_3: 'partner',
      wealth_3a: 'lead', wealth_3b: 'has', wealth_4: 'local', wealth_5: 'labor',
    })
    expect(result.primaryPalace).toBe('迁移')
    expect(result.needInteraction).toBe(true)
  })

  it('求爱 — 自由恋爱+已有对象', () => {
    const result = routeMatter('求爱', { love_1: 'free', love_2: 'existing' })
    expect(result.primaryPalace).toBe('夫妻')
    expect(result.secondaryPalaces).toContain('福德')
  })

  it('求职 — 跳槽+管理', () => {
    const result = routeMatter('求职', {
      career_1: 'switch', career_2: 'no_barrier', career_3: 'manage', career_4: 'local',
    })
    expect(result.primaryPalace).toBe('迁移')
    expect(result.secondaryPalaces).toContain('官禄')
    expect(result.secondaryPalaces).toContain('仆役')
  })

  it('求健康 — 整体评估', () => {
    const result = routeMatter('求健康', { health_1: 'general', health_2: 'no' })
    expect(result.primaryPalace).toBe('疾厄')
  })

  it('求名 — 技艺+网络', () => {
    const result = routeMatter('求名', { fame_1: 'skill', fame_2: 'online' })
    expect(result.primaryPalace).toBe('官禄')
  })
})

describe('意图识别', () => {
  it('识别财运', () => expect(detectMatterIntent('我想看看今年的财运')).toBe('求财'))
  it('识别感情', () => expect(detectMatterIntent('我的感情什么时候能有着落')).toBe('求爱'))
  it('识别关系', () => expect(detectMatterIntent('我和我老婆的相处模式')).toBe('互动关系'))
  it('识别健康', () => expect(detectMatterIntent('最近身体不太舒服')).toBe('求健康'))
  it('识别综合', () => expect(detectMatterIntent('看看整体运势')).toBe('综合'))
  it('无法识别返回 null', () => expect(detectMatterIntent('你好')).toBeNull())
})

// ═══════════════════════════════════════════════════════════════════
// 状态机测试
// ═══════════════════════════════════════════════════════════════════

describe('状态机', () => {
  it('初始状态为阶段一', () => {
    const state = createInitialState()
    expect(state.currentStage).toBe(1)
    expect(state.stage1Completed).toBe(false)
  })

  it('阶段一 → 阶段二 正常推进', () => {
    const state = createInitialState()
    const next = advanceStage(state, 2)
    expect(next.currentStage).toBe(2)
    expect(next.stage1Completed).toBe(true)
  })

  it('禁止跳步：1 → 3 不允许', () => {
    const state = createInitialState()
    const next = advanceStage(state, 3)
    expect(next.currentStage).toBe(1) // 未变
  })

  it('canAdvanceTo 检查', () => {
    const state = createInitialState()
    expect(canAdvanceTo(state, 1)).toBe(true)
    expect(canAdvanceTo(state, 2)).toBe(false) // 阶段一未完成
    expect(canAdvanceTo(state, 3)).toBe(false)
  })

  it('阶段三 ↔ 阶段四 交替', () => {
    let state = createInitialState()
    state = advanceStage(state, 2) // → 2
    state.stage2Completed = true
    state = advanceStage(state, 3) // → 3
    expect(state.currentStage).toBe(3)
    state = advanceStage(state, 4) // → 4
    expect(state.currentStage).toBe(4)
    state = advanceStage(state, 3) // → 3
    expect(state.currentStage).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 太岁入卦测试
// ═══════════════════════════════════════════════════════════════════

describe('太岁入卦', () => {
  it('乙丑年入卦者完整入卦', () => {
    const chart = buildVirtualChart('乙', '丑')
    expect(chart.virtualMingGong).toBe('丑')
    // 4生年四化 + 4太岁宫宫干四化 + 禄存+羊+陀 + 魁+钺 + 鸾+喜 = 15（部分星可能重合位置）
    expect(chart.incomingStars.length).toBeGreaterThanOrEqual(14)
  })

  it('生年四化正确', () => {
    const chart = buildVirtualChart('乙', '丑')
    expect(chart.sihua.shengNian.禄).toBe('天机')
    expect(chart.sihua.shengNian.忌).toBe('太阴')
  })

  it('按地支分组', () => {
    const chart = buildVirtualChart('壬', '戌')
    const grouped = groupIncomingByTarget(chart)
    // 应该有至少一个地支有入卦星曜
    const hasStars = Object.values(grouped).some(stars => stars.length > 0)
    expect(hasStars).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 性格定性测试
// ═══════════════════════════════════════════════════════════════════

describe('性格定性', () => {
  it('三宫强弱判定', () => {
    expect(judgeThreePalaceTone(7.0, 6.5, 7.2)).toContain('三宫均强旺')
    expect(judgeThreePalaceTone(7.0, 3.0, 3.5)).toContain('表强里弱')
    expect(judgeThreePalaceTone(3.5, 7.0, 7.0)).toContain('表弱里强')
    expect(judgeThreePalaceTone(2.5, 3.0, 2.8)).toContain('三宫均弱')
    expect(judgeThreePalaceTone(5.0, 7.0, 3.5)).toContain('混杂')
  })
})

// ═══════════════════════════════════════════════════════════════════
// LLM Wrapper 测试
// ═══════════════════════════════════════════════════════════════════

describe('LLM Prompt 组装', () => {
  it('基本结构正确', () => {
    const ir = { stage: 2 as const, mingGongTags: { palace: '命宫' as const, diZhi: '申' as const, selfTags: ['天同旺'], oppositeTags: ['加强'], trineTags: ['支撑'], flankingTags: ['均衡'], summary: '强旺' }, shenGongTags: { palace: '迁移' as const, diZhi: '子' as const, selfTags: [], oppositeTags: [], trineTags: [], flankingTags: [], summary: '' }, taiSuiTags: { palace: '父母' as const, diZhi: '酉' as const, selfTags: [], oppositeTags: [], trineTags: [], flankingTags: [], summary: '' }, overallTone: '强旺', mingGongHolographic: { sihuaDirection: '', auspiciousEffect: '', inauspiciousEffect: '', minorEffect: '', summary: '中性' } }
    const messages = buildPrompt(ir, [], '你觉得我是什么样的人？', STAGE1_HINT)
    expect(messages.length).toBeGreaterThanOrEqual(3) // system + system(IR) + system(hint) + user
    expect(messages[0].role).toBe('system')
    expect(messages[messages.length - 1].role).toBe('user')
  })
})
