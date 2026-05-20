/**
 * M2: 宫位评分 — 六步评分流程引擎
 *
 * 基于 scoring.json formula 部分实现：
 * 步骤0: 空宫借对宫
 * 步骤1: 初始基础分（含空宫处理）
 * 步骤2: 加分阶段（8个子步骤，含空间衰减）
 * 步骤3: 重新定性宫位旺弱
 * 步骤4: 减分阶段（7个子步骤，含 intensity_factor + 化忌细分）
 * 步骤5: 禄存调整（按 new_brightness）
 * 步骤6: 天花板截断 + 强制绝败
 *
 * 原则：取宫位旺弱计算宫位能级得分时必须以 JSON 配置文件为主。
 * 取命主排盘的原局、大限、流年、小限等，宫位、地支、各种四化等，都按 iztro 为准。
 */

import type {
  DiZhi,
  TianGan,
  PalaceBrightness,
  MajorStar,
  PalaceScore,
  PalaceTone,
  CriticalStatus,
  PatternMatch,
  PalaceName,
} from '../types'
import { PALACE_NAMES as palaceNamesConst } from '../types'
import {
  getFlankingDecay,
  OPPOSITE_DECAY,
  TRINE_DECAY,
  getSubdueLevel,
} from '../knowledge-dict/query'
import { getSkeletonBrightness } from './skeleton'
import { getDunGanSihua, getShengNianSihua } from '../sihua-calculator'
import type { SihuaMap } from '../types'
import { getScoringParams, getPatternConfig } from '../knowledge-dict/loader'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/** 宫内星曜（评分用） */
export interface StarInPalaceForScoring {
  /** 星曜名称 */
  name: string
  /** 四化类型（如有） */
  sihua?: '化禄' | '化权' | '化科' | '化忌'
  /** 四化来源 */
  sihuaSource?: string
}

/** 单个宫位（评分用） */
export interface PalaceForScoring {
  /** 宫位索引 0-11 */
  palaceIndex: number
  /** 宫位地支 */
  diZhi: DiZhi
  /** 宫位旺弱等级（原始骨架亮度） */
  brightness: PalaceBrightness
  /** 主星列表 */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness }>
  /** 宫内所有星曜（含辅星、四化标注） */
  stars: StarInPalaceForScoring[]
  /** 是否有禄存 */
  hasLuCun: boolean
}

/** 评分上下文 */
export interface ScoringContext {
  /** 骨架序号 P01-P12 */
  skeletonId: string
  /** 十二宫数据 */
  palaces: PalaceForScoring[]
  /** 命主生年天干 */
  birthGan: TianGan
  /** 太岁宫地支 */
  taiSuiZhi: DiZhi
  /** 身宫索引（0-11，默认 6 = 命宫对宫） */
  shenGongIndex?: number
  /** 父亲生年天干（可选） */
  fatherGan?: TianGan
  /** 父亲太岁宫地支（可选） */
  fatherTaiSuiZhi?: DiZhi
  /** 母亲生年天干（可选） */
  motherGan?: TianGan
  /** 母亲太岁宫地支（可选） */
  motherTaiSuiZhi?: DiZhi
  /** 格局匹配结果 */
  patterns: PatternMatch[]
}

/** 步骤2子步骤详情 */
export interface BonusDetails {
  '2.1_三方四正吉星': number
  '2.2_命主生年化禄': number
  '2.3_命主遁干化禄': number
  '2.4_父亲生年化禄': number
  '2.5_父亲遁干化禄': number
  '2.6_母亲生年化禄': number
  '2.7_母亲遁干化禄': number
  '2.8_吉格倍率': number
}

/** 步骤4子步骤详情（v2.3：化忌拆分为6个独立项） */
export interface PenaltyDetails {
  '4.1_三方四正煞星': number
  '4.2_命主生年化忌': number
  '4.3_命主遁干化忌': number
  '4.4_父亲生年化忌': number
  '4.5_父亲遁干化忌': number
  '4.6_母亲生年化忌': number
  '4.7_母亲遁干化忌': number
  '4.8_凶格倍率': number
}

/** 评分中间状态 */
interface ScoringState {
  score: number
  ceiling: number
  brightness: PalaceBrightness
  newBrightness: WarmCoolLabel
}

type WarmCoolLabel = '旺' | '旺偏磨炼' | '平' | '虚浮' | '凶危'

// ═══════════════════════════════════════════════════════════════════
// 辅助函数：宫位索引关系
// ═══════════════════════════════════════════════════════════════════

