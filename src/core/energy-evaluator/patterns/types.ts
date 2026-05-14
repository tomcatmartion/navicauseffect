/**
 * M2: 格局判定 — 类型定义
 *
 * 格局谓词函数（PatternPredicate）用于判断命盘是否匹配某个格局。
 * 每个格局包含：名称、级别、分类、评估函数。
 */

import type { DiZhi, MajorStar, PalaceBrightness } from '../../types'

/** 格局级别 */
export type PatternLevel = '大吉' | '中吉' | '小吉' | '小凶' | '中凶' | '大凶'

/**
 * 格局谓词 — 描述一个格局的完整判定逻辑
 */
export interface PatternPredicate {
  /** 格局名称 */
  name: string
  /** 格局级别 */
  level: PatternLevel
  /** 来源分类（如 紫微、日月、杀破狼 等） */
  category: string
  /**
   * 评估格局是否成立
   * @param chart 命盘数据只读访问器
   * @returns true 表示成格条件与引动条件均满足
   */
  evaluate: (chart: ChartAccessor) => boolean
}

/**
 * 命盘数据只读访问器 — 为格局判定提供统一的查询接口
 */
export interface ChartAccessor {
  /** 获取指定宫位（0-11）的所有主星 */
  getStarsInPalace(palaceIndex: number): { star: MajorStar; brightness: PalaceBrightness }[]
  /** 获取指定宫位的所有辅星 */
  getAuxStarsInPalace(palaceIndex: number): string[]
  /** 检查指定宫位是否包含某颗星 */
  hasStarInPalace(palaceIndex: number, star: string): boolean
  /** 检查指定宫位是否有某类四化 */
  hasSihuaInPalace(
    palaceIndex: number,
    type: '化禄' | '化权' | '化科' | '化忌',
    source?: string,
  ): boolean
  /** 获取宫位旺弱等级 */
  getPalaceBrightness(palaceIndex: number): PalaceBrightness
  /** 获取宫位地支 */
  getPalaceDiZhi(palaceIndex: number): DiZhi
  /** 获取对宫索引（相隔6位） */
  getOppositeIndex(palaceIndex: number): number
  /** 获取三合宫索引（各相隔4位的两个宫） */
  getTrineIndices(palaceIndex: number): [number, number]
  /** 获取夹宫索引（左右邻宫） */
  getFlankingIndices(palaceIndex: number): [number, number]
  /** 检查左右夹宫是否都有星（夹宫条件） */
  hasFlanking(palaceIndex: number): boolean
  /** 统计多个宫位中的吉星数量 */
  countAuspiciousInPalaces(palaceIndices: number[]): number
  /** 统计多个宫位中的煞星数量 */
  countInauspiciousInPalaces(palaceIndices: number[]): number
  /** 命宫索引 */
  mingGongIndex: number
  /** 身宫索引 */
  shenGongIndex: number
  /** 生年天干 */
  birthGan: string
  /** 生年地支 */
  birthZhi: string
  /** 检查某颗星是否有特定四化（任意来源） */
  hasStarSihua(star: string, type: '化禄' | '化权' | '化科' | '化忌'): boolean
  /** 统计多个宫位中来自指定来源的某类四化数量 */
  countSihuaInPalacesFromSource(
    palaceIndices: number[],
    type: string,
    source: string,
  ): number
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取某宫的三方四正所有宫位索引（本宫 + 对宫 + 两个三合宫）
 */
export function getSanFangSiZheng(chart: ChartAccessor, palaceIndex: number): number[] {
  const [trine1, trine2] = chart.getTrineIndices(palaceIndex)
  const opposite = chart.getOppositeIndex(palaceIndex)
  return [palaceIndex, opposite, trine1, trine2]
}

/**
 * 检查三方四正范围内是否有某颗星
 */
export function hasStarInSanFang(
  chart: ChartAccessor,
  palaceIndex: number,
  star: string,
): boolean {
  const indices = getSanFangSiZheng(chart, palaceIndex)
  return indices.some((idx) => chart.hasStarInPalace(idx, star))
}

/**
 * 检查三方四正范围内是否有某类四化
 */
export function hasSihuaInSanFang(
  chart: ChartAccessor,
  palaceIndex: number,
  type: '化禄' | '化权' | '化科' | '化忌',
): boolean {
  const indices = getSanFangSiZheng(chart, palaceIndex)
  return indices.some((idx) => chart.hasSihuaInPalace(idx, type))
}

/**
 * 检查三方四正中是否见左辅或右弼
 */
export function hasZuoYouInSanFang(chart: ChartAccessor, palaceIndex: number): boolean {
  return (
    hasStarInSanFang(chart, palaceIndex, '左辅') ||
    hasStarInSanFang(chart, palaceIndex, '右弼')
  )
}

/**
 * 检查三方四正中吉星数量是否 >= 煞星数量（加吉格引动条件）
 */
export function isJiGeYinDong(
  chart: ChartAccessor,
  palaceIndex: number,
): boolean {
  const indices = getSanFangSiZheng(chart, palaceIndex)
  const ji = chart.countAuspiciousInPalaces(indices)
  const sha = chart.countInauspiciousInPalaces(indices)
  return ji >= sha
}

/**
 * 检查三方四正中是否有禄（化禄或禄存）
 */
export function hasLuInSanFang(chart: ChartAccessor, palaceIndex: number): boolean {
  const indices = getSanFangSiZheng(chart, palaceIndex)
  return (
    hasSihuaInSanFang(chart, palaceIndex, '化禄') ||
    indices.some((idx) => chart.hasStarInPalace(idx, '禄存'))
  )
}

/**
 * 判断宫位旺弱是否为庙旺（极旺或旺）
 */
export function isMiaoWang(brightness: PalaceBrightness): boolean {
  return brightness === '极旺' || brightness === '旺'
}

/**
 * 判断宫位旺弱是否为落陷（陷、极弱、空）
 */
export function isLuoXian(brightness: PalaceBrightness): boolean {
  return brightness === '陷' || brightness === '极弱' || brightness === '空'
}

/**
 * 检查三方四正中来自同一来源的科权禄是否齐备
 *
 * 三奇嘉会格核心判定：化禄+化权+化科必须来自同一个四化来源
 * （命造/父亲/母亲），不同来源混搭不构成三奇嘉会。
 *
 * 实现原理：
 * - 遍历命造/父亲/母亲三个来源
 * - 对每个来源，检查其化禄、化权、化科是否分别出现在三方四正的任意宫位中
 * - 只要有一个来源的禄权科全部到齐，即满足条件
 */
export function checkSanQiFromSameSource(
  chart: ChartAccessor,
  palaceIndex: number,
): { met: boolean; source: string } {
  const sf = getSanFangSiZheng(chart, palaceIndex)

  /** 三奇嘉会要求检查的三个来源 */
  const SAN_QI_SOURCES = ['命造', '父亲', '母亲'] as const

  for (const source of SAN_QI_SOURCES) {
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄', source))
    const hasHuaQuan = sf.some((idx) => chart.hasSihuaInPalace(idx, '化权', source))
    const hasHuaKe = sf.some((idx) => chart.hasSihuaInPalace(idx, '化科', source))

    if (hasHuaLu && hasHuaQuan && hasHuaKe) {
      return { met: true, source }
    }
  }

  return { met: false, source: '' }
}
