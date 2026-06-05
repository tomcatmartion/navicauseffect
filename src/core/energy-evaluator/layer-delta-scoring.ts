/**
 * 层增量评分引擎 — 在基础层得分上叠加层的独有贡献
 *
 * 核心原则：
 *   大限得分 = 原局得分 + 大限四化增量 + 大限格局增量
 *   流年得分 = 大限得分 + 流年四化增量 + 流年额外星曜增量 + 流年格局增量
 *
 * 不加大限禄存/羊陀/魁钺（后续扩展）
 * 大限不考虑遁干四化
 * 每层有自己的天花板截断和绝败判定
 * 格局倍率只作用于增量部分（A算法：增量独立乘）
 *
 * 所有接口为纯函数，无副作用，方便复用。
 */

import type {
  PalaceScore,
  PalaceScoreBrief,
  PalaceTone,
  PatternMatch,
} from '../types'
import { PALACE_NAMES } from '../types'
import type { ScoringContext } from './scoring-flow'
import {
  getOppositeIndex,
  getTrineIndices,
  classifyTone,
  step3_classifyWarmCool,
  getIntensityFactor,
  getLuCunDeltaByLabel,
} from './scoring-flow'
import type { LiuNianExtraStar } from '../limit-analyzer/liu-nian-extra-stars'
import { getScoringParams, getPatternDefinition, getPatternMultiplierByLevel } from '../knowledge-dict/loader'
import { OPPOSITE_DECAY, TRINE_DECAY } from '../knowledge-dict/query'

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

/** 增量计算输入 */
export interface LayerDeltaInput {
  /** 基础分（原局 for 大限, 大限 for 流年） */
  baseScore: number
  /** 原局地支位置索引 (0-11) */
  natalPalaceIndex: number
  /** 该层的 ScoringContext */
  layerCtx: ScoringContext
  /** 层标签（用于筛选四化来源） */
  layerLabel: '大限' | '流年'
  /** 天花板（取原局天花板） */
  ceiling: number
  /** 该宫的层格局列表（可选） */
  layerPatterns?: PatternMatch[]
  /** 流年额外星曜（仅流年层使用） */
  extraStars?: readonly LiuNianExtraStar[]
}

/** 增量计算结果 */
export interface LayerDeltaResult {
  /** 原始增量（天花板截断前） */
  rawDelta: number
  /** 加分增量 */
  bonusDelta: number
  /** 减分增量 */
  penaltyDelta: number
  /** 禄存增量 */
  luCunDelta: number
  /** 吉格倍率 */
  patternMultiplierG: number
  /** 凶格倍率 */
  patternMultiplierH: number
  /** 最终得分（含天花板截断 + 绝败） */
  finalScore: number
  /** 基调 */
  tone: PalaceTone
  /** 三档能级 */
  level: '吉旺' | '平' | '凶弱'
  /** 是否绝败 */
  isAbsoluteFail: boolean
  /** 加分明细 */
  bonusDetails: Record<string, number>
  /** 减分明细 */
  penaltyDetails: Record<string, number>
}

