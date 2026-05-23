/**
 * 运限格局识别引擎
 *
 * 为大限、流年、小限独立构建 ScoringContext，运行完整的 Stage1 格局判定流程。
 * 核心思路：运限的四化会改变星曜属性，因此需要重新构建带运限四化的宫位数据，
 * 然后复用原局的格局判定逻辑（allPatterns.evaluate）。
 */

import 'server-only'

import type {
  TianGan, DiZhi, PatternMatch, LimitPatternResult,
  LimitPatternsOutput, LimitType,
} from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { evaluatePalacePatternsOnly } from '@/core/energy-evaluator/pattern-scoring'
import { extractAllDaXianMappings } from './fortune-engine'
import {
  buildDaXianScoringContext,
  buildYearlyScoringContext,
  buildMinorScoringContext,
  getMinorMingPalaceIndex,
  getYearBranch,
  getYearStem,
} from './limit-scoring-context'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/** 运限格局识别输入 */
export interface LimitPatternInput {
  /** 原局命盘数据 */
  natalCtx: ScoringContext
  /** 命盘原始数据（用于重建 iztro 对象提取大限） */
  chartData: Record<string, unknown>
  /** 出生年份 */
  birthYear: number
  /** 性别 */
  gender: '男' | '女'
  /** 目标流年列表（可选，默认只计算当前前后5年） */
  targetYears?: number[]
  /** 是否计算小限 */
  includeMinor?: boolean
}

// ═══════════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════════

/**
 * 执行全量运限格局识别
 *
 * 流程：
 * 1. 提取十大限映射
 * 2. 对每个大限构建带大限四化的 ScoringContext → 运行格局判定
 * 3. 对目标流年构建带流年四化的 ScoringContext → 运行格局判定
 * 4. 对比原局格局，生成综合分析
 */