/** 获取对宫索引 */
export function getOppositeIndex(idx: number): number {
  return (idx + 6) % 12
}

/** 获取三合宫索引（两个） */
export function getTrineIndices(idx: number): [number, number] {
  return [(idx + 4) % 12, (idx + 8) % 12]
}

/**
 * 获取夹宫索引（左右邻宫）
 *
 * 方向约定（scoring.json params.directionConvention）：
 * - 左 = counterClockwise（逆时针方向为左）= 索引 +1
 * - 右 = clockwise（顺时针方向为右）= 索引 -1
 *
 * 例如：本宫为丑(1)，则 left = 寅(2)（逆时针前一宫），right = 子(0)（顺时针前一宫）
 */
export function getFlankingIndices(idx: number): [number, number] {
  // left = idx + 1, right = idx - 1
  return [(idx + 1) % 12, (idx - 1 + 12) % 12]
}

/** 获取三方四正所有宫位索引（本宫 + 对宫 + 两个三合宫） */
function getSanFangSiZhengIndices(idx: number): number[] {
  const [t1, t2] = getTrineIndices(idx)
  const opp = getOppositeIndex(idx)
  return [idx, opp, t1, t2]
}

// ═══════════════════════════════════════════════════════════════════
// 夹宫成对判定
// ═══════════════════════════════════════════════════════════════════

/** 夹宫成对结果 */
interface FlankingPair {
  /** 成对名称（如"昌曲夹"） */
  pairName: string
  /** 左侧星曜名称 */
  leftStar: string
  /** 右侧星曜名称 */
  rightStar: string
  /** 动态衰减系数 */
  decay: number
}

/**
 * 获取所有成对的夹宫组合（符合 jiagongValidPairs）
 *
 * 根据 scoring.json params 规定：
 * - 成对星曜必须分居左右两侧一宫，缺一不可
 * - 仅一侧出现 → 不构成夹
 * - 非成对组合的两颗星分处两侧 → 不构成夹
 * - 多对可以同时成立（如左右夹+昌曲夹同时存在）
 *
 * @param palaceIdx 本宫索引
 * @param ctx 评分上下文
 * @param pairType 夹宫类型过滤：'吉夹' | '煞夹' | undefined（不过滤）
 * @returns 所有成对的夹宫组合
 */
function getAllFlankingPairs(
  palaceIdx: number,
  ctx: ScoringContext,
  pairType?: '吉夹' | '煞夹',
): FlankingPair[] {
  const [flankLeftIdx, flankRightIdx] = getFlankingIndices(palaceIdx)
  const leftPalace = ctx.palaces[flankLeftIdx]
  const rightPalace = ctx.palaces[flankRightIdx]

  if (!leftPalace || !rightPalace) {
    return []
  }

  const leftStars = new Set(leftPalace.stars.map(s => s.name))
  const rightStars = new Set(rightPalace.stars.map(s => s.name))

  const params = getScoringParams()
  const pairs = params.jiagongValidPairs?.pairs ?? []
  const result: FlankingPair[] = []

  for (const pair of pairs) {
    // 如果指定了类型，过滤匹配
    if (pairType && pair.type !== pairType) {
      continue
    }

    let forward = false
    let reverse = false

    if (pair.left === '化禄' && pair.right === '化禄') {
      // 双禄夹：检查左右夹宫是否各有一个化禄（sihua属性）
      const leftHasLu = leftPalace.stars.some(s => s.sihua === '化禄')
      const rightHasLu = rightPalace.stars.some(s => s.sihua === '化禄')
      forward = leftHasLu && rightHasLu
    } else if (pair.left === '化忌' && pair.right === '化忌') {
      // 双忌夹：检查左右夹宫是否各有一个化忌（sihua属性）
      const leftHasJi = leftPalace.stars.some(s => s.sihua === '化忌')
      const rightHasJi = rightPalace.stars.some(s => s.sihua === '化忌')
      forward = leftHasJi && rightHasJi
    } else {
      // 普通星曜夹：正向检查：leftStar在左夹宫，rightStar在右夹宫
      forward = leftStars.has(pair.left) && rightStars.has(pair.right)
      // 反向检查：rightStar在左夹宫，leftStar在右夹宫（互换也算夹）
      reverse = leftStars.has(pair.right) && rightStars.has(pair.left)
    }

    if (forward || reverse) {
      const selfBrightness = ctx.palaces[palaceIdx].brightness
      const leftBrightness = leftPalace.brightness
      const rightBrightness = rightPalace.brightness
      // 取左右夹宫中较弱的亮度计算衰减（保守策略）
      const flankBrightness = getWeakerBrightness(leftBrightness, rightBrightness)
      const decay = getFlankingDecay(selfBrightness, flankBrightness)
      result.push({
        pairName: pair.name,
        leftStar: forward ? pair.left : pair.right,
        rightStar: forward ? pair.right : pair.left,
        decay,
      })
    }
  }

  return result
}

