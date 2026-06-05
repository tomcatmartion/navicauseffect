/**
 * 层次提取器 — 提取原局/大限/流年完整12宫数据
 *
 * 核心职责：从 Stage3Output + Stage1Output + chartData 中提取
 * 每层12宫的完整 palaceBase 数据（天干、地支、星曜、四化、格局、
 * 三方四正、两夹宫）。
 *
 * 数据来源（全部复用现有接口，不重复计算）：
 *   - 原局：stage1.palaceScores + threeLayerTable.natal + stage1.scoringCtx
 *   - 大限：currentDaXian.scores + threeLayerTable.decadal + daXianScoringCtx
 *   - 流年：buildYearlyScoringContext（已有函数）+ threeLayerTable.yearly
 */

import type {
  PalaceScore, PalaceName, DaXianPalaceMapping,
  ThreeLayerPalaceTable, Stage1Output, Stage3Output,
  SihuaEntry, SihuaType, MajorStar,
} from '../types'
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '../types'
import type { ScoringContext, PalaceForScoring } from '../energy-evaluator/scoring-flow'
import { getOppositeIndex, getTrineIndices } from '../energy-evaluator/scoring-flow'
import { getAllFlankingPairs } from '../energy-evaluator/jiagong-matcher'
import { buildDaXianScoringContext, buildYearlyScoringContext } from '../limit-analyzer/limit-scoring-context'
import { formatPalaceBase, buildMinorStarsString, resolveOriginalPalaceName, getPalaceIndexByName } from './palace-base-formatter'
import { formatThreeQuadrants } from './three-quadrants-formatter'
import type {
  PalaceBaseSpec, ThreeQuadrantsSpec, PalaceLevel,
  SihuaItemSpec,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/** 单宫完整数据（palaceBase + 额外结构信息） */
export interface FullPalaceData {
  base: PalaceBaseSpec
  /** 三方四正（仅命宫和事项宫位需要） */
  threeQuadrants?: ThreeQuadrantsSpec
  /** 格局列表 */
  patterns: Array<{ name: string; level: string; multiplier: number }>
  /** 成立的夹宫 */
  flankingPairs: Array<{ pairName: string; displayName: string; pairType: string }>
}

/** 单层完整12宫数据 */
export interface LayerFullData {
  /** 12宫完整数据 */
  palaces: FullPalaceData[]
  /** 该层命宫索引（在 PALACE_NAMES 体系下始终为0，但映射到原局的实际索引不同） */
  mingOriginalIndex: number
  /** 该层的 ScoringContext（用于三方四正和夹宫计算） */
  scoringCtx: ScoringContext | null
}

// ═══════════════════════════════════════════════════════════════════
// 原局12宫提取
// ═══════════════════════════════════════════════════════════════════

/**
 * 提取原局12宫完整数据
 *
 * 数据来源：
 *   - stage1.palaceScores → score/tone/patterns/flankingPairs
 *   - stage1.scoringCtx → 完整星曜数据（含辅星）
 *   - threeLayerTable.natal → diZhi/tianGan/sihua
 */
export function extractNatalLayer(
  stage1: Stage1Output,
  threeLayerTable: ThreeLayerPalaceTable,
): LayerFullData {
  const ctx = stage1.scoringCtx
  const palaceScores = stage1.palaceScores
  const natalEntries = threeLayerTable.natal.palaces

  // 原局命宫索引始终为0（PALACE_NAMES[0] = '命宫'）
  const mingOriginalIndex = 0

  const palaces: FullPalaceData[] = natalEntries.map((entry, i) => {
    const score = palaceScores[i]
    if (!score) return createEmptyPalaceData(entry.name)

    // 辅星字符串从 ScoringContext 获取完整星曜列表
    const majorStarNames = new Set(score.majorStars.map(s => s.star))
    const palaceForScoring = ctx.palaces[i]
    const minorStarsStr = palaceForScoring
      ? buildMinorStarsString(palaceForScoring.stars, majorStarNames)
      : ''

    const base: PalaceBaseSpec = {
      palaceName: score.palace,
      earthlyBranch: score.diZhi,
      heavenlyStem: palaceForScoring?.tianGan ?? entry.tianGan ?? '甲',
      majorStars: score.majorStars.map(s => s.star).join('+'),
      minorStars: minorStarsStr,
      sihua: formatSihuaFromEntries(entry.sihua),
      score: normalizeScore(score.finalScore),
      level: scoreToLevel(score.finalScore),
      originalPalace: null, // 原局无映射
      daXianPalace: null,
    }

    return {
      base,
      patterns: score.patterns.map(p => ({
        name: p.name,
        level: p.level,
        multiplier: p.multiplier,
      })),
      flankingPairs: score.flankingPairs.map(fp => ({
        pairName: fp.pairName,
        displayName: fp.displayName,
        pairType: fp.pairType,
      })),
    }
  })

  return { palaces, mingOriginalIndex, scoringCtx: ctx }
}

// ═══════════════════════════════════════════════════════════════════
// 大限12宫提取
// ═══════════════════════════════════════════════════════════════════

/**
 * 提取大限12宫完整数据
 *
 * 数据来源：
 *   - currentDaXian.scores → 大限独立评分（PalaceScore[]）
 *   - currentDaXian.palacePatterns → 大限格局矩阵
 *   - threeLayerTable.decadal → diZhi/tianGan/sihua
 *   - buildDaXianScoringContext → 完整星曜数据（复用已有函数）
 *   - natalCtx → 原始宫位数据（大限星曜基于原局偏移）
 */
export function extractDaXianLayer(
  currentDaXian: DaXianPalaceMapping,
  threeLayerTable: ThreeLayerPalaceTable,
  natalCtx: ScoringContext,
): LayerFullData {
  const daXianScores = currentDaXian.scores
  const daXianEntries = threeLayerTable.decadal.palaces
  const mingOriginalIndex = currentDaXian.palaceIndex

  // 复用已有函数构建大限评分上下文（含完整星曜）
  const daXianCtx = buildDaXianScoringContext(currentDaXian, natalCtx)

  const palaces: FullPalaceData[] = daXianEntries.map((entry, i) => {
    // originalPalace: 大限第i宫对应原局哪个宫
    const originalPalaceName = resolveOriginalPalaceName(i, mingOriginalIndex)
    // 大限第i宫对应的原局地支位置索引（宫位能级绑定在地支上）
    const natalIdx = (mingOriginalIndex + i) % 12

    // 大限评分：从原局维度评分数组中按地支位置取值
    const score = daXianScores?.[natalIdx]
    // 回退：用 threeLayerTable 中的简略评分
    const fallbackScore = entry.score

    const finalScore = score?.finalScore ?? fallbackScore ?? 0

    // 辅星从 daXianCtx 中获取
    let minorStarsStr = ''
    if (daXianCtx) {
      // 大限第i宫对应的原局宫位索引
      const mappedIdx = (mingOriginalIndex + i) % 12
      const palaceForScoring = daXianCtx.palaces[mappedIdx]
      if (palaceForScoring) {
        const majorStarNames = new Set(
          entry.majorStars.map(s => s.star),
        )
        minorStarsStr = buildMinorStarsString(palaceForScoring.stars, majorStarNames)
      }
    }

    const base: PalaceBaseSpec = {
      palaceName: entry.name,
      earthlyBranch: entry.diZhi,
      heavenlyStem: entry.tianGan ?? currentDaXian.daXianGan,
      majorStars: entry.majorStars.map(s => s.star).join('+'),
      minorStars: minorStarsStr,
      sihua: formatSihuaFromEntries(entry.sihua),
      score: normalizeScore(finalScore),
      level: scoreToLevel(finalScore),
      originalPalace: originalPalaceName,
      daXianPalace: null, // 大限层无大限映射
    }

    return {
      base,
      patterns: score?.patterns?.map(p => ({
        name: p.name,
        level: p.level,
        multiplier: p.multiplier,
      })) ?? [],
      flankingPairs: score?.flankingPairs?.map(fp => ({
        pairName: fp.pairName,
        displayName: fp.displayName,
        pairType: fp.pairType,
      })) ?? [],
    }
  })

  return { palaces, mingOriginalIndex, scoringCtx: daXianCtx }
}

// ═══════════════════════════════════════════════════════════════════
// 流年12宫提取
// ═══════════════════════════════════════════════════════════════════

/**
 * 提取流年12宫完整数据
 *
 * 数据来源：
 *   - stage3.liuNianPalaceScores → 流年独立评分摘要
 *   - threeLayerTable.yearly → diZhi/tianGan/sihua
 *   - buildYearlyScoringContext → 完整星曜数据（复用已有函数）
 *   - natalCtx → 原始宫位数据
 *
 * @param targetYear 流年
 * @param daXianMingOriginalIndex 大限命宫在原局中的索引（用于 daXianPalace 映射）
 */
export function extractLiuNianLayer(
  targetYear: number,
  threeLayerTable: ThreeLayerPalaceTable,
  natalCtx: ScoringContext,
  liuNianPalaceScores: Stage3Output['liuNianPalaceScores'],
  daXianMingOriginalIndex: number,
): LayerFullData {
  const liuNianEntries = threeLayerTable.yearly.palaces

  // 复用已有函数构建流年评分上下文（含完整星曜）
  const liuNianCtx = buildYearlyScoringContext(targetYear, natalCtx)

  // 流年命宫在原局中的索引：找到流年地支对应的原局宫位
  const liuNianZhi = threeLayerTable.yearly.palaces[0]?.diZhi ?? '子'
  const liuNianMingOriginalIndex = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
  const effectiveMingIdx = liuNianMingOriginalIndex >= 0 ? liuNianMingOriginalIndex : 0

  const palaces: FullPalaceData[] = liuNianEntries.map((entry, i) => {
    // originalPalace: 流年第i宫对应原局哪个宫
    const originalPalaceName = resolveOriginalPalaceName(i, effectiveMingIdx)
    // daXianPalace: 流年第i宫对应大限哪个宫
    const daXianPalaceName = resolveOriginalPalaceName(i, daXianMingOriginalIndex)

    // 流年评分：liuNianPalaceScores 按层内索引排列（已修正为地支位置映射）
    const brief = liuNianPalaceScores?.[i]
    const finalScore = brief?.score ?? entry.score ?? 0

    // 辅星从 liuNianCtx 中获取
    let minorStarsStr = ''
    if (liuNianCtx) {
      const mappedIdx = (effectiveMingIdx + i) % 12
      const palaceForScoring = liuNianCtx.palaces[mappedIdx]
      if (palaceForScoring) {
        const majorStarNames = new Set(
          entry.majorStars.map(s => s.star),
        )
        minorStarsStr = buildMinorStarsString(palaceForScoring.stars, majorStarNames)
      }
    }

    const base: PalaceBaseSpec = {
      palaceName: entry.name,
      earthlyBranch: entry.diZhi,
      heavenlyStem: entry.tianGan ?? '甲',
      majorStars: entry.majorStars.map(s => s.star).join('+'),
      minorStars: minorStarsStr,
      sihua: formatSihuaFromEntries(entry.sihua),
      score: normalizeScore(finalScore),
      level: brief?.level ?? scoreToLevel(finalScore),
      originalPalace: originalPalaceName,
      daXianPalace: daXianPalaceName,
    }

    return {
      base,
      patterns: [], // 流年暂无完整格局数据，可后续补充
      flankingPairs: [], // 流年夹宫可从 liuNianCtx 计算
    }
  })

  return { palaces, mingOriginalIndex: effectiveMingIdx, scoringCtx: liuNianCtx }
}

// ═══════════════════════════════════════════════════════════════════
// 三方四正提取（从已提取的层中）
// ═══════════════════════════════════════════════════════════════════

/**
 * 为指定宫位补充三方四正数据
 *
 * 复用 getOppositeIndex / getTrineIndices（来自 scoring-flow.ts）
 *
 * @param focusIndex 焦点宫位索引
 * @param layerData 已提取的层完整数据
 * @param parentMingIndex 父层命宫索引（流年→大限映射用）
 */
export function fillThreeQuadrants(
  focusIndex: number,
  layerData: LayerFullData,
  parentMingIndex: number | null = null,
): ThreeQuadrantsSpec {
  const oppIdx = getOppositeIndex(focusIndex)
  const [trine1Idx, trine2Idx] = getTrineIndices(focusIndex)

  return {
    opposite: layerData.palaces[oppIdx]?.base ?? createEmptyPalaceBase(),
    firstTrine: layerData.palaces[trine1Idx]?.base ?? createEmptyPalaceBase(),
    secondTrine: layerData.palaces[trine2Idx]?.base ?? createEmptyPalaceBase(),
  }
}

/**
 * 为指定宫位补充两夹宫数据
 *
 * 复用 jiagong-matcher.ts 的 getAllFlankingPairs
 */
export function getFlankingInfo(
  palaceIndex: number,
  ctx: ScoringContext,
): Array<{ pairName: string; displayName: string; pairType: string }> {
  const pairs = getAllFlankingPairs(palaceIndex, ctx)
  return pairs.map(p => ({
    pairName: p.pairName,
    displayName: p.displayName,
    pairType: p.pairType,
  }))
}

/**
 * 从大限层获取完整12宫评分（含格局和夹宫）
 *
 * 如果 currentDaXian.scores 已存在直接返回，否则重新构建。
 */
export function ensureDaXianFullScores(
  currentDaXian: DaXianPalaceMapping,
  natalCtx: ScoringContext,
): PalaceScore[] {
  if (currentDaXian.scores && currentDaXian.scores.length === 12) {
    return currentDaXian.scores
  }
  // scores 不存在时返回空数组（不应重新计算，遵循"不重复开发"原则）
  return []
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

function scoreToLevel(score: number): PalaceLevel {
  if (score >= 6.5) return '吉旺'
  if (score >= 3.5) return '平'
  return '凶弱'
}

function normalizeScore(raw: number): number {
  return Math.round(Math.max(0, Math.min(10, raw)) * 10) / 10
}

function formatSihuaFromEntries(
  sihuaList: SihuaEntry[],
): string | null {
  if (!sihuaList || sihuaList.length === 0) return null
  return sihuaList.map(s => `${s.star}${s.type}`).join('+')
}

function createEmptyPalaceData(name: PalaceName): FullPalaceData {
  return {
    base: createEmptyPalaceBaseWithName(name),
    patterns: [],
    flankingPairs: [],
  }
}

function createEmptyPalaceBase(): PalaceBaseSpec {
  return {
    palaceName: '命宫',
    earthlyBranch: '子',
    heavenlyStem: '甲',
    majorStars: '',
    minorStars: '',
    sihua: null,
    score: 0,
    level: '平',
    originalPalace: null,
    daXianPalace: null,
  }
}

function createEmptyPalaceBaseWithName(name: PalaceName): PalaceBaseSpec {
  return {
    ...createEmptyPalaceBase(),
    palaceName: name,
  }
}
