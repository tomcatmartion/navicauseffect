/**
 * M2: 通用 JSON Condition 解析器
 *
 * 直接解析 pattern_library.json 中的 condition 字段，动态评估格局条件。
 * 支持所有算子：and, or, not, starInPalace, anyStarInPalace, anyStarInTriples,
 * allStarsInTriples, countStarsInTriples, clampStars, palaceBrightness,
 * palaceMajorEmpty, sameSourceSanJi, shengNianGan, dizhi 等。
 *
 * 核心原则：
 * - "锚定宫" / "锚定宫" = 当前正在评估的宫位（anchorPalaceIndex）
 * - "身宫" = chart.shenGongIndex
 * - "迁移宫" = anchorPalaceIndex 的对宫
 * - "basePalace": "锚定宫" 表示以锚定宫为基准取三方四正
 * - palaceName 中的 "太阳所在宫" / "太阴所在宫" 需要动态查找
 */

import type { ChartAccessor } from './types'
import { getSanFangSiZheng } from './types'
import { PALACE_NAME_TO_INDEX } from '../../types'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

export type ConditionValue = string | string[] | { in: string[] } | number | boolean | Record<string, unknown>

export interface Condition {
  and?: Condition[]
  or?: Condition[]
  any?: Condition[]
  not?: Condition
  starInPalace?: string
  star?: ConditionValue
  palaceName?: string
  dizhi?: ConditionValue
  brightness?: string
  anyStarInPalace?: string[]
  starIn?: string[]
  anyStarInTriples?: string[]
  basePalace?: string
  samePalace?: boolean
  allStarsInTriples?: string[]
  countStarsInTriples?: { stars: string[]; min?: number; max?: number }
  clampStars?: { left: string; right: string; target: string }
  palaceBrightness?: { palaceName: string; brightness: string }
  palaceMajorEmpty?: boolean
  sameSourceSanJi?: { source: string[]; types: string[] }
  shengNianGan?: ConditionValue
  /** 三方四正内有指定四化类型 */
  sihuaInTriples?: { types: string[]; basePalace?: string; source?: string }
  /** 指定宫位有指定四化类型（任意星） */
  sihuaInPalace?: { types: string | string[]; palaceName?: string }
  /** 指定星有指定四化 */
  starSihua?: { star: string | string[]; type: string | string[] }
  /** 三方四正见禄（禄存或化禄） */
  hasLuInTriples?: true | { basePalace?: string }
  /** 吉格引动：三方四正吉 >= 煞 */
  jiGeYinDong?: true | { palaceName?: string }
  /** 凶格引动：三方四正煞 > 吉 */
  xiongGeYinDong?: true | { palaceName?: string }
  [key: string]: unknown
}

// ═══════════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════════