/** 取两个亮度中较弱的一个 */
export function getWeakerBrightness(a: PalaceBrightness, b: PalaceBrightness): PalaceBrightness {
  const order: PalaceBrightness[] = ['极旺', '旺', '平', '陷', '极弱', '空']
  const idxA = order.indexOf(a)
  const idxB = order.indexOf(b)
  return idxA >= idxB ? a : b
}

// ═══════════════════════════════════════════════════════════════════
// 评分参数加载
// ═══════════════════════════════════════════════════════════════════

/** 四舍五入到2位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function getBrightnessConfig(brightness: PalaceBrightness): { base: number; ceiling: number } {
  const params = getScoringParams()
  const config = params.brightnessMap[brightness]
  if (!config) return { base: 5.0, ceiling: 8.0 }
  return config
}

function getIntensityFactor(brightness: WarmCoolLabel): number {
  const map: Record<WarmCoolLabel, number> = {
    '旺': 0.3,
    '旺偏磨炼': 0.5,
    '平': 0.7,
    '虚浮': 1.0,
    '凶危': 1.5,
  }
  return map[brightness] ?? 0.7
}

function getLuCunDeltaByLabel(label: WarmCoolLabel): number {
  // 从 scoring.json params 加载 luCunDelta
  const params = getScoringParams()
  let delta: number
  if (label === '旺') delta = params?.luCunDelta?.['旺'] ?? 0.3
  else if (label === '平' || label === '旺偏磨炼') delta = params?.luCunDelta?.['平'] ?? 0
  else delta = params?.luCunDelta?.['陷'] ?? -0.3
  return round2(delta)
}

// ═══════════════════════════════════════════════════════════════════
// 步骤0: 空宫借对宫 + 步骤1: 初始基础分
// ═══════════════════════════════════════════════════════════════════

function step0_and_1(palaceIdx: number, ctx: ScoringContext): { S0: number; ceiling: number; effectiveBrightness: PalaceBrightness; isEmpty: boolean } {
  const palace = ctx.palaces[palaceIdx]
  const hasMajorStar = palace.majorStars.length > 0

  if (hasMajorStar) {
    // 非空宫：直接取骨架亮度（以 JSON 配置文件为主）
    const brightness = getSkeletonBrightness(ctx.skeletonId, palace.diZhi)
    const config = getBrightnessConfig(brightness)
    return { S0: round2(config.base), ceiling: round2(config.ceiling), effectiveBrightness: brightness, isEmpty: false }
  }

  // 空宫：递归借对宫（最多3层）
  let currentIdx = palaceIdx
  let depth = 0
  let borrowFactor = 1.0

  while (depth < 3) {
    const oppositeIdx = getOppositeIndex(currentIdx)
    const oppositePalace = ctx.palaces[oppositeIdx]

    if (!oppositePalace) break

    if (oppositePalace.majorStars.length > 0) {
      // 对宫有主星，借入
      const brightness = getSkeletonBrightness(ctx.skeletonId, oppositePalace.diZhi)
      const config = getBrightnessConfig(brightness)
      borrowFactor *= 0.5
      return {
        S0: round2(config.base * borrowFactor),
        ceiling: round2(config.ceiling * borrowFactor),
        effectiveBrightness: brightness,
        isEmpty: true,
      }
    }

    // 对宫也是空宫，继续递归
    currentIdx = oppositeIdx
    borrowFactor *= 0.5
    depth++
  }

  // 递归3层后仍为空，使用陷宫默认值
  return { S0: 3.0, ceiling: 7.3, effectiveBrightness: '陷', isEmpty: true }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤2: 加分阶段
// ═══════════════════════════════════════════════════════════════════

function step2_bonus(palaceIdx: number, ctx: ScoringContext, state: ScoringState): { score: number; details: BonusDetails; G: number } {
  const palace = ctx.palaces[palaceIdx]
  const details: BonusDetails = {
    '2.1_三方四正吉星': 0,
    '2.2_命主生年化禄': 0,
    '2.3_命主遁干化禄': 0,
    '2.4_父亲生年化禄': 0,
    '2.5_父亲遁干化禄': 0,
    '2.6_母亲生年化禄': 0,
    '2.7_母亲遁干化禄': 0,
    '2.8_吉格倍率': 1.0,
  }

  // 空间位置定义
  const oppositeIdx = getOppositeIndex(palaceIdx)
  const [trine1, trine2] = getTrineIndices(palaceIdx)
  const [flankLeft, flankRight] = getFlankingIndices(palaceIdx)

  const positions = [
    { idx: palaceIdx, decay: 1.0, type: '本宫' as const },
    { idx: oppositeIdx, decay: OPPOSITE_DECAY, type: '对宫' as const },
    { idx: trine1, decay: TRINE_DECAY, type: '三合1' as const },
    { idx: trine2, decay: TRINE_DECAY, type: '三合2' as const },
    { idx: flankLeft, decay: 0, type: '夹宫左' as const }, // decay 动态计算
    { idx: flankRight, decay: 0, type: '夹宫右' as const },
  ]

  // 2.1 三方四正吉星（不含化禄）
  // 夹宫处理：只有成对出现的吉星才按夹宫动态衰减计分，每对只计一次
  const auspiciousStars = new Set(getScoringParams().jiStarNames)
  const jiFlankingPairs = getAllFlankingPairs(palaceIdx, ctx, '吉夹')

  // 先处理本宫、对宫、三合宫中的吉星（固定衰减）
  for (const pos of positions) {
    if (pos.type.startsWith('夹宫')) continue
    const targetPalace = ctx.palaces[pos.idx]
    if (!targetPalace) continue

    for (const star of targetPalace.stars) {
      if (auspiciousStars.has(star.name)) {
        details['2.1_三方四正吉星'] = round2(details['2.1_三方四正吉星'] + 0.5 * pos.decay)
      }
    }
  }

  // 再处理夹宫中的吉星：只有成对组合才计分，每对只计一次
  for (const pair of jiFlankingPairs) {
    details['2.1_三方四正吉星'] = round2(details['2.1_三方四正吉星'] + 0.5 * pair.decay)
  }

  // 2.2-2.7 各种化禄（均参与空间衰减）
  // 化禄不是成对概念，在夹宫中使用固定衰减系数 0.5
  const parentDiscount = getScoringParams().parentSihuaDiscount ?? 0.9
  const sihuaSources: Array<{ key: keyof BonusDetails; sihua: SihuaMap | null; discount: number }> = [
    { key: '2.2_命主生年化禄', sihua: getShengNianSihua(ctx.birthGan), discount: 1.0 },
    { key: '2.3_命主遁干化禄', sihua: getDunGanSihua(ctx.birthGan, ctx.taiSuiZhi), discount: 1.0 },
    { key: '2.4_父亲生年化禄', sihua: ctx.fatherGan ? getShengNianSihua(ctx.fatherGan) : null, discount: parentDiscount },
    { key: '2.5_父亲遁干化禄', sihua: ctx.fatherGan && ctx.fatherTaiSuiZhi ? getDunGanSihua(ctx.fatherGan, ctx.fatherTaiSuiZhi) : null, discount: parentDiscount },
    { key: '2.6_母亲生年化禄', sihua: ctx.motherGan ? getShengNianSihua(ctx.motherGan) : null, discount: parentDiscount },
    { key: '2.7_母亲遁干化禄', sihua: ctx.motherGan && ctx.motherTaiSuiZhi ? getDunGanSihua(ctx.motherGan, ctx.motherTaiSuiZhi) : null, discount: parentDiscount },
  ]

  for (const source of sihuaSources) {
    if (!source.sihua) continue
    const luStar = source.sihua.禄

    for (const pos of positions) {
      // 夹宫中的化禄不计分
      if (pos.type.startsWith('夹宫')) continue

      const targetPalace = ctx.palaces[pos.idx]
      if (!targetPalace) continue

      const decay = pos.decay

      for (const star of targetPalace.stars) {
        if (star.name === luStar) {
          details[source.key] = round2(details[source.key] + 0.5 * decay * source.discount)
        }
      }
    }
  }

  // 2.8 吉格倍率
  const patternConfig = getPatternConfig() as Record<string, { stage: string; scope: string; multiplier: number; category?: string }>
  const applicablePatterns = ctx.patterns.filter(p => {
    const config = patternConfig[p.name]
    if (!config) return false
    return config.stage === 'bonus' && isCorePalace(p, palaceIdx, ctx)
  })

  const G = applicablePatterns.length > 0
    ? Math.max(...applicablePatterns.map(p => {
        const config = patternConfig[p.name]
        return config?.multiplier ?? 1.0
      }))
    : 1.0

  details['2.8_吉格倍率'] = G

  // 计算加分后的分数
  const sumBonus = round2(Object.entries(details)
    .filter(([k]) => k !== '2.8_吉格倍率')
    .reduce((sum, [, v]) => sum + v, 0))

  const score = round2((state.score + sumBonus) * G)

  return { score, details, G }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤3: 重新定性宫位旺弱
// ═══════════════════════════════════════════════════════════════════

function step3_classifyWarmCool(score: number): WarmCoolLabel {
  if (score >= 7.5) return '旺'
  if (score >= 6.0) return '旺偏磨炼'
  if (score >= 4.5) return '平'
  if (score >= 3.0) return '虚浮'
  return '凶危'
}

// ═══════════════════════════════════════════════════════════════════
// 步骤4: 减分阶段（v2.3：化忌拆分为6个独立子步骤）
// ═══════════════════════════════════════════════════════════════════

function step4_penalty(palaceIdx: number, ctx: ScoringContext, state: ScoringState): { score: number; details: PenaltyDetails; H: number } {
  const palace = ctx.palaces[palaceIdx]
  const details: PenaltyDetails = {
    '4.1_三方四正煞星': 0,
    '4.2_命主生年化忌': 0,
    '4.3_命主遁干化忌': 0,
    '4.4_父亲生年化忌': 0,
    '4.5_父亲遁干化忌': 0,
    '4.6_母亲生年化忌': 0,
    '4.7_母亲遁干化忌': 0,
    '4.8_凶格倍率': 1.0,
  }

  const intensityFactor = getIntensityFactor(state.newBrightness)

  // 空间位置定义
  const oppositeIdx = getOppositeIndex(palaceIdx)
  const [trine1, trine2] = getTrineIndices(palaceIdx)
  const [flankLeft, flankRight] = getFlankingIndices(palaceIdx)

  const positions = [
    { idx: palaceIdx, decay: 1.0, type: '本宫' as const },
    { idx: oppositeIdx, decay: OPPOSITE_DECAY, type: '对宫' as const },
    { idx: trine1, decay: TRINE_DECAY, type: '三合1' as const },
    { idx: trine2, decay: TRINE_DECAY, type: '三合2' as const },
    { idx: flankLeft, decay: 0, type: '夹宫左' as const },
    { idx: flankRight, decay: 0, type: '夹宫右' as const },
  ]

  // 4.1 三方四正煞星（擎羊、陀罗、火星、铃星、地空、地劫）
  // 使用全称：擎羊、陀罗、火星、铃星、地空、地劫（pattern_library.json 已修复缩写）
  // 夹宫处理：只有成对出现的煞星才按夹宫动态衰减计分，每对只计一次
  const shaStars = new Set(getScoringParams().shaStarNames)
  const shaFlankingPairs = getAllFlankingPairs(palaceIdx, ctx, '煞夹')

  // 先处理本宫、对宫、三合宫中的煞星（固定衰减）
  for (const pos of positions) {
    if (pos.type.startsWith('夹宫')) continue
    const targetPalace = ctx.palaces[pos.idx]
    if (!targetPalace) continue

    for (const star of targetPalace.stars) {
      if (shaStars.has(star.name)) {
        details['4.1_三方四正煞星'] = round2(details['4.1_三方四正煞星'] + -0.5 * pos.decay * intensityFactor)
      }
    }
  }

  // 再处理夹宫中的煞星：只有成对组合才计分，每对只计一次
  for (const pair of shaFlankingPairs) {
    details['4.1_三方四正煞星'] = round2(details['4.1_三方四正煞星'] + -0.5 * pair.decay * intensityFactor)
  }

  // 4.2-4.3 命主化忌（生年 + 遁干）
  // 化忌不是成对概念，在夹宫中使用固定衰减系数 0.5
  const selfJiSources: Array<{ key: keyof PenaltyDetails; sihua: SihuaMap | null; discount: number }> = [
    { key: '4.2_命主生年化忌', sihua: getShengNianSihua(ctx.birthGan), discount: 1.0 },
    { key: '4.3_命主遁干化忌', sihua: getDunGanSihua(ctx.birthGan, ctx.taiSuiZhi), discount: 1.0 },
  ]

  for (const source of selfJiSources) {
    if (!source.sihua) continue
    const jiStar = source.sihua.忌

    for (const pos of positions) {
      // 夹宫中的化忌不计分
      if (pos.type.startsWith('夹宫')) continue

      const targetPalace = ctx.palaces[pos.idx]
      if (!targetPalace) continue

      const decay = pos.decay

      for (const star of targetPalace.stars) {
        if (star.name === jiStar) {
          details[source.key] = round2(details[source.key] + -0.5 * decay * source.discount)
        }
      }
    }
  }

  // 4.4-4.7 父母化忌（父亲生年/遁干 + 母亲生年/遁干）
  const parentDiscount = getScoringParams().parentSihuaDiscount ?? 0.9
  const parentJiSources: Array<{ key: keyof PenaltyDetails; sihua: SihuaMap | null; discount: number }> = [
    { key: '4.4_父亲生年化忌', sihua: ctx.fatherGan ? getShengNianSihua(ctx.fatherGan) : null, discount: parentDiscount },
    { key: '4.5_父亲遁干化忌', sihua: ctx.fatherGan && ctx.fatherTaiSuiZhi ? getDunGanSihua(ctx.fatherGan, ctx.fatherTaiSuiZhi) : null, discount: parentDiscount },
    { key: '4.6_母亲生年化忌', sihua: ctx.motherGan ? getShengNianSihua(ctx.motherGan) : null, discount: parentDiscount },
    { key: '4.7_母亲遁干化忌', sihua: ctx.motherGan && ctx.motherTaiSuiZhi ? getDunGanSihua(ctx.motherGan, ctx.motherTaiSuiZhi) : null, discount: parentDiscount },
  ]

  for (const source of parentJiSources) {
    if (!source.sihua) continue
    const jiStar = source.sihua.忌

    for (const pos of positions) {
      // 夹宫中的化忌不计分
      if (pos.type.startsWith('夹宫')) continue

      const targetPalace = ctx.palaces[pos.idx]
      if (!targetPalace) continue

      const decay = pos.decay

      for (const star of targetPalace.stars) {
        if (star.name === jiStar) {
          details[source.key] = round2(details[source.key] + -0.5 * decay * source.discount)
        }
      }
    }
  }

  // 4.8 凶格倍率
  const patternConfig = getPatternConfig() as Record<string, { stage: string; scope: string; multiplier: number }>
  const applicablePatterns = ctx.patterns.filter(p => {
    const config = patternConfig[p.name]
    if (!config) return false
    return config.stage === 'penalty' && isCorePalace(p, palaceIdx, ctx)
  })

  const H = applicablePatterns.length > 0
    ? Math.min(...applicablePatterns.map(p => {
        const config = patternConfig[p.name]
        return config?.multiplier ?? 1.0
      }))
    : 1.0

  details['4.8_凶格倍率'] = H

  // 计算减分后的分数
  const sumPenalty = round2(Object.entries(details)
    .filter(([k]) => k !== '4.8_凶格倍率')
    .reduce((sum, [, v]) => sum + v, 0))
  const score = round2((state.score + sumPenalty) * H)

  return { score, details, H }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤5: 禄存调整
// ═══════════════════════════════════════════════════════════════════

function step5_luCun(palace: PalaceForScoring, newBrightness: WarmCoolLabel, currentScore: number): number {
  if (!palace.hasLuCun) return currentScore
  const delta = getLuCunDeltaByLabel(newBrightness)
  return round2(currentScore + delta)
}

// ═══════════════════════════════════════════════════════════════════
// 步骤6: 天花板截断 + 强制绝败
// ═══════════════════════════════════════════════════════════════════

function step6_ceiling_and_absoluteFail(
  palaceIdx: number,
  ctx: ScoringContext,
  score: number,
  ceiling: number,
): { finalScore: number; isAbsoluteFail: boolean; specialFlags: string[] } {
  let finalScore = Math.min(score, ceiling)
  finalScore = round2(finalScore)

  const { isAbsoluteFail, specialFlags } = detectAbsoluteFail(palaceIdx, ctx)

  if (isAbsoluteFail) {
    finalScore = 1.0
  }

  return { finalScore, isAbsoluteFail, specialFlags }
}

/** 基调定论 */
function classifyTone(score: number): PalaceTone {
  if (score >= 7.5) return '实旺'
  if (score >= 6.0) return '实旺偏磨炼'
  if (score >= 4.5) return '磨炼'
  if (score >= 3.0) return '虚浮'
  if (score >= 1.5) return '凶危'
  return '绝败'
}