/** 批量增量配置 */
export interface LayerDeltaConfig {
  /** 层的 ScoringContext */
  layerCtx: ScoringContext | null
  /** 层标签 */
  layerLabel: '大限' | '流年'
  /** 12宫格局矩阵（palacePatterns[natalIdx] = 该宫格局列表） */
  palacePatterns?: PatternMatch[][]
  /** 流年额外星曜 */
  extraStars?: readonly LiuNianExtraStar[]
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/** 四舍五入到2位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 将原生基调映射为三档能级 */
function mapToneToLevel(tone: PalaceTone): PalaceScoreBrief['level'] {
  if (tone === '实旺' || tone === '实旺偏磨炼') return '吉旺'
  if (tone === '磨炼') return '平'
  return '凶弱'
}

/** 获取三方四正索引（本宫 + 对宫 + 两个三合宫） */
function getSanFangSiZhengIndices(idx: number): number[] {
  const [t1, t2] = getTrineIndices(idx)
  const opp = getOppositeIndex(idx)
  return [idx, opp, t1, t2]
}

/** 判断额外星曜是否为吉星 */
function isAuspiciousExtraStar(name: string): boolean {
  return name === '天魁' || name === '天钺'
}

/** 判断额外星曜是否为煞星 */
function isShaExtraStar(name: string): boolean {
  return name === '擎羊' || name === '陀罗'
}

/** 判断额外星曜是否为禄存 */
function isLuCunExtraStar(name: string): boolean {
  return name === '禄存'
}

// ═══════════════════════════════════════════════════════════
// 核心函数 1：单宫增量计算
// ═══════════════════════════════════════════════════════════

/**
 * 计算单个宫位的层增量
 *
 * 算法：
 *   1. 遍历该宫三方四正，找 sihuaSource === layerLabel 的四化星 → 加分增量
 *   2. 流年额外吉星（天魁/天钺）→ 加分增量
 *   3. 重新定性旺弱
 *   4. 层化忌 → 减分增量（含 intensityFactor）
 *   5. 流年额外煞星（擎羊/陀罗）→ 减分增量
 *   6. 流年禄存增量
 *   7. 格局倍率作用于增量
 *   8. 天花板截断 + 绝败判定
 */
export function computeSingleLayerDelta(input: LayerDeltaInput): LayerDeltaResult {
  const {
    baseScore,
    natalPalaceIndex,
    layerCtx,
    layerLabel,
    ceiling,
    layerPatterns,
    extraStars,
  } = input

  const params = getScoringParams()
  const sihuaPositions = getSanFangSiZhengIndices(natalPalaceIndex)
  const bonusDetails: Record<string, number> = {}
  const penaltyDetails: Record<string, number> = {}

  // ── ① 加分增量（化禄/化权/化科） ──────────────────
  let bonusDelta = 0

  for (const posIdx of sihuaPositions) {
    const palace = layerCtx.palaces[posIdx]
    if (!palace) continue

    // 计算空间衰减
    const decay = getPositionDecay(natalPalaceIndex, posIdx)

    for (const star of palace.stars) {
      if (star.sihuaSource !== layerLabel) continue

      switch (star.sihua) {
        case '化禄': {
          const val = round2(0.5 * decay)
          bonusDelta += val
          bonusDetails[`化禄_${star.name}_${posIdx}`] = val
          break
        }
        case '化权': {
          const val = round2(0.4 * decay)
          bonusDelta += val
          bonusDetails[`化权_${star.name}_${posIdx}`] = val
          break
        }
        case '化科': {
          const val = round2(0.3 * decay)
          bonusDelta += val
          bonusDetails[`化科_${star.name}_${posIdx}`] = val
          break
        }
        // 化忌在减分阶段处理
      }
    }
  }

  // ── ② 流年额外吉星（天魁/天钺） ──────────────────
  if (extraStars) {
    for (const extra of extraStars) {
      if (!isAuspiciousExtraStar(extra.starName)) continue
      if (!sihuaPositions.includes(extra.palaceIndex)) continue

      const decay = getPositionDecay(natalPalaceIndex, extra.palaceIndex)
      const val = round2(0.5 * decay)
      bonusDelta += val
      bonusDetails[`${extra.starName}_${extra.palaceIndex}`] = val
    }
  }

  bonusDelta = round2(bonusDelta)

  // ── ③ 重新定性旺弱 ──────────────────────────────
  const newWarmLabel = step3_classifyWarmCool(baseScore + bonusDelta)

  // ── ④ 减分增量（化忌） ──────────────────────────
  let penaltyDelta = 0
  const intensityFactor = getIntensityFactor(newWarmLabel)

  for (const posIdx of sihuaPositions) {
    const palace = layerCtx.palaces[posIdx]
    if (!palace) continue

    const decay = getPositionDecay(natalPalaceIndex, posIdx)

    for (const star of palace.stars) {
      if (star.sihuaSource !== layerLabel || star.sihua !== '化忌') continue

      const val = round2(-0.5 * decay * intensityFactor)
      penaltyDelta += val
      penaltyDetails[`化忌_${star.name}_${posIdx}`] = val
    }
  }

  // ── ⑤ 流年额外煞星（擎羊/陀罗） ──────────────────
  if (extraStars) {
    for (const extra of extraStars) {
      if (!isShaExtraStar(extra.starName)) continue
      if (!sihuaPositions.includes(extra.palaceIndex)) continue

      const decay = getPositionDecay(natalPalaceIndex, extra.palaceIndex)
      const val = round2(-0.5 * decay * intensityFactor)
      penaltyDelta += val
      penaltyDetails[`${extra.starName}_${extra.palaceIndex}`] = val
    }
  }

  penaltyDelta = round2(penaltyDelta)

  // ── ⑥ 流年禄存增量 ──────────────────────────────
  let luCunDelta = 0
  if (extraStars) {
    for (const extra of extraStars) {
      if (!isLuCunExtraStar(extra.starName)) continue
      // 禄存只在本宫才加分
      if (extra.palaceIndex !== natalPalaceIndex) continue

      luCunDelta = getLuCunDeltaByLabel(newWarmLabel)
      bonusDetails['禄存'] = luCunDelta
    }
  }

  // ── ⑦ 格局倍率 ──────────────────────────────────
  const G = computePatternMultiplierG(layerPatterns)
  const H = computePatternMultiplierH(layerPatterns)

  // ── ⑧ 合算 ──────────────────────────────────────
  // A算法：增量独立乘，然后加到基础分上
  const adjustedBonus = round2(bonusDelta * G)
  const adjustedPenalty = round2(penaltyDelta * H)
  const rawDelta = round2(adjustedBonus + adjustedPenalty + luCunDelta)

  let finalScore = round2(baseScore + rawDelta)

  // 天花板截断
  finalScore = round2(Math.min(finalScore, ceiling))

  // 绝败判定（简化：得分 < 1.5 且有凶格局触发）
  let isAbsoluteFail = false
  if (finalScore < 1.5 && H < 1.0) {
    isAbsoluteFail = true
    finalScore = 1.0
  }
  // 绝败 < 0 强制为 0
  if (finalScore < 0) finalScore = 0

  const tone = isAbsoluteFail ? '绝败' : classifyTone(finalScore)
  const level = mapToneToLevel(tone)

  return {
    rawDelta,
    bonusDelta: adjustedBonus,
    penaltyDelta: adjustedPenalty,
    luCunDelta,
    patternMultiplierG: G,
    patternMultiplierH: H,
    finalScore,
    tone,
    level,
    isAbsoluteFail,
    bonusDetails,
    penaltyDetails,
  }
}

// ═══════════════════════════════════════════════════════════
// 核心函数 2：12宫批量增量
// ═══════════════════════════════════════════════════════════

/**
 * 对 12 个地支宫位批量计算层增量
 *
 * @param baseScores 基础层评分（12宫）
 * @param config 层增量配置
 * @returns 12个增量结果
 */
export function computeAllLayerDeltas(
  baseScores: readonly PalaceScore[],
  config: LayerDeltaConfig,
): LayerDeltaResult[] {
  if (!config.layerCtx) {
    // 无层上下文时返回零增量
    return baseScores.map(base => ({
      rawDelta: 0,
      bonusDelta: 0,
      penaltyDelta: 0,
      luCunDelta: 0,
      patternMultiplierG: 1.0,
      patternMultiplierH: 1.0,
      finalScore: base.finalScore,
      tone: base.tone,
      level: mapToneToLevel(base.tone),
      isAbsoluteFail: base.isAbsoluteFail,
      bonusDetails: {},
      penaltyDetails: {},
    }))
  }

  return baseScores.map((base, i) =>
    computeSingleLayerDelta({
      baseScore: base.finalScore,
      natalPalaceIndex: i,
      layerCtx: config.layerCtx!,
      layerLabel: config.layerLabel,
      ceiling: base.ceiling,
      layerPatterns: config.palacePatterns?.[i],
      extraStars: config.extraStars,
    }),
  )
}

// ═══════════════════════════════════════════════════════════
// 核心函数 3：合并为基础 PalaceScore
// ═══════════════════════════════════════════════════════════

/**
 * 将基础 PalaceScore[] 与增量结果合并为新的 PalaceScore[]
 *
 * 保留原局基础信息（diZhi, majorStars, skeletonScore, subdueLevel）
 * 覆盖动态字段（finalScore, tone, bonusTotal 等）
 */
export function combineBaseWithDelta(
  baseScores: readonly PalaceScore[],
  deltas: readonly LayerDeltaResult[],
): PalaceScore[] {
  return baseScores.map((base, i) => {
    const delta = deltas[i]
    if (!delta || delta.rawDelta === 0) return { ...base }

    return {
      ...base,
      bonusTotal: round2(base.bonusTotal + delta.bonusDelta),
      penaltyTotal: round2(base.penaltyTotal + delta.penaltyDelta),
      luCunDelta: round2(base.luCunDelta + delta.luCunDelta),
      finalScore: delta.finalScore,
      tone: delta.tone,
      isAbsoluteFail: delta.isAbsoluteFail,
      scoreAfterBonus: round2(base.scoreAfterBonus + delta.bonusDelta),
      scoreAfterPenalty: round2(base.scoreAfterPenalty + delta.penaltyDelta),
      scoreAfterLuCun: round2(base.scoreAfterLuCun + delta.luCunDelta),
    } as PalaceScore
  })
}

// ═══════════════════════════════════════════════════════════
// 核心函数 4：直接生成 PalaceScoreBrief
// ═══════════════════════════════════════════════════════════

/**
 * 一步到位：基础分 + 增量 → PalaceScoreBrief[]
 *
 * 供 matter-limit-engine 和 limit-layer-scoring 直接使用
 */
export function buildDeltaLayerBriefs(
  baseScores: readonly PalaceScore[],
  config: LayerDeltaConfig,
): PalaceScoreBrief[] {
  const deltas = computeAllLayerDeltas(baseScores, config)

  return deltas.map((delta, i) => ({
    palaceIndex: i,
    palaceName: PALACE_NAMES[i] as PalaceScoreBrief['palaceName'],
    score: delta.finalScore,
    grade: delta.tone,
    level: delta.level,
  }))
}

// ═══════════════════════════════════════════════════════════
// 核心函数 5：完整流程 → PalaceScore[]
// ═══════════════════════════════════════════════════════════

/**
 * 完整流程：基础分 + 增量计算 + 合并 → PalaceScore[]
 *
 * 可直接传入 PalaceEnergyIndex 使用。
 * 供 fortune-engine.ts 和 layer-extractor.ts 调用。
 */
export function scoreLayerByDelta(
  baseScores: readonly PalaceScore[],
  config: LayerDeltaConfig,
): PalaceScore[] {
  const deltas = computeAllLayerDeltas(baseScores, config)
  return combineBaseWithDelta(baseScores, deltas)
}

// ═══════════════════════════════════════════════════════════
// 内部工具函数
// ═══════════════════════════════════════════════════════════

/** 获取位置衰减系数 */
function getPositionDecay(anchorIdx: number, targetIdx: number): number {
  if (targetIdx === anchorIdx) return 1.0
  if (targetIdx === getOppositeIndex(anchorIdx)) return OPPOSITE_DECAY
  const [t1, t2] = getTrineIndices(anchorIdx)
  if (targetIdx === t1 || targetIdx === t2) return TRINE_DECAY
  return 0
}

/** 计算吉格倍率 G（取最大） */
function computePatternMultiplierG(patterns?: PatternMatch[]): number {
  if (!patterns || patterns.length === 0) return 1.0
  const applicable = patterns.filter(p => {
    const def = getPatternDefinition(p.name)
    return def && def.stage === 'bonus'
  })
  if (applicable.length === 0) return 1.0
  return Math.max(...applicable.map(p => {
    const def = getPatternDefinition(p.name)
    return def?.multiplier ?? getPatternMultiplierByLevel(p.level) ?? 1.0
  }))
}

/** 计算凶格倍率 H（取最小） */
function computePatternMultiplierH(patterns?: PatternMatch[]): number {
  if (!patterns || patterns.length === 0) return 1.0
  const applicable = patterns.filter(p => {
    const def = getPatternDefinition(p.name)
    return def && def.stage === 'penalty'
  })
  if (applicable.length === 0) return 1.0
  return Math.min(...applicable.map(p => {
    const def = getPatternDefinition(p.name)
    return def?.multiplier ?? getPatternMultiplierByLevel(p.level) ?? 1.0
  }))
}
