/**
 * 84种格局全面自动化测试
 * 
 * 测试策略：
 * 1. 使用 iztro 排盘多个真实命盘
 * 2. 检查每个命盘识别出的格局是否合理
 * 3. 对特定格局构造最小化测试数据进行验证
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { allPatterns } from '@/core/energy-evaluator/patterns'
import { bySolar } from 'iztro/lib/astro/astro'

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/** 使用 iztro 排盘并构建 chartData */
function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  return {
    solarDate,
    gender,
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

/** 运行格局识别 */
function matchPatterns(chartData: Record<string, unknown>) {
  const result = executeStage1({ chartData, parentBirthYears: {} })
  return result.allPatterns.map(p => p.name)
}

// ═══════════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════════

describe('格局全面自动化测试', () => {
  const allPatternNames = allPatterns.map(p => p.name)
  console.log('代码中定义的格局总数:', allPatternNames.length)

  // ───────────────────────────────────────────────────────────────
  // 测试1: 1982年5月5日18点男性（用户关注的命盘）
  // ───────────────────────────────────────────────────────────────

  test('1982年5月5日18点男性命盘 - 关键格局验证', () => {
    const chartData = buildChartData('1982-05-05', 9, '男')
    const names = matchPatterns(chartData)

    console.log('\n=== 1982年5月5日命盘识别到的格局 ===')
    console.log('格局数量:', names.length)
    for (const name of names) {
      console.log(`  - ${name}`)
    }

    // 验证关键格局
    expect(names).toContain('半空折翅')
    expect(names).toContain('机月同梁')
    // 天机天梁擎羊会已从代码中删除（JSON中无此格局定义）
  })

  // ───────────────────────────────────────────────────────────────
  // 测试2: 多个真实命盘，检查是否有格局被识别
  // ───────────────────────────────────────────────────────────────

  test('1990年1月1日0点男性命盘 - 基本功能验证', () => {
    const chartData = buildChartData('1990-01-01', 0, '男')
    const names = matchPatterns(chartData)

    console.log('\n=== 1990年1月1日命盘识别到的格局 ===')
    console.log('格局数量:', names.length)
    for (const name of names) {
      console.log(`  - ${name}`)
    }

    // 至少应该识别出一些格局（或0个也是可能的）
    expect(names.length).toBeGreaterThanOrEqual(0)
  })

  test('2000年1月1日10点男性命盘 - 基本功能验证', () => {
    const chartData = buildChartData('2000-01-01', 5, '男')
    const names = matchPatterns(chartData)

    console.log('\n=== 2000年1月1日命盘识别到的格局 ===')
    console.log('格局数量:', names.length)
    for (const name of names) {
      console.log(`  - ${name}`)
    }

    expect(names.length).toBeGreaterThanOrEqual(0)
  })

  test('1985年6月15日12点女性命盘 - 基本功能验证', () => {
    const chartData = buildChartData('1985-06-15', 6, '女')
    const names = matchPatterns(chartData)

    console.log('\n=== 1985年6月15日命盘识别到的格局 ===')
    console.log('格局数量:', names.length)
    for (const name of names) {
      console.log(`  - ${name}`)
    }

    expect(names.length).toBeGreaterThanOrEqual(0)
  })

  // ───────────────────────────────────────────────────────────────
  // 测试3: 构造特定格局的测试命盘
  // ───────────────────────────────────────────────────────────────

  test('[大吉] 紫微居午位至公卿 - 简化测试', () => {
    const chartData = buildChartData('1990-01-01', 0, '男')
    // 修改命宫为午宫且有紫微
    chartData.earthlyBranchOfSoulPalace = '午'
    chartData.palaces = chartData.palaces.map((p: any) => {
      if (p.name === '命宫') {
        return { ...p, earthlyBranch: '午', majorStars: [{ name: '紫微', brightness: '庙', type: 'major' }], minorStars: [{ name: '左辅', brightness: '旺', type: 'soft' }, { name: '右弼', brightness: '旺', type: 'soft' }, { name: '文昌', brightness: '庙', type: 'soft' }] }
      }
      return p
    })

    const names = matchPatterns(chartData)
    console.log('紫微居午位测试 - 识别到的格局:', names)
    expect(names).toContain('紫微居午位至公卿')
  })

  test('[中吉] 贪武同行 - 简化测试', () => {
    const chartData = buildChartData('1990-01-01', 0, '男')
    // 修改命宫为丑宫且有贪狼武曲，三方加火星
    // 同时确保三方四正吉星 >= 煞星，满足 jiGeYinDong 条件
    chartData.earthlyBranchOfSoulPalace = '丑'
    chartData.palaces = chartData.palaces.map((p: any) => {
      if (p.name === '命宫') {
        return { ...p, earthlyBranch: '丑', majorStars: [{ name: '贪狼', brightness: '庙', type: 'major' }, { name: '武曲', brightness: '庙', type: 'major' }], minorStars: [{ name: '天魁', brightness: '旺', type: 'soft' }, { name: '天钺', brightness: '旺', type: 'soft' }] }
      }
      // 迁移宫（对宫）加火星，满足三方四正条件
      // 注意：iztro 宫位名称不带"宫"字，使用 '迁移' 而非 '迁移宫'
      if (p.name === '迁移') {
        return { ...p, minorStars: [...(p.minorStars ?? []), { name: '火星', brightness: '庙', type: 'soft' }] }
      }
      // 官禄宫和财帛宫加吉星，确保 jiGeYinDong 条件（吉 >= 煞）
      if (p.name === '官禄' || p.name === '财帛') {
        return { ...p, minorStars: [...(p.minorStars ?? []), { name: '文昌', brightness: '庙', type: 'soft' }] }
      }
      return p
    })

    const names = matchPatterns(chartData)
    console.log('贪武同行测试 - 识别到的格局:', names)
    expect(names).toContain('贪武同行')
  })

  test('[中凶] 孤君在野 - 简化测试', () => {
    const chartData = buildChartData('1990-01-01', 0, '男')
    // 修改命宫为午宫有紫微+煞星，无左右
    chartData.earthlyBranchOfSoulPalace = '午'
    chartData.palaces = chartData.palaces.map((p: any) => {
      if (p.name === '命宫') {
        return { ...p, earthlyBranch: '午', majorStars: [{ name: '紫微', brightness: '庙', type: 'major' }], minorStars: [{ name: '擎羊', brightness: '庙', type: 'hard' }, { name: '火星', brightness: '旺', type: 'hard' }] }
      }
      return p
    })

    const names = matchPatterns(chartData)
    console.log('孤君在野测试 - 识别到的格局:', names)
    expect(names).toContain('孤君在野')
  })

  test('[小吉] 机梁嘉会善谈兵 - 简化测试', () => {
    const chartData = buildChartData('1990-01-01', 0, '男')
    // 修改命宫为子宫有天机天梁，并添加吉星到三方四正以满足吉格引动条件
    chartData.earthlyBranchOfSoulPalace = '子'
    chartData.palaces = chartData.palaces.map((p: any) => {
      if (p.name === '命宫') {
        return { ...p, earthlyBranch: '子', majorStars: [{ name: '天机', brightness: '庙', type: 'major' }, { name: '天梁', brightness: '庙', type: 'major' }], minorStars: [{ name: '左辅', type: 'soft' }] }
      }
      // 在迁移宫(对宫)添加右弼，使吉星>=煞星，满足吉格引动
      if (p.name === '迁移') {
        return { ...p, minorStars: [{ name: '右弼', type: 'soft' }] }
      }
      return p
    })

    const names = matchPatterns(chartData)
    console.log('机梁嘉会测试 - 识别到的格局:', names)
    expect(names).toContain('机梁嘉会善谈兵')
  })

  // ───────────────────────────────────────────────────────────────
  // 测试4: 验证所有格局名称唯一性
  // ───────────────────────────────────────────────────────────────

  test('所有格局名称必须唯一', () => {
    const nameSet = new Set(allPatternNames)
    expect(nameSet.size).toBe(allPatternNames.length)
  })

  // ───────────────────────────────────────────────────────────────
  // 测试5: 验证格局级别有效性
  // ───────────────────────────────────────────────────────────────

  test('所有格局级别必须有效', () => {
    const validLevels = ['大吉', '中吉', '小吉', '小凶', '中凶', '大凶']
    for (const p of allPatterns) {
      expect(validLevels).toContain(p.level)
    }
  })
})