/** 强制绝败检测 */
function detectAbsoluteFail(palaceIdx: number, ctx: ScoringContext): { isAbsoluteFail: boolean; specialFlags: string[] } {
  const palace = ctx.palaces[palaceIdx]
  const specialFlags: string[] = []
  const sfIndices = getSanFangSiZhengIndices(palaceIdx)

  // 条件1：忌星4颗以上
  let jiCount = 0
  for (const idx of sfIndices) {
    const p = ctx.palaces[idx]
    if (!p) continue
    for (const star of p.stars) {
      if (star.sihua === '化忌') jiCount++
    }
  }
  if (jiCount >= 4) {
    return { isAbsoluteFail: true, specialFlags: [`三方四正化忌${jiCount}颗`] }
  }

  // 本宫统计
  const hasHuoLing = palace.stars.some(s => s.name === '火星' || s.name === '铃星')
  const hasYangTuo = palace.stars.some(s => s.name === '擎羊' || s.name === '陀罗')
  const hasHuaJi = palace.stars.some(s => s.sihua === '化忌')
  const hasHuaLu = palace.stars.some(s => s.sihua === '化禄')
  const majorStarNames = palace.majorStars.map(ms => ms.star)

  const hasDeficientMajor = palace.majorStars.some(ms => ms.brightness === '陷' || ms.brightness === '极弱')
  const hasProsperousMajor = palace.majorStars.some(ms => ms.brightness === '旺' || ms.brightness === '极旺')

  // 条件2：陷宫主星 + 火铃 + 化忌
  if (hasDeficientMajor && hasHuoLing && hasHuaJi) {
    return { isAbsoluteFail: true, specialFlags: ['陷宫主星+火铃+化忌'] }
  }

  // 条件3：化禄与化忌同宫且主星陷
  if (hasHuaLu && hasHuaJi && hasDeficientMajor) {
    return { isAbsoluteFail: true, specialFlags: ['禄忌同宫主星陷'] }
  }

  // 条件4：陷宫主星 + 羊/陀 + 火/铃
  if (hasDeficientMajor && hasYangTuo && hasHuoLing) {
    const isZiweiOrTianfuOnly = majorStarNames.length === 1 && ['紫微', '天府'].includes(majorStarNames[0])
    if (isZiweiOrTianfuOnly) {
      specialFlags.push('双煞逞凶预警')
      return { isAbsoluteFail: false, specialFlags }
    }
    return { isAbsoluteFail: true, specialFlags: ['陷宫主星+羊陀+火铃'] }
  }

  // 条件5：旺宫主星 + 羊/陀 + 火/铃
  if (hasProsperousMajor && hasYangTuo && hasHuoLing) {
    const isShaPoLangOnly = majorStarNames.length === 1 && ['七杀', '破军', '贪狼'].includes(majorStarNames[0])
    if (isShaPoLangOnly) {
      return { isAbsoluteFail: true, specialFlags: ['旺宫杀破狼+双煞'] }
    }
    const isZiweiOrTianfuOnly = majorStarNames.length === 1 && ['紫微', '天府'].includes(majorStarNames[0])
    if (isZiweiOrTianfuOnly) {
      specialFlags.push('双煞逞凶预警')
      return { isAbsoluteFail: false, specialFlags }
    }
    return { isAbsoluteFail: true, specialFlags: ['旺宫主星+羊陀+火铃'] }
  }

  return { isAbsoluteFail: false, specialFlags }
}

