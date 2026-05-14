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
import { getStarAttributes, getPalaceMeanings, getEventStarAttributes, getAstroRules } from './loader'
import attenuationCfg from './data/attenuation.json'

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

  // 平宫返回核心赋性
  return attr.coreTrait
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
// 事项分类赋性查询（从 event_star_attributes.json 加载）
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取事项分类下的星曜赋性描述
 *
 * @param event 事项类型（如 '求学'、'求爱'、'求财'）
 * @param palace 宫位名称（如 '事业宫'、'夫妻宫'、'财帛宫'）
 * @param star 主星名称
 * @param brightnessLevel 定性等级（'实旺' | '磨炼' | '平' | '虚浮' | '凶危'）
 * @returns 对应描述，找不到返回空字符串
 */
export function getEventStarTrait(
  event: string,
  palace: string,
  star: string,
  brightnessLevel: string,
): string {
  const data = getEventStarAttributes()
  return data[event]?.[palace]?.[star]?.[brightnessLevel] ?? ''
}

// ═══════════════════════════════════════════════════════════════════
// 星曜分类查询（从 astro_rules.json 加载）
// ═══════════════════════════════════════════════════════════════════

/** 六吉星列表 */
export function getAuspiciousStars(): AuspiciousStar[] {
  return getAstroRules().auspiciousStars as AuspiciousStar[]
}

/** 六煞星列表 */
export function getInauspiciousStars(): InauspiciousStar[] {
  return getAstroRules().inauspiciousStars as InauspiciousStar[]
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
  return getAstroRules().auspiciousScore
}

/**
 * 获取煞星分值（固定 -0.5）
 */
export function getInauspiciousScore(): number {
  return getAstroRules().inauspiciousScore
}

// ═══════════════════════════════════════════════════════════════════
// 制煞能力等级（从 astro_rules.json 加载）
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取主星的制煞能力等级
 */
export function getSubdueLevel(star: MajorStar, brightness: PalaceBrightness): '强制煞' | '中制煞' | '弱制煞' | '无' {
  const rules = getAstroRules()
  if (rules.subdueLevels.strong.includes(star)) return '强制煞'
  if (rules.subdueLevels.medium.includes(star) && (brightness === '旺' || brightness === '极旺')) return '中制煞'
  if (rules.subdueLevels.weak.includes(star)) return '弱制煞'
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
  '弱': { '旺': 0.3, '平': 0.1, '弱': 0 },
}

function loadFlankingDecayTable(): FlankingDecayTable {
  const rules = getAstroRules()
  const t = rules.flankingDecay
  if (!t) return DEFAULT_FLANKING
  const merged: FlankingDecayTable = { ...DEFAULT_FLANKING }
  for (const sk of ['旺', '平', '弱'] as const) {
    const row = t[sk]
    if (row && typeof row === 'object') {
      merged[sk] = { ...DEFAULT_FLANKING[sk], ...row }
    }
  }
  return merged
}

const FLANKING_DECAY_TABLE = loadFlankingDecayTable()

const fixedCfg = (attenuationCfg as { fixed?: { opposite?: number; trine?: number } }).fixed

/** 对宫衰减系数（来自 attenuation.json，可配置） */
export const OPPOSITE_DECAY = typeof fixedCfg?.opposite === 'number' ? fixedCfg.opposite : 0.8

/** 三合宫衰减系数（来自 attenuation.json，可配置） */
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
// 禄存加减分（从 astro_rules.json 加载）
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取禄存加减分值
 */
export function getLuCunDelta(brightness: PalaceBrightness): number {
  const rules = getAstroRules()
  if (brightness === '极旺' || brightness === '旺') return rules.luCunDelta['旺'] ?? 0.3
  if (brightness === '平') return rules.luCunDelta['平'] ?? 0
  return rules.luCunDelta['陷'] ?? -0.3 // 陷、极弱、空
}
