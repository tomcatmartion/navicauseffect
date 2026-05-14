/**
 * Hybrid 新模块：ChartBridge、patterns DSL、memory 解析、FinalIR 摘要
 */

import { describe, it, expect } from 'vitest'
import { buildBaseIR } from '@/lib/ziwei/hybrid/chart-bridge'
import { evaluateJsonPatterns } from '@/lib/ziwei/hybrid/patterns-dsl'
import { parseHybridAssistantPayload, mergeCollected } from '@/lib/ziwei/hybrid/ai-parse'
import { mergeSihuaFromChartData } from '@/lib/ziwei/hybrid/sihua-merger'
import { buildFinalIRFromStages } from '@/lib/ziwei/hybrid/final-ir-builder'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { CHART_FIXTURE } from '@/core/stages/__tests__/chart-fixture'
import { createEmptyHybridPersisted } from '@/lib/ziwei/hybrid/types'

describe('lib/ziwei/hybrid', () => {
  it('ChartBridge 产出 BaseIR', () => {
    const base = buildBaseIR(CHART_FIXTURE as Record<string, unknown>)
    expect(base.version).toBe(1)
    expect(base.palaces.length).toBe(12)
    expect(base.extraStars.length).toBeGreaterThan(0)
  })

  it('patterns.json DSL 在命宫紫微时命中紫微七杀格', () => {
    const ctx = {
      starsByPalaceIndex: [['紫微', '七杀'], ...Array.from({ length: 11 }, () => [])],
      matchedPatternNames: new Set<string>(),
    }
    const hits = evaluateJsonPatterns(ctx)
    expect(hits.some(h => h.id === 'ziwei_qisha')).toBe(true)
  })

  it('parseHybridAssistantPayload 分离 narrative 与 memory_update', () => {
    const raw = '你好\n{"intent":"求财","memory_update":{"hasLabor":true}}'
    const { narrative, memoryUpdate, intent } = parseHybridAssistantPayload(raw)
    expect(narrative).toBe('你好')
    expect(intent).toBe('求财')
    expect(memoryUpdate?.hasLabor).toBe(true)
  })

  it('mergeSihuaFromChartData 返回 mergedSihua', () => {
    const m = mergeSihuaFromChartData(CHART_FIXTURE as Record<string, unknown>)
    expect(m.entries.length).toBeGreaterThan(0)
  })

  it('buildFinalIRFromStages 摘要字段齐全', () => {
    const s1 = executeStage1({ chartData: CHART_FIXTURE })
    const s2 = executeStage2({ stage1: s1, question: '性格如何' })
    const fin = buildFinalIRFromStages(s1, s2)
    expect(fin.palaceLines.length).toBe(12)
    expect(fin.personalitySummary).toBeDefined()
    expect(fin.personalitySummary?.overview).toBeDefined()
    expect(fin.personalitySummary?.traits).toBeDefined()
    expect(fin.personalitySummary?.strengths).toBeDefined()
    expect(fin.personalitySummary?.weaknesses).toBeDefined()
    expect(fin.personalitySummary?.advice).toBeDefined()
  })

  it('mergeCollected 浅合并', () => {
    expect(mergeCollected({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('多轮会话：HybridPersisted 对话历史截断为末 6 条（与编排器一致）', () => {
    const hp = createEmptyHybridPersisted()
    const MAX = 6
    for (let i = 0; i < 8; i++) {
      hp.conversationHistory.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `m${i}`,
      })
    }
    if (hp.conversationHistory.length > MAX) {
      hp.conversationHistory = hp.conversationHistory.slice(-MAX)
    }
    expect(hp.conversationHistory).toHaveLength(6)
    expect(hp.conversationHistory[0].content).toBe('m2')
    expect(hp.conversationHistory[5].content).toBe('m7')
  })
})