// ═══════════════════════════════════════════════════════════════════
// 辅助：判断宫位是否为格局的核心宫位
// ═══════════════════════════════════════════════════════════════════

function isCorePalace(pattern: PatternMatch, palaceIdx: number, ctx: ScoringContext): boolean {
  // 简化实现：格局的核心宫位包括构成星曜所在宫位 + 引动条件所在宫位
  // 实际应由格局判定模块提供核心宫位列表
  // 这里使用 pattern 中可能包含的 palaceIndices 字段
  if ('palaceIndices' in pattern && Array.isArray((pattern as Record<string, unknown>).palaceIndices)) {
    return ((pattern as Record<string, unknown>).palaceIndices as number[]).includes(palaceIdx)
  }
  // 默认：如果格局触发，应用到所有宫位（保守策略）
  return true
}

// ═══════════════════════════════════════════════════════════════════
// 制煞能力
// ═══════════════════════════════════════════════════════════════════

function computeSubdueLevel(palace: PalaceForScoring): '强制煞' | '中制煞' | '弱制煞' | '无' {
  if (palace.majorStars.length === 0) return '无'

  for (const ms of palace.majorStars) {
    const level = getSubdueLevel(ms.star, ms.brightness)
    if (level === '强制煞') return '强制煞'
  }

  for (const ms of palace.majorStars) {
    const level = getSubdueLevel(ms.star, ms.brightness)
    if (level === '中制煞') return '中制煞'
  }

  for (const ms of palace.majorStars) {
    const level = getSubdueLevel(ms.star, ms.brightness)
    if (level === '弱制煞') return '弱制煞'
  }

  return '无'
}

