/**
 * Fortune Engine — 行运计算核心
 *
 * 数据源统一原则：
 * - 所有命盘数据必须来自前端传入的 chartData（即 iztro 排盘后的序列化数据）
 * - 禁止直接调用 iztro 重新排盘，避免前后端数据不一致
 * - 大限信息从 chartData.palaces[].decadal 读取
 * - 流年干支从 chartData.horoscope 读取，缺失时通过公式计算
 */

import 'server-only'

import type {
  TianGan, DiZhi, PalaceName, SihuaEntry, SihuaType,
  ThreeLayerPalaceTable, PalaceLayer, PalaceLayerEntry,
  DaXianPalaceMapping, MajorStar,
  DirectionMatrix,
} from '@/core/types'
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '@/core/types'
import { getSihuaTable } from '@/core/sihua-calculator'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { evaluatePalacePatternsOnly } from '@/core/energy-evaluator/pattern-scoring'
import { scoreLayerByDelta } from '@/core/energy-evaluator/layer-delta-scoring'
import type { PalaceScore } from '@/core/types'
import { buildDaXianScoringContext } from './limit-scoring-context'
import {
  directionFromLayerScore,
  scoreMutagenLayerForDirection,
  type MatterFocus,
} from './sihua-trigger-engine'
import type { Stage1Output } from '@/core/types'

/** 十天干 */
const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

/** 十二地支 */
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// ── 类型定义（与 serialize-chart-for-reading.ts 输出结构统一） ───────

/** 序列化星曜（来自 serialize-chart-for-reading.ts 的输出） */
interface SerializedStar {
  name: string
  type: string
  mutagen: string
  brightness: string
}

/** 序列化宫位（来自 serialize-chart-for-reading.ts 的输出） */
interface SerializedPalace {
  name: string
  earthlyBranch: string
  heavenlyStem: string
  isBodyPalace: boolean
  isOriginalPalace: boolean
  majorStars: SerializedStar[]
  minorStars: SerializedStar[]
  adjectiveStars: SerializedStar[]
  decadal?: {
    range: [number, number]
    heavenlyStem: string
    earthlyBranch: string
  }
  ages?: number[]
}

// ── 核心函数 ──────────────────────────────────────────────

/**
 * 从 chartData 中提取宫位数组（统一数据源）
 *
 * 注意：chartData 由 serialize-chart-for-reading.ts 序列化生成，
 * 因此结构应与 SerializedPalace 保持一致。
 */
function extractPalacesFromChartData(chartData: Record<string, unknown>): SerializedPalace[] {
  const palaces = chartData.palaces as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(palaces)) return []
  return palaces.map(p => ({
    name: String(p.name ?? ''),
    earthlyBranch: String(p.earthlyBranch ?? ''),
    heavenlyStem: String(p.heavenlyStem ?? ''),
    isBodyPalace: Boolean(p.isBodyPalace),
    isOriginalPalace: Boolean(p.isOriginalPalace),
    majorStars: (p.majorStars as Array<Record<string, unknown>> ?? []).map(s => ({
      name: String(s.name ?? ''),
      type: String(s.type ?? ''),
      mutagen: String(s.mutagen ?? ''),
      brightness: String(s.brightness ?? ''),
    })),
    minorStars: (p.minorStars as Array<Record<string, unknown>> ?? []).map(s => ({
      name: String(s.name ?? ''),
      type: String(s.type ?? ''),
      mutagen: String(s.mutagen ?? ''),
      brightness: String(s.brightness ?? ''),
    })),
    adjectiveStars: (p.adjectiveStars as Array<Record<string, unknown>> ?? []).map(s => ({
      name: String(s.name ?? ''),
      type: String(s.type ?? ''),
      mutagen: String(s.mutagen ?? ''),
      brightness: String(s.brightness ?? ''),
    })),
    decadal: p.decadal
      ? {
          range: (p.decadal as Record<string, unknown>).range as [number, number],
          heavenlyStem: String((p.decadal as Record<string, unknown>).heavenlyStem ?? ''),
          earthlyBranch: String((p.decadal as Record<string, unknown>).earthlyBranch ?? ''),
        }
      : undefined,
    ages: Array.isArray(p.ages) ? p.ages as number[] : undefined,
  }))
}

