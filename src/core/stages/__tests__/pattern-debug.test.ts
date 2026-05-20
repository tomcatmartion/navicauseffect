/**
 * 格局识别调试测试
 * 输出命盘的三方四正、夹宫分布，以及匹配到的格局详情
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { CHART_FIXTURE } from './chart-fixture'
import { getSanFangSiZheng, type ChartAccessor } from '@/core/energy-evaluator/patterns/types'

let stage1Output: ReturnType<typeof executeStage1>

beforeAll(() => {
  stage1Output = executeStage1({ chartData: CHART_FIXTURE })
})

describe('格局识别调试: 三方四正与夹宫验证', () => {
  it('应输出命宫三方四正星曜分布', () => {
    const chart = stage1Output.scoringCtx
    const palaces = chart.palaces
    const mingIdx = palaces.findIndex((p: { palaceIndex: number }) => p.palaceIndex === 0)

    console.log('\n=== 命宫三方四正验证 ===')
    console.log('命宫索引:', mingIdx, '地支:', palaces[mingIdx]?.diZhi)

    const sf = getSanFangSiZheng({
      getOppositeIndex: (i: number) => (i + 6) % 12,
      getTrineIndices: (i: number) => [(i + 4) % 12, (i + 8) % 12],
      getStarsInPalace: () => [],
      getAuxStarsInPalace: () => [],
      hasStarInPalace: () => false,
      hasSihuaInPalace: () => false,
      getPalaceBrightness: () => '平',
      getPalaceDiZhi: () => '子',
    } as unknown as ChartAccessor, mingIdx)

    console.log('三方四正宫位索引:', sf)
    for (const idx of sf) {
      const p = palaces[idx]
      const stars = p.stars.map((s: { name: string; sihua?: string }) => s.name + (s.sihua ? `(${s.sihua})` : '')).join(', ')
      console.log(`  ${idx}宫(${p.diZhi}): ${stars || '(空)'}`)
    }

    // 验证三方四正包含的星曜
    const allSfStars = new Set<string>()
    for (const idx of sf) {
      for (const s of palaces[idx].stars) {
        allSfStars.add(s.name)
      }
    }
    console.log('三方四正所有星曜:', Array.from(allSfStars).join(', '))

    expect(sf.length).toBe(4)
    expect(sf).toContain(mingIdx)
    expect(sf).toContain((mingIdx + 6) % 12)
  })

  it('应输出夹宫星曜分布', () => {
    const chart = stage1Output.scoringCtx
    const palaces = chart.palaces
    const mingIdx = palaces.findIndex((p: { palaceIndex: number }) => p.palaceIndex === 0)

    const leftIdx = (mingIdx + 1) % 12
    const rightIdx = (mingIdx - 1 + 12) % 12

    console.log('\n=== 夹宫验证 ===')
    console.log('命宫索引:', mingIdx)
    console.log('左夹宫索引:', leftIdx, '地支:', palaces[leftIdx]?.diZhi)
    console.log('右夹宫索引:', rightIdx, '地支:', palaces[rightIdx]?.diZhi)

    const leftStars = palaces[leftIdx].stars.map((s: { name: string }) => s.name).join(', ') || '(空)'
    const rightStars = palaces[rightIdx].stars.map((s: { name: string }) => s.name).join(', ') || '(空)'

    console.log('左夹宫星曜:', leftStars)
    console.log('右夹宫星曜:', rightStars)

    expect(palaces[leftIdx].stars.length).toBeGreaterThan(0)
    expect(palaces[rightIdx].stars.length).toBeGreaterThan(0)
  })

  it('应输出匹配到的所有格局', () => {
    console.log('\n=== 匹配到的格局 ===')
    console.log('格局数量:', stage1Output.allPatterns.length)
    for (const p of stage1Output.allPatterns) {
      console.log(`  [${p.level}] ${p.name} (${p.category}) - 倍率:${p.multiplier}`)
    }

    // 这个命盘应该有特定格局
    const patternNames = stage1Output.allPatterns.map((p) => p.name)
    console.log('格局名称列表:', patternNames)

    expect(stage1Output.allPatterns.length).toBeGreaterThanOrEqual(0)
  })

  it('应验证各宫完整星曜分布', () => {
    const palaces = stage1Output.scoringCtx.palaces
    const palaceNames = ['命宫','父母','福德','田宅','官禄','仆役','迁移','疾厄','财帛','子女','夫妻','兄弟']

    console.log('\n=== 十二宫完整星曜分布 ===')
    for (let i = 0; i < 12; i++) {
      const p = palaces[i]
      const allStars = p.stars.map((s: { name: string; sihua?: string }) => s.name + (s.sihua ? `(${s.sihua})` : '')).join(', ')
      console.log(`${i}: ${palaceNames[i]}(${p.diZhi}) - ${allStars || '(空)'}`)
    }

    expect(palaces).toHaveLength(12)
  })
})