export function evaluateCondition(chart: ChartAccessor, condition: Condition | unknown): boolean {
  if (condition === null || condition === undefined) return true
  if (typeof condition !== 'object') return false

  const cond = condition as Condition

  // 逻辑算子
  if (cond.and !== undefined) {
    if (!Array.isArray(cond.and)) return false
    return cond.and.every((c) => evaluateCondition(chart, c))
  }
  if (cond.or !== undefined) {
    if (!Array.isArray(cond.or)) return false
    return cond.or.some((c) => evaluateCondition(chart, c))
  }
  // any 与 or 同义（pattern_library 部分条目使用）
  if (cond.any !== undefined) {
    if (!Array.isArray(cond.any)) return false
    return cond.any.some((c) => evaluateCondition(chart, c))
  }
  if (cond.not !== undefined) {
    return !evaluateCondition(chart, cond.not)
  }

  // 新增算子 — 四化检测
  if (cond.sihuaInTriples !== undefined) {
    return evalSihuaInTriples(chart, cond.sihuaInTriples)
  }
  if (cond.sihuaInPalace !== undefined) {
    return evalSihuaInPalace(chart, cond.sihuaInPalace)
  }
  if (cond.starSihua !== undefined) {
    return evalStarSihua(chart, cond.starSihua)
  }
  if (cond.hasLuInTriples !== undefined) {
    return evalHasLuInTriples(chart, cond.hasLuInTriples)
  }
  if (cond.jiGeYinDong !== undefined) {
    return evalJiGeYinDong(chart, cond.jiGeYinDong)
  }
  if (cond.xiongGeYinDong !== undefined) {
    return evalXiongGeYinDong(chart, cond.xiongGeYinDong)
  }

  // 夹宫算子
  if (cond.clampStars !== undefined) {
    return evalClampStars(chart, cond.clampStars)
  }

  // 宫位亮度
  if (cond.palaceBrightness !== undefined) {
    return evalPalaceBrightness(chart, cond.palaceBrightness)
  }

  // 空宫判定
  if (cond.palaceMajorEmpty !== undefined) {
    return evalPalaceMajorEmpty(chart, cond.palaceMajorEmpty)
  }

  // 三奇嘉会（同来源）
  if (cond.sameSourceSanJi !== undefined) {
    return evalSameSourceSanJi(chart, cond.sameSourceSanJi)
  }

  // 生年天干
  if (cond.shengNianGan !== undefined) {
    return evalShengNianGan(chart, cond.shengNianGan)
  }

  // 单星在某宫（含 anyStarInPalace）
  if (cond.starInPalace !== undefined || cond.anyStarInPalace !== undefined) {
    return evalStarInPalace(chart, cond)
  }

  // 三方四正星曜判定
  if (cond.anyStarInTriples !== undefined || cond.allStarsInTriples !== undefined || cond.countStarsInTriples !== undefined) {
    return evalStarsInTriples(chart, cond)
  }

  // 日月/邻宫吉化
  if (cond.palaceHasJiHua !== undefined) {
    return evalPalaceHasJiHua(chart, cond as { palaceHasJiHua: string[]; scope?: string; type?: string })
  }

  // 未知算子
  return false
}

// ═══════════════════════════════════════════════════════════════════
// 辅助：解析 palaceName 为宫位索引
// ═══════════════════════════════════════════════════════════════════

function resolvePalaceIndex(chart: ChartAccessor, palaceName: string): number | null {
  if (palaceName === '锚定宫' || palaceName === '锚定宫') {
    return chart.anchorPalaceIndex
  }
  if (palaceName === '身宫') {
    return chart.shenGongIndex
  }
  if (palaceName === '迁移宫') {
    return chart.getOppositeIndex(chart.anchorPalaceIndex)
  }
  if (palaceName === '太阳所在宫') {
    return findStarPalace(chart, '太阳')
  }
  if (palaceName === '太阴所在宫') {
    return findStarPalace(chart, '太阴')
  }
  // 支持「疾厄」「疾厄宫」等与 PALACE_NAME_TO_INDEX 对齐
  const normalized = palaceName.endsWith('宫') ? palaceName.slice(0, -1) : palaceName
  if (normalized in PALACE_NAME_TO_INDEX) {
    return PALACE_NAME_TO_INDEX[normalized as keyof typeof PALACE_NAME_TO_INDEX]
  }
  if (palaceName in PALACE_NAME_TO_INDEX) {
    return PALACE_NAME_TO_INDEX[palaceName as keyof typeof PALACE_NAME_TO_INDEX]
  }
  return null
}

