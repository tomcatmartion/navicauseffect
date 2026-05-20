/**
 * 运限格局识别引擎
 *
 * 为大限、流年、小限独立构建 ScoringContext，运行完整的 Stage1 格局判定流程。
 * 核心思路：运限的四化会改变星曜属性，因此需要重新构建带运限四化的宫位数据，
 * 然后复用原局的格局判定逻辑（allPatterns.evaluate）。
 */

import 'server-only'

import type {
  TianGan, DiZhi, PalaceName, PatternMatch, LimitPatternResult,
  LimitPatternsOutput, LimitType, SihuaType, SihuaEntry,
} from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { allPatterns } from '@/core/energy-evaluator/patterns'
import type { ChartAccessor } from '@/core/energy-evaluator/patterns'
import { getPatternMultiplier } from '@/core/energy-evaluator/patterns'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import { extractAllDaXianMappings } from './fortune-engine'

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

  // 1. 原局格局（基准）
  const natalPatterns = evaluatePatternsForContext(natalCtx)

  // 2. 十大限格局
  const daXianMappings = extractAllDaXianMappings(chartData, birthYear)
  const decadalPatterns: LimitPatternResult[] = []

  for (const mapping of daXianMappings) {
    const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
    if (!daXianCtx) continue

    const patterns = evaluatePatternsForContext(daXianCtx)
    const comparison = compareWithNatal(natalPatterns, patterns)

    decadalPatterns.push({
      limitType: '大限',
      limitLabel: `第${mapping.index}大限 ${mapping.ageRange[0]}-${mapping.ageRange[1]}岁`,
      mingPalaceIndex: mapping.palaceIndex,
      mingPalaceZhi: natalCtx.palaces[mapping.palaceIndex]?.diZhi ?? '子',
      limitGan: mapping.daXianGan,
      patterns,
      comparisonWithNatal: comparison,
    })
  }

  // 3. 流年格局
  const years = targetYears ?? generateDefaultYears(birthYear)
  const yearlyPatterns: LimitPatternResult[] = []

  for (const year of years) {
    const yearlyCtx = buildYearlyScoringContext(year, natalCtx)
    if (!yearlyCtx) continue

    const patterns = evaluatePatternsForContext(yearlyCtx)
    const comparison = compareWithNatal(natalPatterns, patterns)

    // 流年命宫 = 流年地支所在宫位
    const liuNianZhi = getYearBranch(year)
    const mingIdx = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)

    yearlyPatterns.push({
      limitType: '流年',
      limitLabel: `${year}年（${liuNianZhi}）`,
      mingPalaceIndex: mingIdx >= 0 ? mingIdx : 0,
      mingPalaceZhi: liuNianZhi,
      limitGan: getYearStem(year),
      patterns,
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
    decadalPatterns,
    yearlyPatterns,
    minorPatterns,
    synthesis,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 格局判定核心（复用原局逻辑）
// ═══════════════════════════════════════════════════════════════════

/**
 * 对给定的 ScoringContext 运行格局判定
 */
function evaluatePatternsForContext(ctx: ScoringContext): PatternMatch[] {
  const accessor = buildChartAccessor(ctx)
  const matched = allPatterns.filter(p => p.evaluate(accessor))

  return matched.map(p => ({
    name: p.name,
    level: p.level,
    multiplier: getPatternMultiplier(p.level),
    category: p.category,
  }))
}

/**
 * 构建 ChartAccessor（复用 stage1-palace-scoring.ts 的逻辑）
 */
function buildChartAccessor(ctx: ScoringContext): ChartAccessor {
  return {
    getStarsInPalace(palaceIndex: number) {
      const p = ctx.palaces[palaceIndex]
      return p?.majorStars ?? []
    },

    getAuxStarsInPalace(palaceIndex: number) {
      const p = ctx.palaces[palaceIndex]
      return p?.stars.filter(s => !p.majorStars.some(m => m.star === s.name)).map(s => s.name) ?? []
    },

    hasStarInPalace(palaceIndex: number, star: string) {
      const p = ctx.palaces[palaceIndex]
      if (!p) return false
      return p.stars.some(s => s.name === star) || p.majorStars.some(m => m.star === star)
    },

    hasSihuaInPalace(palaceIndex: number, type: SihuaType, source?: string) {
      const p = ctx.palaces[palaceIndex]
      if (!p) return false
      return p.stars.some(s => {
        if (s.sihua !== type) return false
        if (source && s.sihuaSource !== source) return false
        return true
      })
    },

    getPalaceBrightness(palaceIndex: number) {
      const p = ctx.palaces[palaceIndex]
      return p?.majorStars[0]?.brightness ?? '平'
    },

    getPalaceDiZhi(palaceIndex: number) {
      return ctx.palaces[palaceIndex]?.diZhi ?? '子'
    },

    getOppositeIndex(palaceIndex: number) {
      return (palaceIndex + 6) % 12
    },

    getTrineIndices(palaceIndex: number): [number, number] {
      return [(palaceIndex + 4) % 12, (palaceIndex + 8) % 12]
    },

    getFlankingIndices(palaceIndex: number): [number, number] {
      return [(palaceIndex + 1) % 12, (palaceIndex + 11) % 12]
    },

    hasFlanking(palaceIndex: number): boolean {
      const [left, right] = this.getFlankingIndices(palaceIndex)
      const leftHas = (ctx.palaces[left]?.stars.length ?? 0) > 0
      const rightHas = (ctx.palaces[right]?.stars.length ?? 0) > 0
      return leftHas && rightHas
    },

    countAuspiciousInPalaces(palaceIndices: number[]) {
      const auspicious = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'])
      let count = 0
      for (const idx of palaceIndices) {
        const p = ctx.palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (auspicious.has(s.name)) count++
          if (s.sihua === '化禄') count++
        }
      }
      return count
    },

    countInauspiciousInPalaces(palaceIndices: number[]) {
      const inauspicious = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'])
      let count = 0
      for (const idx of palaceIndices) {
        const p = ctx.palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (inauspicious.has(s.name)) count++
          if (s.sihua === '化忌') count++
        }
      }
      return count
    },

    mingGongIndex: 0,
    shenGongIndex: ctx.shenGongIndex ?? 0,
    birthGan: ctx.birthGan,
    birthZhi: ctx.taiSuiZhi,

    hasStarSihua(star: string, type: SihuaType) {
      for (const p of ctx.palaces) {
        for (const s of p.stars) {
          if (s.name === star && s.sihua === type) return true
        }
      }
      return false
    },

    countSihuaInPalacesFromSource(palaceIndices: number[], type: string, source: string) {
      let count = 0
      for (const idx of palaceIndices) {
        const p = ctx.palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (s.sihua === type && s.sihuaSource === source) count++
        }
      }
      return count
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// 大限 ScoringContext 构建
// ═══════════════════════════════════════════════════════════════════

/**
 * 构建带大限四化的 ScoringContext
 */
function buildDaXianScoringContext(
  mapping: { daXianGan: TianGan; mutagen: string[]; palaceIndex: number },
  natalCtx: ScoringContext,
): ScoringContext | null {
  if (!mapping.mutagen || mapping.mutagen.length < 4) return null

  // 深拷贝原局宫位数据
  const daXianPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  // 注入大限四化
  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < mapping.mutagen.length && i < 4; i++) {
    const starName = mapping.mutagen[i]
    const sihuaType = sihuaTypes[i]
    for (const palace of daXianPalaces) {
      for (const star of palace.stars) {
        if (star.name === starName && !star.sihua) {
          star.sihua = sihuaType
          star.sihuaSource = '大限'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: daXianPalaces,
    birthGan: mapping.daXianGan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

// ═══════════════════════════════════════════════════════════════════
// 流年 ScoringContext 构建
// ═══════════════════════════════════════════════════════════════════

/**
 * 构建带流年四化的 ScoringContext
 */
function buildYearlyScoringContext(
  year: number,
  natalCtx: ScoringContext,
): ScoringContext | null {
  const gan = getYearStem(year)
  const sihuaMap = getSihuaTable()[gan]
  if (!sihuaMap) return null

  // 深拷贝原局宫位数据
  const yearlyPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  // 注入流年四化（不覆盖已有四化）
  const entries: { star: string; type: SihuaType }[] = [
    { star: sihuaMap.禄, type: '化禄' },
    { star: sihuaMap.权, type: '化权' },
    { star: sihuaMap.科, type: '化科' },
    { star: sihuaMap.忌, type: '化忌' },
  ]

  for (const { star, type } of entries) {
    for (const palace of yearlyPalaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '流年'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: yearlyPalaces,
    birthGan: gan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
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

      const patterns = evaluatePatternsForContext(minorCtx)
      const mingIdx = getMinorMingPalaceIndex(age, gender, natalCtx)

      results.push({
        limitType: '小限',
        limitLabel: `${age}岁小限`,
        mingPalaceIndex: mingIdx,
        mingPalaceZhi: natalCtx.palaces[mingIdx]?.diZhi ?? '子',
        limitGan: natalCtx.birthGan,
        patterns,
      })
    }
  }

  return results
}

/**
 * 构建带小限四化的 ScoringContext
 * 小限四化 = 小限宫位的天干四化
 */
function buildMinorScoringContext(
  age: number,
  gender: '男' | '女',
  natalCtx: ScoringContext,
): ScoringContext | null {
  const mingIdx = getMinorMingPalaceIndex(age, gender, natalCtx)
  const mingPalace = natalCtx.palaces[mingIdx]
  if (!mingPalace) return null

  // 小限天干 = 小限命宫的天干（PalaceForScoring 没有 tianGan，用 birthGan 代替）
  const minorGan = natalCtx.birthGan
  const sihuaMap = getSihuaTable()[minorGan as keyof ReturnType<typeof getSihuaTable>]
  if (!sihuaMap) return null

  // 深拷贝
  const minorPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  // 注入小限四化
  const entries: { star: string; type: SihuaType }[] = [
    { star: sihuaMap.禄, type: '化禄' },
    { star: sihuaMap.权, type: '化权' },
    { star: sihuaMap.科, type: '化科' },
    { star: sihuaMap.忌, type: '化忌' },
  ]

  for (const { star, type } of entries) {
    for (const palace of minorPalaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '小限'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: minorPalaces,
    birthGan: minorGan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

/**
 * 计算小限命宫索引
 * 男顺女逆，从寅宫起1岁
 */
function getMinorMingPalaceIndex(
  age: number,
  gender: '男' | '女',
  natalCtx: ScoringContext,
): number {
  const yinIdx = natalCtx.palaces.findIndex(p => p.diZhi === '寅')
  const baseIdx = yinIdx >= 0 ? yinIdx : 2

  let idx: number
  if (gender === '男') {
    idx = (baseIdx + age - 1) % 12
  } else {
    idx = (baseIdx - age + 1 + 12) % 12
  }
  return idx
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
 * 获取年份天干
 */
function getYearStem(year: number): TianGan {
  const stems: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  const offset = ((year - 4) % 10 + 10) % 10
  return stems[offset]
}

/**
 * 获取年份地支
 */
function getYearBranch(year: number): DiZhi {
  const branches: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const offset = ((year - 4) % 12 + 12) % 12
  return branches[offset]
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

  const patterns = evaluatePatternsForContext(daXianCtx)

  return {
    limitType: '大限',
    limitLabel: `第${daXianMapping.index}大限 ${daXianMapping.ageRange[0]}-${daXianMapping.ageRange[1]}岁`,
    mingPalaceIndex: daXianMapping.palaceIndex,
    mingPalaceZhi: natalCtx.palaces[daXianMapping.palaceIndex]?.diZhi ?? '子',
    limitGan: daXianMapping.daXianGan,
    patterns,
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

  const patterns = evaluatePatternsForContext(yearlyCtx)
  const liuNianZhi = getYearBranch(year)
  const mingIdx = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)

  return {
    limitType: '流年',
    limitLabel: `${year}年（${liuNianZhi}）`,
    mingPalaceIndex: mingIdx >= 0 ? mingIdx : 0,
    mingPalaceZhi: liuNianZhi,
    limitGan: getYearStem(year),
    patterns,
  }
}
