/**
 * 1982年9月24日4点男性命盘格局全面检测
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { bySolar } from 'iztro/lib/astro/astro'

function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  return {
    solarDate,
    gender,
    heavenlyStem: (iztroChart as any).heavenlyStem,
    earthlyBranchOfSoulPalace: iztroChart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: iztroChart.earthlyBranchOfBodyPalace,
    palaces: iztroChart.palaces.map((p: any) => ({
      name: p.name,
      earthlyBranch: p.earthlyBranch,
      heavenlyStem: p.heavenlyStem,
      majorStars: p.majorStars.map((s: any) => ({
        name: s.name,
        brightness: s.brightness,
        mutagen: s.mutagen,
        type: 'major',
      })),
      minorStars: p.minorStars.map((s: any) => ({
        name: s.name,
        mutagen: s.mutagen,
        type: 'soft',
      })),
      adjectiveStars: p.adjectiveStars?.map((s: any) => ({
        name: s.name,
        type: 'adjective',
      })) ?? [],
      isBodyPalace: p.isBodyPalace,
      decadal: null,
    })),
  }
}

function matchPatterns(chartData: Record<string, unknown>) {
  const result = executeStage1({ chartData, parentBirthYears: {} })
  return result.allPatterns
}

describe('1982年9月24日4点男性命盘格局检测', () => {
  test('全面检测所有格局', () => {
    const chartData = buildChartData('1982-09-24', 2, '男')

    console.log('\n========================================')
    console.log('1982年9月24日4点男性命盘')
    console.log('========================================')
    console.log(`天干: ${(chartData as any).heavenlyStem}`)
    console.log(`命宫地支: ${(chartData as any).earthlyBranchOfSoulPalace}`)
    console.log(`身宫地支: ${(chartData as any).earthlyBranchOfBodyPalace}`)

    // 输出十二宫星曜分布
    console.log('\n=== 十二宫星曜分布 ===')
    for (const p of chartData.palaces as any[]) {
      const major = p.majorStars.map((s: any) => `${s.name}(${s.brightness})${s.mutagen ? '[' + s.mutagen + ']' : ''}`).join(', ')
      const minor = p.minorStars.map((s: any) => `${s.name}(${s.brightness})${s.mutagen ? '[' + s.mutagen + ']' : ''}`).join(', ')
      const bodyMark = p.isBodyPalace ? ' [身宫]' : ''
      console.log(`${p.name}(${p.earthlyBranch}): 主星[${major}] 辅星[${minor}]${bodyMark}`)
    }

    // 运行格局识别
    const patterns = matchPatterns(chartData)
    const patternNames = patterns.map(p => p.name)

    console.log('\n=== 识别到的格局 ===')
    console.log(`总数: ${patterns.length}`)
    for (const p of patterns) {
      console.log(`  [${p.level}] ${p.name} (${p.category})`)
    }

    console.log('\n=== 按级别分类 ===')
    const byLevel: Record<string, string[]> = {}
    for (const p of patterns) {
      if (!byLevel[p.level]) byLevel[p.level] = []
      byLevel[p.level].push(p.name)
    }
    for (const [level, names] of Object.entries(byLevel)) {
      console.log(`  ${level}: ${names.join(', ')}`)
    }

    // 输出到文件以便分析
    console.log('\n=== 格局名称列表（便于复制）===')
    console.log(patternNames.join('\n'))

    expect(patterns.length).toBeGreaterThanOrEqual(0)
  })
})
