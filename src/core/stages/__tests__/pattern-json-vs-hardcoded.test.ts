/**
 * JSON 动态格局 vs 硬编码格局 — 一致性验证
 *
 * 用多组命盘分别运行两套逻辑，断言每个格局的判定结果一致。
 */
import { describe, test, expect } from 'vitest'
import { bySolar } from 'iztro/lib/astro/astro'
import { executeStage1 } from '../stage1-palace-scoring'
import {
  greatAuspiciousPatterns,
  mediumAuspiciousPatterns,
  smallAuspiciousPatterns,
  smallInauspiciousPatterns,
  mediumInauspiciousPatterns,
  greatInauspiciousPatterns,
} from '@/core/energy-evaluator/patterns'
import { buildChartAccessor } from '@/core/energy-evaluator/pattern-scoring'
import { getJsonPatterns } from '@/core/energy-evaluator/patterns/json-patterns'
import { clearJsonPatternsCache } from '@/core/energy-evaluator/patterns/json-patterns'

// 硬编码格局合集
const allHardcoded = [
  ...greatAuspiciousPatterns,
  ...mediumAuspiciousPatterns,
  ...smallAuspiciousPatterns,
  ...smallInauspiciousPatterns,
  ...mediumInauspiciousPatterns,
  ...greatInauspiciousPatterns,
]

// 测试命盘（覆盖多种格局触发场景）
const TEST_CHARTS = [
  { date: '1982-09-24', time: 2, gender: '男', label: '1982-09-24 4点男' },
  { date: '1982-05-05', time: 0, gender: '男', label: '1982-05-05 子时男' },
  { date: '1990-01-15', time: 4, gender: '女', label: '1990-01-15 辰时女' },
  { date: '1975-08-20', time: 6, gender: '男', label: '1975-08-20 午时男' },
  { date: '2000-12-01', time: 8, gender: '女', label: '2000-12-01 申时女' },
]

function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  return {
    solarDate,
    gender,
    earthlyBranchOfSoulPalace: iztroChart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: iztroChart.earthlyBranchOfBodyPalace,
    palaces: iztroChart.palaces.map((p: any) => ({
      name: p.name, earthlyBranch: p.earthlyBranch, heavenlyStem: p.heavenlyStem,
      majorStars: p.majorStars.map((s: any) => ({ name: s.name, brightness: s.brightness, mutagen: s.mutagen, type: 'major' })),
      minorStars: p.minorStars.map((s: any) => ({ name: s.name, mutagen: s.mutagen, type: 'soft' })),
      adjectiveStars: p.adjectiveStars?.map((s: any) => ({ name: s.name, type: 'adjective' })) ?? [],
      isBodyPalace: p.isBodyPalace, decadal: null,
    })),
  }
}

// 命宫名称列表
const PNAMES = ['命宫','父母','福德','田宅','官禄','仆役','迁移','疾厄','财帛','子女','夫妻','兄弟'] as const

describe('JSON vs 硬编码格局一致性', () => {
  // 清除 JSON 缓存确保用最新修正
  clearJsonPatternsCache()
  const jsonPatterns = getJsonPatterns()

  for (const tc of TEST_CHARTS) {
    describe(`${tc.label}`, () => {
      const chartData = buildChartData(tc.date, tc.time, tc.gender)
      const result = executeStage1({ chartData: chartData as any, parentBirthYears: {} })
      const ctx = result.scoringCtx

      // 收集 JSON 判定结果（12个锚定宫位）
      const jsonResults: Map<string, boolean> = new Map()
      for (let anchor = 0; anchor < 12; anchor++) {
        const accessor = buildChartAccessor(ctx, anchor)
        for (const jp of jsonPatterns) {
          const key = `${jp.name}@${anchor}`
          if (jp.evaluate(accessor)) {
            jsonResults.set(key, true)
          }
        }
      }

      // 收集硬编码判定结果（12个锚定宫位）
      const hardcodedResults: Map<string, boolean> = new Map()
      for (let anchor = 0; anchor < 12; anchor++) {
        const accessor = buildChartAccessor(ctx, anchor)
        for (const hp of allHardcoded) {
          const key = `${hp.name}@${anchor}`
          if (hp.evaluate(accessor)) {
            hardcodedResults.set(key, true)
          }
        }
      }

      // 对比所有格局
      const allPatternNames = new Set<string>()
      for (const p of [...jsonPatterns, ...allHardcoded]) allPatternNames.add(p.name)

      const mismatches: string[] = []
      for (const name of allPatternNames) {
        for (let anchor = 0; anchor < 12; anchor++) {
          const key = `${name}@${anchor}`
          const jsonMatch = jsonResults.has(key)
          const hcMatch = hardcodedResults.has(key)
          if (jsonMatch !== hcMatch) {
            mismatches.push(`${key}: JSON=${jsonMatch} 硬编码=${hcMatch}`)
          }
        }
      }

      test('所有格局结果一致', () => {
        if (mismatches.length > 0) {
          console.log(`\n不一致的格局 (${mismatches.length}):`)
          for (const m of mismatches) {
            console.log(`  ${m}`)
          }
        }
        expect(mismatches.length).toBe(0)
      })
    })
  }
})
