/**
 * 宫位基础结构格式化器
 *
 * 将现有 PalaceScore + PalaceLayerEntry 转换为规范定义的 PalaceBaseSpec。
 * 数据来源（全部复用现有接口）：
 *   - PalaceScore: scoring-flow.ts 6步评分结果（score/tone/patterns/flankingPairs）
 *   - PalaceLayerEntry: fortune-engine.ts 三层表（name/diZhi/tianGan/majorStars/sihua）
 */

import type { PalaceScore, PalaceLayerEntry, PalaceName, DiZhi, TianGan } from '../types'
import { PALACE_NAME_TO_INDEX } from '../types'
import type { PalaceBaseSpec, PalaceLevel } from './types'

/** score → level 映射（对齐文档规范） */
function scoreToLevel(score: number): PalaceLevel {
  if (score >= 6.5) return '吉旺'
  if (score >= 3.5) return '平'
  return '凶弱'
}

/** 标准化分数到 0-10 范围（PalaceScore.finalScore 通常已在此范围） */
function normalizeScore(raw: number): number {
  return Math.round(Math.max(0, Math.min(10, raw)) * 10) / 10
}

/** 拼接主星名称（用 + 连接） */
function joinMajorStars(
  majorStars: Array<{ star: string; brightness: string }>,
): string {
  return majorStars.map(s => s.star).join('+')
}

/** 拼接辅星名称（用 + 连接） */
function joinMinorStars(layerEntry: PalaceLayerEntry): string {
  // PalaceLayerEntry 只有 majorStars，辅星需要从评分上下文获取
  // 但对于格式化目的，sihua 之外的辅星信息从 PalaceScore 不直接可取
  // 这里暂返回空串，在 layer-extractor 中会从完整数据源补全
  void layerEntry
  return ''
}

/** 拼接四化描述（如"天同化禄"），无四化返回 null */
function formatSihua(sihuaList: Array<{ type: string; star: string }>): string | null {
  if (!sihuaList || sihuaList.length === 0) return null
  return sihuaList.map(s => `${s.star}${s.type}`).join('+')
}

/**
 * 从 PalaceScore + PalaceLayerEntry 构建 PalaceBaseSpec
 *
 * @param palaceScore 评分结果（来源：scoring-flow.ts evaluateSinglePalace）
 * @param layerEntry 层表数据（来源：fortune-engine.ts buildThreeLayerTable）
 * @param originalPalace 对应原局宫名（大限/流年用，原局传 null）
 * @param daXianPalace 对应大限宫名（流年用，原局/大限传 null）
 */
export function formatPalaceBase(
  palaceScore: PalaceScore,
  layerEntry: PalaceLayerEntry,
  originalPalace: PalaceName | null = null,
  daXianPalace: PalaceName | null = null,
): PalaceBaseSpec {
  return {
    palaceName: palaceScore.palace,
    earthlyBranch: palaceScore.diZhi,
    heavenlyStem: layerEntry.tianGan ?? (palaceScore.diZhi as unknown as TianGan), // 原局有固定天干
    majorStars: joinMajorStars(palaceScore.majorStars),
    minorStars: joinMinorStars(layerEntry),
    sihua: formatSihua(layerEntry.sihua),
    score: normalizeScore(palaceScore.finalScore),
    level: scoreToLevel(palaceScore.finalScore),
    originalPalace,
    daXianPalace,
  }
}

/**
 * 仅从 PalaceLayerEntry 构建简化 PalaceBaseSpec（无评分时使用）
 *
 * 用于辅助宫位或评分不可用的场景。
 */
export function formatPalaceBaseFromLayer(
  layerEntry: PalaceLayerEntry,
  score: number | undefined,
  originalPalace: PalaceName | null = null,
  daXianPalace: PalaceName | null = null,
): PalaceBaseSpec {
  const normalizedScore = score != null ? normalizeScore(score) : 0
  return {
    palaceName: layerEntry.name,
    earthlyBranch: layerEntry.diZhi,
    heavenlyStem: layerEntry.tianGan ?? ('' as TianGan),
    majorStars: joinMajorStars(layerEntry.majorStars),
    minorStars: '',
    sihua: formatSihua(layerEntry.sihua),
    score: normalizedScore,
    level: scoreToLevel(normalizedScore),
    originalPalace,
    daXianPalace,
  }
}

/**
 * 计算大限/流年宫位对应的原局宫名
 *
 * 大限命宫从原局第 N 个宫位起，则大限宫位索引 → 原局宫位索引的偏移关系：
 *   大限宫位 i 对应原局宫位 (i - daXianMingOffset + 12) % 12
 * 但由于大限12宫沿用原局12宫的地支和天干，只需通过索引映射即可。
 *
 * @param layerPalaceIndex 该层12宫中宫位的索引（0-11）
 * @param mingPalaceIndex 该层命宫在原局中的索引
 */
export function resolveOriginalPalaceName(
  layerPalaceIndex: number,
  mingPalaceIndex: number,
): PalaceName {
  // 大限命宫 = 原局第 mingPalaceIndex 宫
  // 大限的第0宫（命宫）对应原局 mingPalaceIndex
  // 大限的第i宫对应原局 (mingPalaceIndex + i) % 12
  const originalIdx = (mingPalaceIndex + layerPalaceIndex) % 12
  const names: readonly PalaceName[] = [
    '命宫', '父母', '福德', '田宅', '官禄', '仆役',
    '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
  ]
  return names[originalIdx]!
}

/**
 * 从索引获取宫名
 */
export function getPalaceNameByIndex(idx: number): PalaceName {
  const names: readonly PalaceName[] = [
    '命宫', '父母', '福德', '田宅', '官禄', '仆役',
    '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
  ]
  return names[idx % 12]!
}

/**
 * 从宫名获取索引
 */
export function getPalaceIndexByName(name: PalaceName): number {
  return PALACE_NAME_TO_INDEX[name]
}

/**
 * 填充辅星字符串（从完整的 ScoringContext 星曜数据中提取）
 *
 * 在 layer-extractor 中调用此函数补全 minorStars。
 */
export function buildMinorStarsString(
  stars: Array<{ name: string; sihua?: string }>,
  majorStarNames: Set<string>,
): string {
  const minorNames: string[] = []
  for (const star of stars) {
    if (star.name === '禄存') continue // 禄存单独处理
    if (majorStarNames.has(star.name)) continue
    minorNames.push(star.name)
  }
  return minorNames.join('+')
}