function findStarPalace(chart: ChartAccessor, star: string): number | null {
  for (let i = 0; i < 12; i++) {
    if (chart.hasStarInPalace(i, star)) return i
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════
// 值匹配辅助
// ═══════════════════════════════════════════════════════════════════

function matchValue(actual: string, expected: ConditionValue): boolean {
  if (typeof expected === 'string') {
    return actual === expected
  }
  if (Array.isArray(expected)) {
    return expected.includes(actual)
  }
  if (expected && typeof expected === 'object' && 'in' in expected) {
    const arr = (expected as { in: string[] }).in
    return Array.isArray(arr) && arr.includes(actual)
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════
// starInPalace / anyStarInPalace 解析
// ═══════════════════════════════════════════════════════════════════

function evalStarInPalace(chart: ChartAccessor, cond: Condition): boolean {
  const palaceName = (cond.palaceName as string) || '锚定宫'
  const palaceIdx = resolvePalaceIndex(chart, palaceName)
  if (palaceIdx === null) return false

  // anyStarInPalace: 多颗星中任意一颗在指定宫位
  if (cond.anyStarInPalace !== undefined) {
    const stars = cond.anyStarInPalace
    if (!Array.isArray(stars)) return false
    // 可选的 starIn 过滤（指定这些星必须在 starIn 列表中）
    const starInFilter = cond.starIn as string[] | undefined
    for (const star of stars) {
      if (starInFilter && !starInFilter.includes(star)) continue
      if (SIHUA_TYPE_NAMES.has(star)) {
        if (chart.hasSihuaInPalace(palaceIdx, star as SihuaType)) return true
      } else {
        if (chart.hasStarInPalace(palaceIdx, star)) return true
      }
    }
    return false
  }

  // starInPalace: 单颗星在指定宫位
  const star = cond.starInPalace as string
  if (!star) return false

  // 检查星名匹配（支持 star 字段作为额外过滤）
  const starFilter = cond.star
  if (starFilter !== undefined) {
    // starInPalace 是四化类型（化禄/化权/化科/化忌），star 是目标星
    const sihuaTypes = ['化禄', '化权', '化科', '化忌']
    if (sihuaTypes.includes(star)) {
      const type = star as '化禄' | '化权' | '化科' | '化忌'
      if (typeof starFilter === 'string') {
        return chart.hasSihuaInPalace(palaceIdx, type, starFilter) ||
               chart.hasStarSihua(starFilter, type)
      }
      if (Array.isArray(starFilter)) {
        return starFilter.some((s) =>
          chart.hasSihuaInPalace(palaceIdx, type, s) || chart.hasStarSihua(s, type)
        )
      }
      if (starFilter && typeof starFilter === 'object' && 'in' in starFilter) {
        const arr = (starFilter as { in: string[] }).in
        return arr.some((s) =>
          chart.hasSihuaInPalace(palaceIdx, type, s) || chart.hasStarSihua(s, type)
        )
      }
      return false
    }
  }

  if (!chart.hasStarInPalace(palaceIdx, star)) return false

  // 可选：地支过滤
  if (cond.dizhi !== undefined) {
    const actualDizhi = chart.getPalaceDiZhi(palaceIdx)
    if (!matchValue(actualDizhi, cond.dizhi)) return false
  }

  // 可选：亮度过滤
  if (cond.brightness !== undefined) {
    const actualBrightness = chart.getPalaceBrightness(palaceIdx)
    if (actualBrightness !== cond.brightness) return false
  }

  return true
}

// ═══════════════════════════════════════════════════════════════════
// anyStarInTriples / allStarsInTriples / countStarsInTriples
// ═══════════════════════════════════════════════════════════════════

function evalStarsInTriples(chart: ChartAccessor, cond: Condition): boolean {
  const basePalace = (cond.basePalace as string) || '锚定宫'
  const baseIdx = resolvePalaceIndex(chart, basePalace)
  if (baseIdx === null) return false

  const sf = getSanFangSiZheng(chart, baseIdx)

  // samePalace=true: 所有指定星必须在同一宫位
  const samePalace = cond.samePalace === true

  // anyStarInTriples: 多颗星中任意一颗在三方四正
  if (cond.anyStarInTriples !== undefined) {
    const stars = cond.anyStarInTriples
    if (!Array.isArray(stars)) return false

    if (samePalace) {
      // 所有星必须在同一宫位（该宫位在三方四正范围内）
      for (const idx of sf) {
        const allInThisPalace = stars.every((s) =>
          SIHUA_TYPE_NAMES.has(s)
            ? chart.hasSihuaInPalace(idx, s as SihuaType)
            : chart.hasStarInPalace(idx, s),
        )
        if (allInThisPalace) return true
      }
      return false
    }

    // 正常：任意一颗在三方四正任意位置
    return stars.some((star) =>
      sf.some((idx) =>
        SIHUA_TYPE_NAMES.has(star)
          ? chart.hasSihuaInPalace(idx, star as SihuaType)
          : chart.hasStarInPalace(idx, star),
      ),
    )
  }

  // allStarsInTriples: 所有星都必须出现在三方四正
  if (cond.allStarsInTriples !== undefined) {
    const stars = cond.allStarsInTriples
    if (!Array.isArray(stars)) return false
    return stars.every((star) =>
      sf.some((idx) =>
        SIHUA_TYPE_NAMES.has(star)
          ? chart.hasSihuaInPalace(idx, star as SihuaType)
          : chart.hasStarInPalace(idx, star),
      ),
    )
  }

  // countStarsInTriples: 统计出现数量
  if (cond.countStarsInTriples !== undefined) {
    const cfg = cond.countStarsInTriples
    const stars = cfg.stars
    if (!Array.isArray(stars)) return false

    let count = 0
    for (const star of stars) {
      if (sf.some((idx) => chart.hasStarInPalace(idx, star))) count++
    }

    if (cfg.min !== undefined && count < cfg.min) return false
    if (cfg.max !== undefined && count > cfg.max) return false
    return true
  }

  return false
}

// ═══════════════════════════════════════════════════════════════════
// clampStars: 夹宫判定
// ═══════════════════════════════════════════════════════════════════

function evalClampStars(chart: ChartAccessor, cfg: { left: string; right: string; target: string }): boolean {
  const targetIdx = resolvePalaceIndex(chart, cfg.target)
  if (targetIdx === null) return false

  const [leftIdx, rightIdx] = chart.getFlankingIndices(targetIdx)

  const leftMatch = chart.hasStarInPalace(leftIdx, cfg.left)
  const rightMatch = chart.hasStarInPalace(rightIdx, cfg.right)
  if (leftMatch && rightMatch) return true

  // 反向也成立
  const leftReverse = chart.hasStarInPalace(leftIdx, cfg.right)
  const rightReverse = chart.hasStarInPalace(rightIdx, cfg.left)
  return leftReverse && rightReverse
}

// ═══════════════════════════════════════════════════════════════════
// palaceBrightness: 宫位亮度判定
// ═══════════════════════════════════════════════════════════════════

/** iztro 原始亮度 → 系统转换亮度 映射 */
const BRIGHTNESS_MAP: Record<string, string> = {
  '庙': '极旺',
  '旺': '旺',
  '得': '平',
  '利': '平',
  '平': '平',
  '不': '陷',
  '陷': '极弱',
}

function evalPalaceBrightness(chart: ChartAccessor, cfg: { palaceName: string; brightness: string }): boolean {
  const palaceIdx = resolvePalaceIndex(chart, cfg.palaceName)
  if (palaceIdx === null) return false

  // 同时支持 iztro 原始亮度和系统转换后的亮度
  const expectedVariants = new Set([cfg.brightness, BRIGHTNESS_MAP[cfg.brightness]].filter(Boolean))

  // 庙旺 = 极旺 + 旺：JSON 中 "旺" 应匹配 isMiaoWang（极旺或旺）
  if (cfg.brightness === '旺' || cfg.brightness === '极旺') {
    expectedVariants.add('旺')
    expectedVariants.add('极旺')
  }
  // 落陷 = 陷 + 极弱 + 空：JSON 中 "陷" 应匹配 isLuoXian（陷、极弱、空）
  if (cfg.brightness === '陷' || cfg.brightness === '极弱' || cfg.brightness === '空') {
    expectedVariants.add('陷')
    expectedVariants.add('极弱')
    expectedVariants.add('空')
  }

  // 1. 先检查宫位整体亮度（第一颗主星的亮度）
  const actualPalaceBrightness = chart.getPalaceBrightness(palaceIdx)
  if (expectedVariants.has(actualPalaceBrightness)) return true

  // 2. 再检查是否有任意主星满足亮度条件（用于多主星宫位，如天同旺+天梁陷）
  const majorStars = chart.getStarsInPalace(palaceIdx)
  for (const ms of majorStars) {
    if (expectedVariants.has(ms.brightness)) return true
  }

  return false
}

// ═══════════════════════════════════════════════════════════════════
// palaceMajorEmpty: 空宫判定
// ═══════════════════════════════════════════════════════════════════

function evalPalaceMajorEmpty(chart: ChartAccessor, expected: boolean): boolean {
  const isEmpty = chart.getStarsInPalace(chart.anchorPalaceIndex).length === 0
  return isEmpty === expected
}

// ═══════════════════════════════════════════════════════════════════
// sameSourceSanJi: 三奇嘉会（同来源禄权科）
// ═══════════════════════════════════════════════════════════════════

function evalSameSourceSanJi(chart: ChartAccessor, cfg: { source: string[]; types: string[] }): boolean {
  const anchorIdx = chart.anchorPalaceIndex
  const sf = getSanFangSiZheng(chart, anchorIdx)

  const sources = cfg.source || ['ming', 'father', 'mother']
  const types = cfg.types || ['禄', '权', '科']

  const typeMap: Record<string, '化禄' | '化权' | '化科' | '化忌'> = {
    '禄': '化禄', '权': '化权', '科': '化科', '忌': '化忌',
  }

  for (const source of sources) {
    const allMet = types.every((t) => {
      const sihuaType = typeMap[t]
      if (!sihuaType) return false
      return sf.some((idx) => chart.hasSihuaInPalace(idx, sihuaType, source))
    })
    if (allMet) return true
  }

  return false
}

// ═══════════════════════════════════════════════════════════════════
// shengNianGan: 生年天干判定
// ═══════════════════════════════════════════════════════════════════

function evalShengNianGan(chart: ChartAccessor, expected: ConditionValue): boolean {
  return matchValue(chart.birthGan, expected)
}

// ═══════════════════════════════════════════════════════════════════
// palaceHasJiHua: 指定星在作用范围内有吉化（禄/权/科）
// ═══════════════════════════════════════════════════════════════════

const JI_HUA_TYPE_MAP: Record<string, '化禄' | '化权' | '化科'> = {
  '禄': '化禄',
  '权': '化权',
  '科': '化科',
}

function evalPalaceHasJiHua(
  chart: ChartAccessor,
  cfg: { palaceHasJiHua: string[]; scope?: string; type?: string },
): boolean {
  const stars = cfg.palaceHasJiHua
  if (!Array.isArray(stars) || stars.length === 0) return false

  const sihuaType = JI_HUA_TYPE_MAP[cfg.type ?? '禄']
  if (!sihuaType) return false

  let palaceIndices: number[]
  if (cfg.scope === 'lin') {
    const [left, right] = chart.getFlankingIndices(chart.anchorPalaceIndex)
    palaceIndices = [left, right]
  } else {
    palaceIndices = getSanFangSiZheng(chart, chart.anchorPalaceIndex)
  }

  return stars.every(star =>
    palaceIndices.some(idx =>
      chart.hasStarInPalace(idx, star) && chart.hasStarSihua(star, sihuaType),
    ),
  )
}

// ═══════════════════════════════════════════════════════════════════
// 新增算子：四化检测 + 吉煞引动
// ═══════════════════════════════════════════════════════════════════

/** 四化类型名称集合 */
type SihuaType = '化禄' | '化权' | '化科' | '化忌'
const SIHUA_TYPE_NAMES = new Set<string>(['化禄', '化权', '化科', '化忌'])

/**
 * sihuaInTriples: 三方四正内有指定四化类型
 *
 * 检查以 basePalace 为基准的三方四正宫位中，是否有任意星具有指定的四化类型。
 * types 之间为 OR 关系（任一命中即满足）。
 */
function evalSihuaInTriples(
  chart: ChartAccessor,
  cfg: { types: string[]; basePalace?: string; source?: string },
): boolean {
  const basePalace = cfg.basePalace || '锚定宫'
  const baseIdx = resolvePalaceIndex(chart, basePalace)
  if (baseIdx === null) return false

  const sf = getSanFangSiZheng(chart, baseIdx)
  const source = cfg.source

  return cfg.types.some((type) => {
    const t = type as SihuaType
    return sf.some((idx) =>
      source
        ? chart.hasSihuaInPalace(idx, t, source)
        : chart.hasSihuaInPalace(idx, t),
    )
  })
}

/**
 * sihuaInPalace: 指定宫位有指定四化类型（任意星）
 *
 * 检查指定宫位的星曜中是否有指定四化类型。
 */
function evalSihuaInPalace(
  chart: ChartAccessor,
  cfg: { types: string | string[]; palaceName?: string },
): boolean {
  const palaceName = cfg.palaceName || '锚定宫'
  const palaceIdx = resolvePalaceIndex(chart, palaceName)
  if (palaceIdx === null) return false

  const types = Array.isArray(cfg.types) ? cfg.types : [cfg.types]
  return types.some((type) => chart.hasSihuaInPalace(palaceIdx, type as SihuaType))
}

/**
 * starSihua: 指定星有指定四化
 *
 * 检查指定星（或星列表中任意一星）是否有指定四化类型（或类型列表中任一类型）。
 */
function evalStarSihua(
  chart: ChartAccessor,
  cfg: { star: string | string[]; type: string | string[] },
): boolean {
  const stars = Array.isArray(cfg.star) ? cfg.star : [cfg.star]
  const types = Array.isArray(cfg.type) ? cfg.type : [cfg.type]
  return stars.some((star) =>
    types.some((type) => chart.hasStarSihua(star, type as SihuaType)),
  )
}

/**
 * hasLuInTriples: 三方四正见禄（禄存或化禄）
 *
 * 检查三方四正内有禄存星或有化禄四化。
 */
function evalHasLuInTriples(
  chart: ChartAccessor,
  cfg: true | { basePalace?: string },
): boolean {
  const basePalace = cfg === true ? '锚定宫' : (cfg.basePalace || '锚定宫')
  const baseIdx = resolvePalaceIndex(chart, basePalace)
  if (baseIdx === null) return false

  const sf = getSanFangSiZheng(chart, baseIdx)
  return (
    sf.some((idx) => chart.hasStarInPalace(idx, '禄存')) ||
    sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
  )
}

/**
 * jiGeYinDong: 吉格引动条件
 *
 * 三方四正中吉星数量 >= 煞星数量。
 */
function evalJiGeYinDong(
  chart: ChartAccessor,
  cfg: true | { palaceName?: string },
): boolean {
  const palaceName = cfg === true ? '锚定宫' : (cfg.palaceName || '锚定宫')
  const palaceIdx = resolvePalaceIndex(chart, palaceName)
  if (palaceIdx === null) return false

  const sf = getSanFangSiZheng(chart, palaceIdx)
  const ji = chart.countAuspiciousInPalaces(sf)
  const sha = chart.countInauspiciousInPalaces(sf)
  return ji >= sha
}

/**
 * xiongGeYinDong: 凶格引动条件
 *
 * 三方四正中煞星数量 > 吉星数量。
 */
function evalXiongGeYinDong(
  chart: ChartAccessor,
  cfg: true | { palaceName?: string },
): boolean {
  const palaceName = cfg === true ? '锚定宫' : (cfg.palaceName || '锚定宫')
  const palaceIdx = resolvePalaceIndex(chart, palaceName)
  if (palaceIdx === null) return false

  const sf = getSanFangSiZheng(chart, palaceIdx)
  const ji = chart.countAuspiciousInPalaces(sf)
  const sha = chart.countInauspiciousInPalaces(sf)
  return sha > ji
}