// ═══════════════════════════════════════════════════════════════════
// 主函数：评估单个宫位
// ═══════════════════════════════════════════════════════════════════

export function evaluateSinglePalace(palaceIndex: number, ctx: ScoringContext): PalaceScore {
  const palace = ctx.palaces[palaceIndex]
  const palaceName = palaceNamesConst[palaceIndex] as PalaceName

  // 步骤0+1: 空宫借对宫 + 初始基础分
  const { S0, ceiling, effectiveBrightness, isEmpty } = step0_and_1(palaceIndex, ctx)

  const state: ScoringState = {
    score: S0,
    ceiling,
    brightness: effectiveBrightness,
    newBrightness: '平',
  }

  // 步骤2: 加分阶段
  const { score: scoreStep2, details: bonusDetails, G } = step2_bonus(palaceIndex, ctx, state)
  state.score = scoreStep2

  // 步骤3: 重新定性
  state.newBrightness = step3_classifyWarmCool(scoreStep2)

  // 步骤4: 减分阶段
  const { score: scoreStep4, details: penaltyDetails, H } = step4_penalty(palaceIndex, ctx, state)
  state.score = scoreStep4

  // 步骤5: 禄存调整
  const scoreStep5 = step5_luCun(palace, state.newBrightness, scoreStep4)
  state.score = scoreStep5

  // 步骤6: 天花板截断 + 强制绝败
  const { finalScore, isAbsoluteFail, specialFlags } = step6_ceiling_and_absoluteFail(palaceIndex, ctx, scoreStep5, ceiling)

  // 基调定论
  const tone = classifyTone(finalScore)

  // 临界状态
  const criticalStatus = detectCriticalStatus(finalScore, effectiveBrightness)

  // 制煞能力
  const subdueLevel = computeSubdueLevel(palace)

  return {
    palace: palaceName,
    diZhi: palace.diZhi,
    majorStars: palace.majorStars,
    skeletonScore: S0,
    ceiling,
    bonusTotal: round2(scoreStep2 - S0),
    penaltyTotal: round2(scoreStep4 - scoreStep2),
    luCunDelta: round2(scoreStep5 - scoreStep4),
    finalScore,
    tone: isAbsoluteFail ? '绝败' : tone,
    subdueLevel,
    patterns: ctx.patterns,
    patternMultiplier: G,
    criticalStatus,
    isAbsoluteFail,
    specialFlags,
    scoreAfterBonus: scoreStep2,
    scoreAfterPenalty: scoreStep4,
    scoreAfterLuCun: scoreStep5,
    warmCoolLabel: state.newBrightness,
    bonusDetails,
    penaltyDetails,
  } as PalaceScore
}

/** 临界状态检测 */
function detectCriticalStatus(score: number, brightness: PalaceBrightness): CriticalStatus {
  if ((brightness === '旺' || brightness === '极旺') && score >= 7.0 && score < 7.5) {
    return '旺宫临界'
  }
  if (brightness === '平' && ((score >= 4.5 && score < 5.0) || (score >= 5.9 && score <= 6.5))) {
    return '平宫临界'
  }
  if ((brightness === '陷' || brightness === '极弱' || brightness === '空') && score >= 3.0 && score < 3.5) {
    return '陷地临界'
  }
  return '无临界'
}

// ═══════════════════════════════════════════════════════════════════
// 批量评估
// ═══════════════════════════════════════════════════════════════════

export function evaluateAllPalaces(ctx: ScoringContext): PalaceScore[] {
  const results: PalaceScore[] = []
  for (let i = 0; i < 12; i++) {
    results.push(evaluateSinglePalace(i, ctx))
  }
  return results
}