function buildDaXianMappingsFromPalaces(palaces: SerializedPalace[]): DaXianPalaceMapping[] {
  const mappings: DaXianPalaceMapping[] = []
  for (const palace of palaces) {
    const dec = palace.decadal
    if (!dec) continue
    const ageRange: [number, number] = dec.range ?? (
      palace.ages && palace.ages.length >= 2
        ? [palace.ages[0], palace.ages[palace.ages.length - 1]]
        : [0, 0]
    )
    if (ageRange[0] <= 0) continue
    const daXianGan = (dec.heavenlyStem ?? palace.heavenlyStem) as TianGan
    const palaceIndex = PALACE_NAMES.indexOf(palace.name as PalaceName)
    if (palaceIndex < 0) continue
    mappings.push({
      index: mappings.length + 1,
      ageRange,
      daXianGan,
      mingPalaceName: palace.name as PalaceName,
      palaceIndex,
      mutagen: getSihuaFromGan(daXianGan),
    })
  }
  mappings.sort((a, b) => a.ageRange[0] - b.ageRange[0])
  mappings.forEach((m, i) => { m.index = i + 1 })
  return mappings
}

/**
 * 从天干查四化星名数组
 * @returns [化禄星, 化权星, 化科星, 化忌星]
 */
function getSihuaFromGan(gan: TianGan): string[] {
  const mapping = getSihuaTable()[gan]
  return [mapping.禄, mapping.权, mapping.科, mapping.忌]
}

/**
 * 从 chartData 提取全部大限映射（统一数据源）
 *
 * 统一数据源：直接读取 chartData.palaces[].decadal
 * 禁止调用 iztro 重新排盘
 */
export function extractAllDaXianMappings(
  chartData: Record<string, unknown>,
  _birthYear: number,
): DaXianPalaceMapping[] {
  return buildDaXianMappingsFromPalaces(extractPalacesFromChartData(chartData))
}

/**
 * 解析目标年的虚岁：优先 horoscope.age.nominalAge（需 referenceYear 对齐）
 */
function resolveNominalAge(
  chartData: Record<string, unknown> | undefined,
  targetYear: number,
  birthYear: number,
): number {
  if (chartData) {
    const horoscope = chartData.horoscope as Record<string, unknown> | undefined
    const refYear = typeof horoscope?.referenceYear === 'number' ? horoscope.referenceYear : undefined
    const ageScope = horoscope?.age as { nominalAge?: number } | undefined
    if (refYear === targetYear && typeof ageScope?.nominalAge === 'number') {
      return ageScope.nominalAge
    }
  }
  // 虚岁近似：出生年计一岁
  return targetYear - birthYear + 1
}

/**
 * 统一获取当前大限 — 直接从 iztro horoscope.decadal 构建（权威数据源）
 *
 * iztro 的 horoscope(year, timeIndex).decadal 包含：
 * - index: 大限所在的原局宫位索引（0-11），palaces[index] 即大限命宫所在的原局位置
 * - heavenlyStem: 大限天干
 * - mutagen: 大限四化
 * - palaceNames: getPalaceNames(index) 的重排结果，[0] 并非大限命宫名！
 *
 * 注意：palaceNames[0] 是 getPalaceNames 重排后的数学结果，不是大限命宫名。
 * 大限命宫 = 原局 palaces[decadalIndex] 所在位置。
 */