export function evaluateLimitPatterns(input: LimitPatternInput): LimitPatternsOutput {
  const { natalCtx, chartData, birthYear, gender, targetYears, includeMinor } = input

  // 1. 原局格局（十二锚定）
  const natalPalacePatterns = evaluatePalacePatternsOnly(natalCtx)
  const natalPatterns = natalPalacePatterns[0] ?? []

  // 2. 十大限格局
  const daXianMappings = extractAllDaXianMappings(chartData, birthYear)
  const decadalPatterns: LimitPatternResult[] = []

  for (const mapping of daXianMappings) {
    const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
    if (!daXianCtx) continue

    const palacePatterns = evaluatePalacePatternsOnly(daXianCtx)
    const patterns = palacePatterns[mapping.palaceIndex] ?? palacePatterns[0] ?? []
    const comparison = compareWithNatal(natalPatterns, patterns)

    decadalPatterns.push({
      limitType: '大限',
      limitLabel: `第${mapping.index}大限 ${mapping.ageRange[0]}-${mapping.ageRange[1]}岁`,
      mingPalaceIndex: mapping.palaceIndex,
      mingPalaceZhi: natalCtx.palaces[mapping.palaceIndex]?.diZhi ?? '子',
      limitGan: mapping.daXianGan,
      patterns,
      palacePatterns,
      comparisonWithNatal: comparison,
    })
  }

  // 3. 流年格局
  const years = targetYears ?? generateDefaultYears(birthYear)
  const yearlyPatterns: LimitPatternResult[] = []

  for (const year of years) {
    const liuNianZhi = getYearBranch(year)
    const yearlyCtx = buildYearlyScoringContext(year, natalCtx)
    if (!yearlyCtx) continue

    const palacePatterns = evaluatePalacePatternsOnly(yearlyCtx)
    const mingIdx = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
    const anchorIdx = mingIdx >= 0 ? mingIdx : 0
    const patterns = palacePatterns[anchorIdx] ?? palacePatterns[0] ?? []
    const comparison = compareWithNatal(natalPatterns, patterns)

    yearlyPatterns.push({
      limitType: '流年',
      limitLabel: `${year}年（${liuNianZhi}）`,
      mingPalaceIndex: anchorIdx,
      mingPalaceZhi: liuNianZhi,
      limitGan: getYearStem(year),
      patterns,
      palacePatterns,
      comparisonWithNatal: comparison,
    })
  }

  // 4. 小限格局（可选）
  let minorPatterns: LimitPatternResult[] | undefined
  if (includeMinor) {
    minorPatterns = evaluateMinorPatterns(natalCtx, birthYear, gender, daXianMappings)
  }

  // 5. 综合分析
  const synthesis = generateSynthesis(natalPatterns, decadalPatterns, yearlyPatterns)

  return {
    natalPatterns,
    natalPalacePatterns,
    decadalPatterns,
    yearlyPatterns,
    minorPatterns,
    synthesis,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 小限格局识别
// ═══════════════════════════════════════════════════════════════════

/**
 * 评估小限格局
 * 小限：男顺女逆，从寅宫起1岁
 */
function evaluateMinorPatterns(
  natalCtx: ScoringContext,
  birthYear: number,
  gender: '男' | '女',
  daXianMappings: Array<{ ageRange: [number, number] }>,
): LimitPatternResult[] {
  const results: LimitPatternResult[] = []

  // 计算每个大限期间的小限
  for (const dx of daXianMappings) {
    for (let age = dx.ageRange[0]; age <= dx.ageRange[1]; age++) {
      const minorCtx = buildMinorScoringContext(age, gender, natalCtx)
      if (!minorCtx) continue

      const palacePatterns = evaluatePalacePatternsOnly(minorCtx)
      const mingIdx = getMinorMingPalaceIndex(age, gender, natalCtx)
      const patterns = palacePatterns[mingIdx] ?? palacePatterns[0] ?? []

      results.push({
        limitType: '小限',
        limitLabel: `${age}岁小限`,
        mingPalaceIndex: mingIdx,
        mingPalaceZhi: natalCtx.palaces[mingIdx]?.diZhi ?? '子',
        limitGan: minorCtx.birthGan,
        patterns,
        palacePatterns,
      })
    }
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 对比运限格局与原局格局
 */
function compareWithNatal(
  natalPatterns: PatternMatch[],
  limitPatterns: PatternMatch[],
) {
  const natalNames = new Set(natalPatterns.map(p => p.name))
  const limitNames = new Set(limitPatterns.map(p => p.name))

  const newPatterns = limitPatterns.filter(p => !natalNames.has(p.name))
  const lostPatterns = natalPatterns.filter(p => !limitNames.has(p.name))
  const sustainedPatterns = limitPatterns.filter(p => natalNames.has(p.name))

  let conclusion = ''
  if (newPatterns.length > 0 && lostPatterns.length > 0) {
    conclusion = `格局转换期：新增${newPatterns.length}个格局，消失${lostPatterns.length}个格局`
  } else if (newPatterns.length > 0) {
    conclusion = `格局增强期：新增${newPatterns.length}个格局`
  } else if (lostPatterns.length > 0) {
    conclusion = `格局减弱期：消失${lostPatterns.length}个格局`
  } else if (sustainedPatterns.length > 0) {
    conclusion = `格局稳定期：原局格局持续发挥作用`
  } else {
    conclusion = `格局平淡期：无特殊格局`
  }

  return {
    natalPatternCount: natalPatterns.length,
    newPatternCount: newPatterns.length,
    lostPatternCount: lostPatterns.length,
    sustainedPatternCount: sustainedPatterns.length,
    conclusion,
  }
}

/**
 * 生成运限格局综合分析
 */
function generateSynthesis(
  natalPatterns: PatternMatch[],
  decadalPatterns: LimitPatternResult[],
  yearlyPatterns: LimitPatternResult[],
) {
  // 统计大限格局数量变化趋势
  const decadalCounts = decadalPatterns.map(d => ({
    label: d.limitLabel,
    count: d.patterns.length,
    newCount: d.comparisonWithNatal?.newPatternCount ?? 0,
    lostCount: d.comparisonWithNatal?.lostPatternCount ?? 0,
  }))

  // 找出格局最多的大限
  const maxDecennial = decadalCounts.reduce((max, curr) =>
    curr.count > max.count ? curr : max, decadalCounts[0] ?? { label: '', count: 0 })

  // 找出格局最少的大限
  const minDecennial = decadalCounts.reduce((min, curr) =>
    curr.count < min.count ? curr : min, decadalCounts[0] ?? { label: '', count: 0 })

  // 关键转折大限（格局数量变化最大的）
  const keyDecennials: string[] = []
  for (let i = 1; i < decadalCounts.length; i++) {
    const prev = decadalCounts[i - 1]
    const curr = decadalCounts[i]
    const change = Math.abs(curr.count - prev.count)
    if (change >= 2) {
      keyDecennials.push(curr.label)
    }
  }

  // 流年格局峰值年份
  const yearlyCounts = yearlyPatterns.map(y => ({ year: y.limitLabel, count: y.patterns.length }))
  const maxYearly = yearlyCounts.reduce((max, curr) =>
    curr.count > max.count ? curr : max, yearlyCounts[0] ?? { year: '', count: 0 })

  const peakYears: number[] = []
  if (maxYearly && maxYearly.count > 0) {
    const match = maxYearly.year.match(/(\d{4})/)
    if (match) peakYears.push(parseInt(match[1]))
  }

  // 趋势总结
  let trend = ''
  if (natalPatterns.length === 0) {
    trend = '原局无格局，运势起伏取决于运限引动'
  } else if (maxDecennial.count > natalPatterns.length) {
    trend = `运限可增强格局能量，${maxDecennial.label}格局最旺`
  } else if (minDecennial.count < natalPatterns.length) {
    trend = `运限可能削弱格局能量，${minDecennial.label}格局最弱`
  } else {
    trend = '格局能量相对稳定，原局格局持续发挥'
  }

  return {
    trend,
    keyDecennials,
    peakYears,
  }
}

/**
 * 生成默认流年列表（当前年前后5年）
 */
function generateDefaultYears(birthYear: number): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    if (y >= birthYear) years.push(y)
  }
  return years
}

/**
 * 获取年份天干（本地别名，供本模块辅助函数使用）
 */
function getYearStemLocal(year: number): TianGan {
  return getYearStem(year)
}

// ═══════════════════════════════════════════════════════════════════
// 便捷 API
// ═══════════════════════════════════════════════════════════════════

/**
 * 仅评估单个大限的格局
 */
export function evaluateSingleDecennialPatterns(
  natalCtx: ScoringContext,
  daXianMapping: { daXianGan: TianGan; mutagen: string[]; palaceIndex: number; ageRange: [number, number]; index: number },
): LimitPatternResult | null {
  const daXianCtx = buildDaXianScoringContext(daXianMapping, natalCtx)
  if (!daXianCtx) return null

  const palacePatterns = evaluatePalacePatternsOnly(daXianCtx)
  const patterns = palacePatterns[daXianMapping.palaceIndex] ?? palacePatterns[0] ?? []

  return {
    limitType: '大限',
    limitLabel: `第${daXianMapping.index}大限 ${daXianMapping.ageRange[0]}-${daXianMapping.ageRange[1]}岁`,
    mingPalaceIndex: daXianMapping.palaceIndex,
    mingPalaceZhi: natalCtx.palaces[daXianMapping.palaceIndex]?.diZhi ?? '子',
    limitGan: daXianMapping.daXianGan,
    patterns,
    palacePatterns,
  }
}

/**
 * 仅评估单个流年的格局
 */
export function evaluateSingleYearlyPatterns(
  natalCtx: ScoringContext,
  year: number,
): LimitPatternResult | null {
  const yearlyCtx = buildYearlyScoringContext(year, natalCtx)
  if (!yearlyCtx) return null

  const palacePatterns = evaluatePalacePatternsOnly(yearlyCtx)
  const liuNianZhi = getYearBranch(year)
  const mingIdx = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
  const anchorIdx = mingIdx >= 0 ? mingIdx : 0
  const patterns = palacePatterns[anchorIdx] ?? palacePatterns[0] ?? []

  return {
    limitType: '流年',
    limitLabel: `${year}年（${liuNianZhi}）`,
    mingPalaceIndex: anchorIdx,
    mingPalaceZhi: liuNianZhi,
    limitGan: getYearStem(year),
    patterns,
    palacePatterns,
  }
}
