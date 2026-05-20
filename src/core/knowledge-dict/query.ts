/**
 * M6: 知识字典 — 精确查询函数
 *
 * 所有查询使用精确 key-value，禁止向量检索。
 * LLM 不直接调用本模块，由编排层查好后注入 IR。
 *
 * 数据来源：data/ 目录下的 JSON 文件（支持热加载）
 */

import type { MajorStar, PalaceName, PalaceBrightness, AuspiciousStar, InauspiciousStar } from '../types'
import type { StarAttribute, PalaceMeaning } from './types'
import { getStarAttributes, getPalaceMeanings, getEventStarAttributes, getScoringParams } from './loader'

// ═══════════════════════════════════════════════════════════════════
// 星曜赋性查询
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取主星赋性
 *
 * @param star 主星名称
 * @returns 赋性数据，找不到返回 null
 */
export function getStarAttr(star: MajorStar): StarAttribute | null {
  const data = getStarAttributes()
  return data[star] ?? null
}

/**
 * 获取主星在特定旺弱下的特质描述
 *
 * @param star 主星
 * @param brightness 宫位旺弱
 * @returns 对应的正面或负面特质描述
 */
export function getStarTraitByBrightness(
  star: MajorStar,
  brightness: PalaceBrightness,
): string {
  const attr = getStarAttr(star)
  if (!attr) return ''

  if (brightness === '极旺' || brightness === '旺') {
    return attr.positiveTrait
  }

  if (brightness === '陷' || brightness === '极弱') {
    return attr.negativeTrait
  }

  return ''
}

/**
 * 获取主星在特定旺弱下的能力标签
 */
export function getStarAbilityTags(star: MajorStar, brightness: PalaceBrightness): string[] {
  const attr = getStarAttr(star)
  if (!attr) return []

  if (brightness === '极旺' || brightness === '旺') {
    return []
  }

  if (brightness === '陷' || brightness === '极弱') {
    return []
  }

  return []
}

// ═══════════════════════════════════════════════════════════════════
// 宫位含义查询
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取宫位含义
 */
export function getPalaceMeaning(palace: PalaceName): PalaceMeaning | null {
  const data = getPalaceMeanings()
  return data[palace] ?? null
}

// ═══════════════════════════════════════════════════════════════════
// 星曜分类查询（从 scoring.json 加载）
// ═══════════════════════════════════════════════════════════════════

/** 六吉星列表 */
export function getAuspiciousStars(): AuspiciousStar[] {
  return getScoringParams().jiStarNames as AuspiciousStar[]
}

/** 六煞星列表 */
export function getInauspiciousStars(): InauspiciousStar[] {
  return getScoringParams().shaStarNames as InauspiciousStar[]
}

/**
 * 判断是否为吉星
 */
export function isAuspicious(star: string): boolean {
  return getAuspiciousStars().includes(star as AuspiciousStar)
}

/**
 * 判断是否为煞星
 */
export function isInauspicious(star: string): boolean {
  return getInauspiciousStars().includes(star as InauspiciousStar)
}

/**
 * 获取吉星分值（固定 +0.5）
 */
export function getAuspiciousScore(): number {
  return getScoringParams().jiStarScore
}

/**
 * 获取煞星分值（固定 -0.5）
 */
export function getInauspiciousScore(): number {
  return getScoringParams().shaStarScore
}

// ═══════════════════════════════════════════════════════════════════
// 制煞能力等级（从 scoring.json 加载）
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取主星的制煞能力等级
 */
export function getSubdueLevel(star: MajorStar, brightness: PalaceBrightness): '强制煞' | '中制煞' | '弱制煞' | '无' {
  const params = getScoringParams()
  if (params.subdueLevel.strong.includes(star)) return '强制煞'
  if (params.subdueLevel.medium.includes(star) && (brightness === '旺' || brightness === '极旺')) return '中制煞'
  if (params.subdueLevel.weak.includes(star)) return '弱制煞'
  return '无'
}

// ═══════════════════════════════════════════════════════════════════
// 空间衰减系数
// ═══════════════════════════════════════════════════════════════════

type FlankLevel = '旺' | '平' | '弱'
type FlankingDecayTable = Record<FlankLevel, Record<FlankLevel, number>>

const DEFAULT_FLANKING: FlankingDecayTable = {
  '旺': { '旺': 0.9, '平': 0.5, '弱': 0.2 },
  '平': { '旺': 0.6, '平': 0.4, '弱': 0.2 },
  '弱': { '旺': 0.3, '平': 0.1, '弱': 0.05 },
}

function loadFlankingDecayTable(): FlankingDecayTable {
  const params = getScoringParams()
  const t = params.jiagongDecayMatrix
  if (!t) return DEFAULT_FLANKING

  const keyMap: Record<string, FlankLevel> = {
    '本宫旺': '旺',
    '本宫平': '平',
    '本宫弱': '弱',
    '夹宫旺': '旺',
    '夹宫平': '平',
    '夹宫弱': '弱',
  }

  const merged: FlankingDecayTable = { ...DEFAULT_FLANKING }
  for (const [selfKey, row] of Object.entries(t)) {
    const selfLevel = keyMap[selfKey]
    if (!selfLevel || typeof row !== 'object') continue
    for (const [flankKey, val] of Object.entries(row)) {
      const flankLevel = keyMap[flankKey]
      if (flankLevel && typeof val === 'number') {
        merged[selfLevel][flankLevel] = val
      }
    }
  }
  return merged
}

const FLANKING_DECAY_TABLE = loadFlankingDecayTable()

const fixedCfg = getScoringParams().fixedDecay

/** 对宫衰减系数（来自 scoring.json，可配置） */
export const OPPOSITE_DECAY = typeof fixedCfg?.opposite === 'number' ? fixedCfg.opposite : 0.8

/** 三合宫衰减系数（来自 scoring.json，可配置） */
export const TRINE_DECAY = typeof fixedCfg?.trine === 'number' ? fixedCfg.trine : 0.7

/**
 * 获取夹宫动态衰减系数
 *
 * @param selfBrightness 本宫旺弱
 * @param flankBrightness 夹宫旺弱
 */
export function getFlankingDecay(
  selfBrightness: PalaceBrightness,
  flankBrightness: PalaceBrightness,
): number {
  type BrightnessLevel = '旺' | '平' | '弱'
  const toLevel = (b: PalaceBrightness): BrightnessLevel => {
    if (b === '极旺' || b === '旺') return '旺'
    if (b === '平') return '平'
    return '弱' // 陷、极弱、空
  }

  const selfLevel = toLevel(selfBrightness)
  const flankLevel = toLevel(flankBrightness)

  return FLANKING_DECAY_TABLE[selfLevel][flankLevel]
}

// ═══════════════════════════════════════════════════════════════════
// 禄存加减分（从 scoring_params.json 加载）
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取禄存加减分值
 */
export function getLuCunDelta(brightness: PalaceBrightness): number {
  const params = getScoringParams()
  if (brightness === '极旺' || brightness === '旺') return params.luCunDelta['旺'] ?? 0.3
  if (brightness === '平') return params.luCunDelta['平'] ?? 0
  return params.luCunDelta['陷'] ?? -0.3 // 陷、极弱、空
}