export function findCurrentDaXianFromChart(
  _mappings: DaXianPalaceMapping[],
  targetYear: number,
  birthYear: number,
  chartData?: Record<string, unknown>,
): DaXianPalaceMapping | undefined {
  const nominalAge = resolveNominalAge(chartData, targetYear, birthYear)
  const ageMatched = _mappings.find(d => d.ageRange[0] <= nominalAge && d.ageRange[1] >= nominalAge)

  if (chartData) {
    const horoscope = chartData.horoscope as Record<string, unknown> | undefined
    const refYear = typeof horoscope?.referenceYear === 'number' ? horoscope.referenceYear : undefined
    const decadalScope = horoscope?.decadal as Record<string, unknown> | undefined
    const decadalGan = decadalScope?.heavenlyStem
    const decadalIndex = typeof decadalScope?.index === 'number' ? decadalScope.index as number : -1
    const decadalMutagen = decadalScope?.mutagen as string[] | undefined

    // horoscope 与 targetYear 对齐时，decadal 为权威；index 用虚岁匹配的 mapping 避免重复天干错限
    if (refYear === targetYear && typeof decadalGan === 'string' && decadalGan && decadalIndex >= 0 && decadalIndex < 12) {
      // decadalIndex 是 iztro palaces 数组索引（按地支排列），不是 PALACE_NAMES 索引
      // 必须从 chartData.palaces 取宫名，不能混用 PALACE_NAMES
      const chartPalaces = chartData.palaces as Array<Record<string, unknown>> | undefined
      const mingPalaceName = (chartPalaces?.[decadalIndex]?.name ?? PALACE_NAMES[decadalIndex]) as PalaceName
      // palaceIndex 需要转为 PALACE_NAMES 体系下的索引（供后续评分使用）
      const palaceIndex = PALACE_NAME_TO_INDEX[mingPalaceName] ?? decadalIndex
      const base = ageMatched ?? _mappings.find(m => m.daXianGan === decadalGan)
      return {
        index: base?.index ?? 0,
        ageRange: base?.ageRange ?? [0, 0] as [number, number],
        daXianGan: decadalGan as TianGan,
        mingPalaceName,
        palaceIndex,
        mutagen: decadalMutagen ?? base?.mutagen ?? [],
        scores: base?.scores,
        palacePatterns: base?.palacePatterns,
        patterns: base?.patterns,
      }
    }
  }

  return ageMatched
}

/**
 * 流年干支单一真源：chartData.horoscope → 公式计算
 * 禁止调用 iztro 重新排盘
 */
export function resolveLiuNianGanZhi(
  chartData: Record<string, unknown>,
  targetYear: number,
): { gan: TianGan; zhi: DiZhi; source: 'snapshot' | 'formula' } {
  const horoscope = chartData.horoscope as Record<string, unknown> | undefined
  const refYear = typeof horoscope?.referenceYear === 'number' ? horoscope.referenceYear : undefined
  const yearly = horoscope?.yearly as Record<string, unknown> | undefined
  if (yearly?.heavenlyStem && refYear === targetYear) {
    return {
      gan: yearly.heavenlyStem as TianGan,
      zhi: (yearly.earthlyBranch as DiZhi) ?? DI_ZHI_ORDER[(targetYear - 4) % 12],
      source: 'snapshot',
    }
  }

  return {
    gan: GAN_TABLE[(targetYear - 4) % 10],
    zhi: DI_ZHI_ORDER[(targetYear - 4) % 12],
    source: 'formula',
  }
}

export function resolveLiuNianGan(chartData: Record<string, unknown>, targetYear: number): TianGan {
  return resolveLiuNianGanZhi(chartData, targetYear).gan
}

/**
 * 构建三层宫位对照表
 */
