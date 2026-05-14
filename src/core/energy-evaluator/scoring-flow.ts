/**
 * M2: 宫位评分 — 六步评分流程引擎
 *
 * 实现 SKILL_宫位原生能级评估 V1.0 的完整评分流程：
 * 步骤1: 骨架基础分
 * 步骤2: 加分阶段（7个子步骤）
 * 步骤3: 旺弱定性
 * 步骤4: 减分阶段（3个子步骤）
 * 步骤5: 禄存处理
 * 步骤6: 天花板截断 + 基调定论（含强制绝败检测）
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
  PALACE_NAMES,
} from '../types'
import { PALACE_NAMES as palaceNamesConst } from '../types'
import {
  isAuspicious,
  isInauspicious,
  getAuspiciousScore,
  getInauspiciousScore,
  getFlankingDecay,
  getLuCunDelta,
  OPPOSITE_DECAY,
  TRINE_DECAY,
  getSubdueLevel,
} from '../knowledge-dict/query'
import { getSkeletonBrightness } from './skeleton'
import { getDunGanSihua, getShengNianSihua } from '../sihua-calculator'
import type { SihuaMap } from '../types'
import { getScoringParams } from '../knowledge-dict/loader'

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
  /** 宫位旺弱等级 */
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

// ═══════════════════════════════════════════════════════════════════
// 评分参数（从 JSON 加载）
// ═══════════════════════════════════════════════════════════════════

/** 获取亮度配置（从 JSON 加载） */
function getBrightnessConfig(brightness: PalaceBrightness): { base: number; ceiling: number } {
  const params = getScoringParams()
  const config = params.brightnessMap[brightness]
  if (!config) {
    // 回退默认值
    return { base: 5.0, ceiling: 8.0 }
  }
  return config
}

/** 获取吉星加分 */
function getJiStarScore(): number {
  return getScoringParams().jiStarScore
}

/** 获取煞星减分 */
function getShaStarScore(): number {
  return getScoringParams().shaStarScore
}

/** 获取只记录不加分四化类型 */
function getRecordOnlySihua(): Array<'化权' | '化科'> {
  return getScoringParams().recordOnlySihua as Array<'化权' | '化科'>
}

/** 获取吉星名称集合 */
function getJiStarNames(): Set<string> {
  return new Set(getScoringParams().jiStarNames)
}

/** 获取煞星名称集合 */
function getShaStarNames(): Set<string> {
  return new Set(getScoringParams().shaStarNames)
}

/** 获取格局倍率 */
function getPatternMultiplier(level: string): number {
  return getScoringParams().patternMultiplierMap[level] ?? 1.0
}

/** 获取父母化忌减分 */
function getParentPenalty(type: 'fatherShengNianJi' | 'fatherDunGanJi' | 'motherShengNianJi' | 'motherDunGanJi'): number {
  return getScoringParams().parentPenalty[type]
}

/** 获取太岁宫宫干化禄加分 */
function getDunGanLuBonus(): number {
  return getScoringParams().dunGanLuBonus
}

/** 获取太岁宫宫干化禄衰减 */
function getDunGanLuDecay(): number {
  return getScoringParams().dunGanLuDecay
}

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

/** 获取夹宫索引（左右邻宫） */
export function getFlankingIndices(idx: number): [number, number] {
  return [(idx - 1 + 12) % 12, (idx + 1) % 12]
}

/** 获取三方四正所有宫位索引（本宫 + 对宫 + 两个三合宫） */
function getSanFangSiZhengIndices(idx: number): number[] {
  const [t1, t2] = getTrineIndices(idx)
  const opp = getOppositeIndex(idx)
  return [idx, opp, t1, t2]
}

// ═══════════════════════════════════════════════════════════════════
// 旺弱等级判断辅助
// ═══════════════════════════════════════════════════════════════════

/** 判断是否为旺宫 */
function isProsperous(brightness: PalaceBrightness): boolean {
  return brightness === '极旺' || brightness === '旺'
}

/** 判断是否为陷宫 */
function isDeficient(brightness: PalaceBrightness): boolean {
  return brightness === '陷' || brightness === '极弱' || brightness === '空'
}