export function buildThreeLayerTable(
  natalCtx: ScoringContext,
  chartData: Record<string, unknown>,
  targetYear: number,
  natalPalaceScores?: PalaceScore[],
): { table: ThreeLayerPalaceTable; daXianMappings: DaXianPalaceMapping[] } {
  const daXianMappings = extractAllDaXianMappings(chartData, 0)

  // 使用增量评分：大限得分 = 原局得分 + 大限四化增量
  for (const mapping of daXianMappings) {
    try {
      const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
      if (daXianCtx) {
        const palacePatterns = evaluatePalacePatternsOnly(daXianCtx)
        if (natalPalaceScores) {
          // 增量模式：在原局基础上叠加
          mapping.scores = scoreLayerByDelta(natalPalaceScores, {
            layerCtx: daXianCtx,
            layerLabel: '大限',
            palacePatterns,
          })
        }
        mapping.palacePatterns = palacePatterns
        mapping.patterns = palacePatterns[mapping.palaceIndex] ?? palacePatterns[0] ?? []
      }
    } catch (err) {
      console.warn(`[FortuneEngine] 大限${mapping.index}评分失败:`, err)
    }
  }

  const natalLayer = buildNatalLayer(natalCtx)

  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990

  const currentDaXian = findCurrentDaXianFromChart(daXianMappings, targetYear, birthYear, chartData) ?? daXianMappings[0]

  const decadalLayer = currentDaXian
    ? buildDaXianLayer(currentDaXian, natalCtx)
    : buildEmptyLayer('大限')

  const { gan: liuNianGan, zhi: liuNianZhi } = resolveLiuNianGanZhi(chartData, targetYear)

  const liuNianSihuaMap = getSihuaTable()[liuNianGan]
  const liuNianSihuaEntries: SihuaEntry[] = [
    { type: '化禄', star: liuNianSihuaMap.禄, source: '流年' },
    { type: '化权', star: liuNianSihuaMap.权, source: '流年' },
    { type: '化科', star: liuNianSihuaMap.科, source: '流年' },
    { type: '化忌', star: liuNianSihuaMap.忌, source: '流年' },
  ]

  const yearlyLayer = buildYearlyLayer(liuNianGan, liuNianZhi, liuNianSihuaEntries, natalCtx)

  return {
    table: { natal: natalLayer, decadal: decadalLayer, yearly: yearlyLayer },
    daXianMappings,
  }
}

/**
 * 计算方向矩阵（大限×流年），四化落宫按事项主/辅宫 + 命宫焦点计分
 */
export function calculateDirectionMatrix(
  daXianMapping: DaXianPalaceMapping | undefined,
  targetYear: number,
  natalCtx?: ScoringContext,
  chartData?: Record<string, unknown>,
  focus?: MatterFocus,
  palaceScores?: Stage1Output['palaceScores'],
): DirectionMatrix {
  const matterFocus: MatterFocus = focus ?? {
    primaryPalace: '命宫',
    secondaryPalaces: [],
  }

  let daXianScore = 0
  if (natalCtx && daXianMapping && palaceScores) {
    daXianScore = scoreMutagenLayerForDirection(
      daXianMapping.mutagen,
      natalCtx,
      matterFocus,
      palaceScores,
    )
  } else if (daXianMapping) {
    const sihuaBase = { lu: 2, quan: 1, ke: 0.5, ji: -2 }
    if (daXianMapping.mutagen[0]) daXianScore += sihuaBase.lu
    if (daXianMapping.mutagen[1]) daXianScore += sihuaBase.quan
    if (daXianMapping.mutagen[2]) daXianScore += sihuaBase.ke
    if (daXianMapping.mutagen[3]) daXianScore += sihuaBase.ji
  }

  const daXianDirection = directionFromLayerScore(daXianScore)

  const liuNianGan = chartData
    ? resolveLiuNianGan(chartData, targetYear)
    : GAN_TABLE[(targetYear - 4) % 10]
  const liuNianSihua = getSihuaTable()[liuNianGan]
  const liuNianMutagen = [liuNianSihua.禄, liuNianSihua.权, liuNianSihua.科, liuNianSihua.忌]

  let liuNianScore = 0
  if (natalCtx && palaceScores) {
    liuNianScore = scoreMutagenLayerForDirection(
      liuNianMutagen,
      natalCtx,
      matterFocus,
      palaceScores,
    )
  } else {
    const sihuaBase = { lu: 2, quan: 1, ke: 0.5, ji: -2 }
    if (liuNianSihua.禄) liuNianScore += sihuaBase.lu
    if (liuNianSihua.权) liuNianScore += sihuaBase.quan
    if (liuNianSihua.科) liuNianScore += sihuaBase.ke
    if (liuNianSihua.忌) liuNianScore += sihuaBase.ji
  }

  const liuNianDirection = directionFromLayerScore(liuNianScore)

  return `${daXianDirection}${liuNianDirection}` as DirectionMatrix
}