// ═══════════════════════════════════════════════════════════════════
// 步骤1: 骨架基础分
// ═══════════════════════════════════════════════════════════════════

interface Step1Result {
  /** 基础分 */
  base: number
  /** 天花板 */
  ceiling: number
}

/** 根据旺弱等级获取基础分和天花板 */
function step1_skeletonBase(brightness: PalaceBrightness): Step1Result {
  const config = getBrightnessConfig(brightness)
  return { base: config.base, ceiling: config.ceiling }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤2: 加分阶段
// ═══════════════════════════════════════════════════════════════════

interface Step2Result {
  /** 加分总分 */
  bonusTotal: number
  /** 格局倍率 */
  patternMultiplier: number
  /** 化权/化科记录（只记不计分） */
  recordedSihua: Array<{ type: '化权' | '化科'; star: string; source: string }>
}

/**
 * 步骤2加分阶段
 *
 * ① 扫描本宫+对宫+三合宫+夹宫的吉星
 * ② 命主太岁宫宫干化禄（五虎遁宫干 → 天干四化）
 * ③-⑥ 父母化禄
 * ⑦ 吉格加分
 */
function step2_bonus(
  palaceIdx: number,
  ctx: ScoringContext,
): Step2Result {
  const palace = ctx.palaces[palaceIdx]
  let bonus = 0
  const recordedSihua: Array<{ type: '化权' | '化科'; star: string; source: string }> = []

  // ─── ① 扫描吉星（本宫+对宫+三合宫+夹宫） ───
  const oppositeIdx = getOppositeIndex(palaceIdx)
  const [trine1, trine2] = getTrineIndices(palaceIdx)
  const [flank1, flank2] = getFlankingIndices(palaceIdx)

  // 扫描各宫位的星曜
  const scanPositions: Array<{ idx: number; decay: number; label: string }> = [
    { idx: palaceIdx, decay: 1.0, label: '本宫' },
    { idx: oppositeIdx, decay: OPPOSITE_DECAY, label: '对宫' },
    { idx: trine1, decay: TRINE_DECAY, label: '三合宫1' },
    { idx: trine2, decay: TRINE_DECAY, label: '三合宫2' },
    // 夹宫的衰减系数是动态的，下面单独处理
  ]

  for (const pos of scanPositions) {
    const targetPalace = ctx.palaces[pos.idx]
    if (!targetPalace) continue

    for (const star of targetPalace.stars) {
      // 化禄星：+0.5 × 衰减
      if (star.sihua === '化禄') {
        bonus += getJiStarScore() * pos.decay
      }

      // 六吉星：+0.5 × 衰减
      if (getJiStarNames().has(star.name)) {
        bonus += getJiStarScore() * pos.decay
      }

      // 化权/化科：只记录
      if (star.sihua === '化权' || star.sihua === '化科') {
        recordedSihua.push({
          type: star.sihua,
          star: star.name,
          source: star.sihuaSource ?? '未知',
        })
      }
    }
  }

  // 夹宫：动态衰减系数
  for (const flankIdx of [flank1, flank2]) {
    const flankPalace = ctx.palaces[flankIdx]
    if (!flankPalace) continue

    // 动态衰减：根据本宫旺弱和夹宫旺弱查表
    const decay = getFlankingDecay(palace.brightness, flankPalace.brightness)

    for (const star of flankPalace.stars) {
      // 化禄星
      if (star.sihua === '化禄') {
        bonus += getJiStarScore() * decay
      }

      // 六吉星
      if (getJiStarNames().has(star.name)) {
        bonus += getJiStarScore() * decay
      }

      // 化权/化科：只记录
      if (star.sihua === '化权' || star.sihua === '化科') {
        recordedSihua.push({
          type: star.sihua,
          star: star.name,
          source: star.sihuaSource ?? '未知',
        })
      }
    }
  }

  // ─── ② 命主太岁宫宫干化禄（五虎遁） ───
  const dunGanSihua: SihuaMap = getDunGanSihua(ctx.birthGan, ctx.taiSuiZhi)
  const dunGanLuStar = dunGanSihua.禄

  // 检查太岁宫宫干化禄星是否落入本宫
  for (const star of palace.stars) {
    if (star.name === dunGanLuStar) {
      // 化禄落入本宫，+0.5 × 1.0（本宫层）
      bonus += 0.5 * 1.0
      break
    }
  }

  // 注意：步骤②太岁宫宫干化禄已在步骤①中通过四化标注统一处理（三方四正扫描包含化禄星）

  // ─── ③-⑥ 父母化禄加分 ───
  // ③ 父亲生年四化——化禄加分
  if (ctx.fatherGan) {
    const fatherShengNianSihua = getShengNianSihua(ctx.fatherGan)
    const fatherShengNianLu = fatherShengNianSihua.禄
    for (const star of palace.stars) {
      if (star.name === fatherShengNianLu) {
        bonus += 0.5 * 1.0  // 本宫层 × 1.0
        break
      }
    }
  }

  // ④ 父亲太岁宫宫干化禄加分
  if (ctx.fatherGan && ctx.fatherTaiSuiZhi) {
    const fatherDunGanSihua = getDunGanSihua(ctx.fatherGan, ctx.fatherTaiSuiZhi)
    const fatherLuStar = fatherDunGanSihua.禄
    for (const star of palace.stars) {
      if (star.name === fatherLuStar) {
        bonus += 0.5 * 1.0
        break
      }
    }
  }

  // ⑤ 母亲生年四化——化禄加分
  if (ctx.motherGan) {
    const motherShengNianSihua = getShengNianSihua(ctx.motherGan)
    const motherShengNianLu = motherShengNianSihua.禄
    for (const star of palace.stars) {
      if (star.name === motherShengNianLu) {
        bonus += 0.5 * 1.0
        break
      }
    }
  }

  // ⑥ 母亲太岁宫宫干化禄加分
  if (ctx.motherGan && ctx.motherTaiSuiZhi) {
    const motherDunGanSihua = getDunGanSihua(ctx.motherGan, ctx.motherTaiSuiZhi)
    const motherLuStar = motherDunGanSihua.禄
    for (const star of palace.stars) {
      if (star.name === motherLuStar) {
        bonus += 0.5 * 1.0
        break
      }
    }
  }

  // ─── ⑦ 吉格加分 ───
  // SKILL修正：吉格倍率（大吉×1.5、中吉×1.3）在加分阶段应用
  // 凶格倍率移至 step4(减分阶段) 应用
  let patternMultiplier = 1.0
  for (const pattern of ctx.patterns) {
    const mult = getPatternMultiplier(pattern.level) ?? 1.0
    // 只在加分阶段应用吉格倍率（大吉/中吉）
    // 小吉×1.0 只标注不加分
    if (pattern.level === '大吉' || pattern.level === '中吉') {
      patternMultiplier *= mult
    }
  }

  return {
    bonusTotal: Math.round(bonus * 100) / 100,
    patternMultiplier,
    recordedSihua,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤3: 旺弱定性（加分后）
// ═══════════════════════════════════════════════════════════════════

type WarmCoolLabel = '旺' | '旺偏磨炼' | '平' | '虚浮' | '陷'

/** 根据加分后的分数做旺弱定性 */
function step3_classifyWarmCool(score: number): WarmCoolLabel {
  if (score >= 7.5) return '旺'
  if (score >= 6.0) return '旺偏磨炼'
  if (score >= 4.5) return '平'
  if (score >= 3.0) return '虚浮'
  return '陷'
}

// ═══════════════════════════════════════════════════════════════════
// 步骤4: 减分阶段
// ═══════════════════════════════════════════════════════════════════

interface Step4Result {
  /** 减分总分 */
  penaltyTotal: number
}

/**
 * 步骤4减分阶段
 *
 * ⑧ 三方四正煞星减分
 * ⑨ 父母化忌减分
 * ⑩ 凶格减分
 */
function step4_penalty(
  palaceIdx: number,
  ctx: ScoringContext,
): Step4Result {
  const palace = ctx.palaces[palaceIdx]
  let penalty = 0

  // ─── ⑧ 三方四正煞星减分 ───
  // 扫描本宫+对宫+三合宫+夹宫
  const oppositeIdx = getOppositeIndex(palaceIdx)
  const [trine1, trine2] = getTrineIndices(palaceIdx)
  const [flank1, flank2] = getFlankingIndices(palaceIdx)

  // 本宫、对宫、三合宫
  const penaltyPositions: Array<{ idx: number; decay: number }> = [
    { idx: palaceIdx, decay: 1.0 },
    { idx: oppositeIdx, decay: OPPOSITE_DECAY },
    { idx: trine1, decay: TRINE_DECAY },
    { idx: trine2, decay: TRINE_DECAY },
  ]

  for (const pos of penaltyPositions) {
    const targetPalace = ctx.palaces[pos.idx]
    if (!targetPalace) continue

    for (const star of targetPalace.stars) {
      // 六煞星：-0.5 × 衰减
      if (getShaStarNames().has(star.name)) {
        penalty += getShaStarScore() * pos.decay
      }

      // 化忌：-0.5 × 衰减
      if (star.sihua === '化忌') {
        penalty += getShaStarScore() * pos.decay
      }
    }
  }

  // 夹宫煞星（动态衰减）
  for (const flankIdx of [flank1, flank2]) {
    const flankPalace = ctx.palaces[flankIdx]
    if (!flankPalace) continue

    const decay = getFlankingDecay(palace.brightness, flankPalace.brightness)

    for (const star of flankPalace.stars) {
      if (getShaStarNames().has(star.name)) {
        penalty += getShaStarScore() * decay
      }
      if (star.sihua === '化忌') {
        penalty += getShaStarScore() * decay
      }
    }
  }

  // ─── ⑨ 父母化忌减分 ───
  // 父亲生年四化化忌 + 父亲太岁宫宫干化忌（× 0.9 折算，各自独立）
  if (ctx.fatherGan) {
    // 父亲生年化忌
    const fatherShengNianSihua = getShengNianSihua(ctx.fatherGan)
    const fatherShengNianJi = fatherShengNianSihua.忌
    for (const star of palace.stars) {
      if (star.name === fatherShengNianJi) {
        penalty += getParentPenalty("fatherShengNianJi")
        break
      }
    }
    // 父亲太岁宫宫干化忌
    if (ctx.fatherTaiSuiZhi) {
      const fatherDunGanSihua = getDunGanSihua(ctx.fatherGan, ctx.fatherTaiSuiZhi)
      const fatherDunGanJi = fatherDunGanSihua.忌
      for (const star of palace.stars) {
        if (star.name === fatherDunGanJi) {
          penalty += getParentPenalty("fatherDunGanJi")
          break
        }
      }
    }
  }

  // 母亲生年四化化忌 + 母亲太岁宫宫干化忌
  if (ctx.motherGan) {
    // 母亲生年化忌
    const motherShengNianSihua = getShengNianSihua(ctx.motherGan)
    const motherShengNianJi = motherShengNianSihua.忌
    for (const star of palace.stars) {
      if (star.name === motherShengNianJi) {
        penalty += getParentPenalty("motherShengNianJi")
        break
      }
    }
    // 母亲太岁宫宫干化忌
    if (ctx.motherTaiSuiZhi) {
      const motherDunGanSihua = getDunGanSihua(ctx.motherGan, ctx.motherTaiSuiZhi)
      const motherDunGanJi = motherDunGanSihua.忌
      for (const star of palace.stars) {
        if (star.name === motherDunGanJi) {
          penalty += getParentPenalty("motherDunGanJi")
          break
        }
      }
    }
  }

  // ─── ⑩ 凶格减分 ───
  // SKILL修正：凶格倍率（中凶×0.7、大凶×0.5）在减分阶段应用
  // 小凶×1.0 只标注不扣分
  // 凶格倍率的含义：将总分乘以该倍率（类似吉格），在减分阶段体现为额外扣分
  // 额外扣分 = 当前分数 × (1 - 凶格倍率)
  let inauspiciousMultiplier = 1.0
  for (const pattern of ctx.patterns) {
    if (pattern.level === '中凶') {
      inauspiciousMultiplier *= 0.7
    } else if (pattern.level === '大凶') {
      inauspiciousMultiplier *= 0.5
    }
  }
  if (inauspiciousMultiplier < 1.0) {
    // 凶格额外减分：当前分数 × (1 - 倍率)
    // 这使得最终总分 ≈ 当前分数 × 倍率
    const extraPenalty = Math.round((1 - inauspiciousMultiplier) * 100) / 100
    penalty += extraPenalty
  }

  return {
    penaltyTotal: Math.round(penalty * 100) / 100,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 步骤5: 禄存处理
// ═══════════════════════════════════════════════════════════════════

/** 禄存加减分 */
function step5_luCun(palace: PalaceForScoring): number {
  if (!palace.hasLuCun) return 0
  return getLuCunDelta(palace.brightness)
}

// ═══════════════════════════════════════════════════════════════════
// 步骤6: 天花板截断 + 基调定论 + 强制绝败
// ═══════════════════════════════════════════════════════════════════

/** 基调定论 */
function classifyTone(score: number): PalaceTone {
  if (score >= 7.5) return '实旺'
  if (score >= 6.0) return '实旺偏磨炼'
  if (score >= 4.5) return '磨炼'
  if (score >= 3.0) return '虚浮'
  if (score >= 1.5) return '凶危'
  return '绝败'
}

/** 临界状态检测 */
function detectCriticalStatus(
  score: number,
  brightness: PalaceBrightness,
): CriticalStatus {
  // 旺宫临界：7.0~7.5 之间
  if (isProsperous(brightness) && score >= 7.0 && score < 7.5) {
    return '旺宫临界'
  }
  // 平宫临界：4.5~5.0 或 5.9~6.5
  if (brightness === '平' && ((score >= 4.5 && score < 5.0) || (score >= 5.9 && score <= 6.5))) {
    return '平宫临界'
  }
  // 陷地临界：3.0~3.5
  if (isDeficient(brightness) && score >= 3.0 && score < 3.5) {
    return '陷地临界'
  }
  return '无临界'
}

/**
 * 强制绝败检测
 *
 * 条件（任一触发即绝败）：
 * 1. 忌星4颗以上在本宫+三方四正
 * 2. 陷宫主星 + 火铃 + 化忌 三者在同一宫
 * 3. 化禄与化忌同宫且主星陷
 * 4. 陷宫主星 + 羊/陀之一 + 火/铃之一同宫
 *    例外：紫微/天府单星 + 三方四正吉>煞 → 非绝败但标记双煞逞凶预警
 * 5. 旺宫主星 + 羊/陀之一 + 火/铃之一同宫
 *    例外：紫微单星或天府单星+三方四正吉>煞 → 非绝败
 *    七杀/破军/贪狼单星无例外
 */
function detectAbsoluteFail(
  palaceIdx: number,
  ctx: ScoringContext,
  finalScore: number,
): { isAbsoluteFail: boolean; specialFlags: string[] } {
  const palace = ctx.palaces[palaceIdx]
  const specialFlags: string[] = []
  const sfIndices = getSanFangSiZhengIndices(palaceIdx)

  // 统计本宫+三方四正的化忌数量
  let jiCount = 0
  for (const idx of sfIndices) {
    const p = ctx.palaces[idx]
    if (!p) continue
    for (const star of p.stars) {
      if (star.sihua === '化忌') jiCount++
    }
  }

  // 条件1：忌星4颗以上
  if (jiCount >= 4) {
    return { isAbsoluteFail: true, specialFlags: [`三方四正化忌${jiCount}颗，触发强制绝败`] }
  }

  // 本宫星曜统计
  const benGongStars = palace.stars
  const hasHuoLing = benGongStars.some(s => s.name === '火星' || s.name === '铃星')
  const hasYangTuo = benGongStars.some(s => s.name === '擎羊' || s.name === '陀罗')
  const hasHuaJi = benGongStars.some(s => s.sihua === '化忌')
  const hasHuaLu = benGongStars.some(s => s.sihua === '化禄')
  const majorStarNames = palace.majorStars.map(ms => ms.star)

  // 判断本宫主星是否陷
  const hasDeficientMajor = palace.majorStars.some(ms => isDeficient(ms.brightness))
  // 判断本宫主星是否旺
  const hasProsperousMajor = palace.majorStars.some(ms => isProsperous(ms.brightness))

  // 统计三方四正吉/煞数（用于例外判断）
  let auspiciousCount = 0
  let inauspiciousCount = 0
  for (const idx of sfIndices) {
    const p = ctx.palaces[idx]
    if (!p) continue
    for (const star of p.stars) {
      if (getJiStarNames().has(star.name) || star.sihua === '化禄') auspiciousCount++
      if (getShaStarNames().has(star.name) || star.sihua === '化忌') inauspiciousCount++
    }
  }
  const jiGtSha = auspiciousCount > inauspiciousCount

  // 是否紫微/天府单星
  const isZiweiOnly = majorStarNames.length === 1 && majorStarNames[0] === '紫微'
  const isTianfuOnly = majorStarNames.length === 1 && majorStarNames[0] === '天府'
  const isZiweiOrTianfuOnly = isZiweiOnly || isTianfuOnly

  // 是否七杀/破军/贪狼单星（无例外）
  const isShaPoLangOnly = majorStarNames.length === 1
    && ['七杀', '破军', '贪狼'].includes(majorStarNames[0])

  // 条件2：陷宫主星 + 火铃 + 化忌 三者在同一宫
  if (hasDeficientMajor && hasHuoLing && hasHuaJi) {
    return { isAbsoluteFail: true, specialFlags: ['陷宫主星+火铃+化忌同宫，触发强制绝败'] }
  }

  // 条件3：化禄与化忌同宫且主星陷
  if (hasHuaLu && hasHuaJi && hasDeficientMajor) {
    return { isAbsoluteFail: true, specialFlags: ['化禄化忌同宫且主星陷，触发强制绝败'] }
  }

  // 条件4：陷宫主星 + 羊/陀之一 + 火/铃之一同宫
  if (hasDeficientMajor && hasYangTuo && hasHuoLing) {
    // 例外：紫微/天府单星 + 三方四正吉>煞 → 非绝败但标记双煞逞凶预警
    if (isZiweiOrTianfuOnly && jiGtSha) {
      specialFlags.push('双煞逞凶预警')
      return { isAbsoluteFail: false, specialFlags }
    }
    return { isAbsoluteFail: true, specialFlags: ['陷宫主星+羊陀+火铃同宫，触发强制绝败'] }
  }

  // 条件5：旺宫主星 + 羊/陀之一 + 火/铃之一同宫
  if (hasProsperousMajor && hasYangTuo && hasHuoLing) {
    // 七杀/破军/贪狼单星无例外
    if (isShaPoLangOnly) {
      return { isAbsoluteFail: true, specialFlags: ['旺宫杀破狼单星+双煞同宫，触发强制绝败'] }
    }
    // 例外：紫微单星或天府单星+三方四正吉>煞 → 非绝败
    if (isZiweiOrTianfuOnly && jiGtSha) {
      specialFlags.push('双煞逞凶预警')
      return { isAbsoluteFail: false, specialFlags }
    }
    return { isAbsoluteFail: true, specialFlags: ['旺宫主星+羊陀+火铃同宫，触发强制绝败'] }
  }

  return { isAbsoluteFail: false, specialFlags }
}

/**
 * 制煞能力等级
 *
 * 根据宫位主星及其旺弱判断制煞能力
 */
function computeSubdueLevel(palace: PalaceForScoring): '强制煞' | '中制煞' | '弱制煞' | '无' {
  if (palace.majorStars.length === 0) return '无'

  // 取制煞能力最强的主星
  let bestLevel: '强制煞' | '中制煞' | '弱制煞' | '无' = '无'
  for (const ms of palace.majorStars) {
    const level = getSubdueLevel(ms.star, ms.brightness)
    // 优先级：强制煞 > 中制煞 > 弱制煞 > 无
    if (level === '强制煞') return '强制煞'
    if (level === '中制煞' && (bestLevel === '弱制煞' || bestLevel === '无')) bestLevel = '中制煞'
    if (level === '弱制煞' && bestLevel === '无') bestLevel = '弱制煞'
  }
  return bestLevel
}

// ═══════════════════════════════════════════════════════════════════
// 主函数：评估单个宫位
// ═══════════════════════════════════════════════════════════════════

/**
 * 评估单个宫位的原生能级
 *
 * 执行完整的六步评分流程
 *
 * @param palaceIndex 宫位索引 (0-11)
 * @param ctx 评分上下文
 * @returns 宫位评分结果
 */
export function evaluateSinglePalace(
  palaceIndex: number,
  ctx: ScoringContext,
): PalaceScore {
  const palace = ctx.palaces[palaceIndex]
  const palaceName = palaceNamesConst[palaceIndex] as PalaceName

  // ─── 步骤1: 骨架基础分 ───
  // SKILL规则：空宫（无主星）基础分2.0、天花板5.3，不使用骨架映射表的旺弱
  // 有主星时才用骨架映射库的亮度等级
  const hasMajorStar = palace.majorStars.length > 0
  const skeletonBrightness = getSkeletonBrightness(ctx.skeletonId, palace.diZhi)
  const brightness: PalaceBrightness = hasMajorStar ? skeletonBrightness : '空'
  const { base: skeletonScore, ceiling } = step1_skeletonBase(brightness)

  // ─── 步骤2: 加分阶段 ───
  const { bonusTotal, patternMultiplier } = step2_bonus(palaceIndex, ctx)

  // 加分后应用格局倍率
  let scoreAfterBonus = (skeletonScore + bonusTotal) * patternMultiplier
  scoreAfterBonus = Math.round(scoreAfterBonus * 100) / 100

  // ─── 步骤3: 旺弱定性（加分后） ───
  // warmCoolLabel 仅做内部参考，不输出

  // ─── 步骤4: 减分阶段 ───
  const { penaltyTotal } = step4_penalty(palaceIndex, ctx)

  let scoreAfterPenalty = scoreAfterBonus + penaltyTotal
  scoreAfterPenalty = Math.round(scoreAfterPenalty * 100) / 100

  // ─── 步骤5: 禄存处理 ───
  const luCunDelta = step5_luCun(palace)
  let scoreAfterLuCun = scoreAfterPenalty + luCunDelta
  scoreAfterLuCun = Math.round(scoreAfterLuCun * 100) / 100

  // ─── 步骤6: 天花板截断 ───
  let finalScore = Math.min(scoreAfterLuCun, ceiling)
  finalScore = Math.round(finalScore * 100) / 100

  // ─── 强制绝败检测 ───
  const { isAbsoluteFail, specialFlags } = detectAbsoluteFail(palaceIndex, ctx, finalScore)
  if (isAbsoluteFail) {
    finalScore = 0.5
  }

  // ─── 基调定论 ───
  const tone = classifyTone(finalScore)

  // ─── 临界状态 ───
  const criticalStatus = detectCriticalStatus(finalScore, brightness)

  // ─── 筛选本宫相关的格局 ───
  const palacePatterns = ctx.patterns // 格局是全局的，全部附加

  // ─── 制煞能力 ───
  const subdueLevel = computeSubdueLevel(palace)

  return {
    palace: palaceName,
    diZhi: palace.diZhi,
    majorStars: palace.majorStars,
    skeletonScore,
    ceiling,
    bonusTotal,
    penaltyTotal,
    luCunDelta,
    finalScore,
    tone: isAbsoluteFail ? '绝败' : tone,
    subdueLevel,
    patterns: palacePatterns,
    patternMultiplier,
    criticalStatus,
    isAbsoluteFail,
    specialFlags,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 批量评估：十二宫全部评分
// ═══════════════════════════════════════════════════════════════════

/**
 * 评估所有十二宫的原生能级
 *
 * @param ctx 评分上下文
 * @returns 十二宫评分结果数组（顺序与输入一致）
 */
export function evaluateAllPalaces(ctx: ScoringContext): PalaceScore[] {
  const results: PalaceScore[] = []

  for (let i = 0; i < 12; i++) {
    results.push(evaluateSinglePalace(i, ctx))
  }

  return results
}