// ── 内部辅助 ──────────────────────────────────────────────

function buildNatalLayer(ctx: ScoringContext): PalaceLayer {
  const entries: PalaceLayerEntry[] = ctx.palaces.map((p, i) => ({
    name: PALACE_NAMES[i] as PalaceName,
    diZhi: p.diZhi,
    majorStars: p.majorStars,
    sihua: p.stars.filter(s => s.sihua).map(s => ({
      type: s.sihua as SihuaType,
      star: s.name as MajorStar,
      source: (s.sihuaSource ?? '生年') as SihuaEntry['source'],
    })),
  }))
  return { layer: '原局', palaces: entries }
}

function buildDaXianLayer(mapping: DaXianPalaceMapping, natalCtx: ScoringContext): PalaceLayer {
  const gan = mapping.daXianGan
  const sihuaEntries: SihuaEntry[] = []
  if (mapping.mutagen[0]) sihuaEntries.push({ type: '化禄', star: mapping.mutagen[0] as MajorStar, source: '大限' })
  if (mapping.mutagen[1]) sihuaEntries.push({ type: '化权', star: mapping.mutagen[1] as MajorStar, source: '大限' })
  if (mapping.mutagen[2]) sihuaEntries.push({ type: '化科', star: mapping.mutagen[2] as MajorStar, source: '大限' })
  if (mapping.mutagen[3]) sihuaEntries.push({ type: '化忌', star: mapping.mutagen[3] as MajorStar, source: '大限' })

  const offset = mapping.palaceIndex

  const entries: PalaceLayerEntry[] = natalCtx.palaces.map((_, i) => {
    const mappedIdx = (offset + i) % 12
    const mapped = natalCtx.palaces[mappedIdx]
    return {
      name: PALACE_NAMES[i] as PalaceName,
      diZhi: mapped.diZhi,
      tianGan: gan,
      majorStars: mapped.majorStars,
      sihua: sihuaEntries.filter(e => mapped.stars.some(s => s.name === e.star)),
    }
  })

  return { layer: '大限', palaces: entries }
}

function buildYearlyLayer(
  gan: TianGan,
  zhi: DiZhi,
  sihuaEntries: SihuaEntry[],
  natalCtx: ScoringContext,
): PalaceLayer {
  const startIdx = natalCtx.palaces.findIndex(p => p.diZhi === zhi)
  if (startIdx < 0) return buildEmptyLayer('流年')

  const entries: PalaceLayerEntry[] = natalCtx.palaces.map((_, i) => {
    const mappedIdx = (startIdx + i) % 12
    const mapped = natalCtx.palaces[mappedIdx]
    return {
      name: PALACE_NAMES[i] as PalaceName,
      diZhi: mapped.diZhi,
      tianGan: gan,
      majorStars: mapped.majorStars,
      sihua: sihuaEntries.filter(e => mapped.stars.some(s => s.name === e.star)),
    }
  })

  return { layer: '流年', palaces: entries }
}

function buildEmptyLayer(label: '大限' | '流年'): PalaceLayer {
  const palaces: PalaceLayerEntry[] = PALACE_NAMES.map(name => ({
    name: name as PalaceName,
    diZhi: '子' as DiZhi,
    majorStars: [],
    sihua: [],
  }))
  return { layer: label, palaces }
}

export { buildDaXianScoringContext } from './limit-scoring-context'
