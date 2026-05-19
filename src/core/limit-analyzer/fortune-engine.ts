/**
 * Fortune Engine — 行运计算核心
 *
 * 从 stages/helpers/fortune-runner.ts 迁移并重构：
 * - 提取大限映射
 * - 构建三层宫位对照表（原局/大限/流年）
 * - 计算方向矩阵
 */

import 'server-only'

import { astro as iztroAstro } from 'iztro'

import type {
  TianGan, DiZhi, PalaceName, SihuaEntry, SihuaType,
  ThreeLayerPalaceTable, PalaceLayer, PalaceLayerEntry,
  DaXianPalaceMapping, MajorStar,
  DirectionMatrix,
} from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import { evaluateAllPalaces } from '@/core/energy-evaluator'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { getSihuaTable } from '@/core/sihua-calculator/tables'

/** 十天干 */
const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

/** 十二地支 */
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// ── iztro 类型定义（消除 any） ─────────────────────────────

interface IztroPalaceDecatal {
  range?: [number, number]
  ages?: number[]
  heavenlyStem?: string
  earthlyBranch?: string
}

interface IztroPalaceData {
  name: string
  earthlyBranch: string
  heavenlyStem: string
  majorStars: Array<{ name: string; mutagen?: string; brightness?: number | string; type?: string }>
  minorStars: Array<{ name: string; mutagen?: string; brightness?: number | string; type?: string }>
  isBodyPalace?: boolean
  decadal?: IztroPalaceDecatal
  ages?: number[]
  [key: string]: unknown
}

interface IztroAstrolabeData {
  palaces: IztroPalaceData[]
  horoscope(date: Date, hour: number): IztroHoroscopeData | null
}

interface IztroHoroscopeData {
  decadal: IztroScopeItemData
  yearly: IztroScopeItemData
  age: IztroScopeItemData & { nominalAge?: number }
  monthly: IztroScopeItemData
  daily: IztroScopeItemData
}

interface IztroScopeItemData {
  index: number
  name: string
  heavenlyStem: string
  earthlyBranch: string
  palaceNames: string[]
  mutagen: string[]
}

// ── 核心函数 ──────────────────────────────────────────────

/** 从出生信息重建 iztro 命盘 */
function reconstructAstrolabe(chartData: Record<string, unknown>): IztroAstrolabeData | null {
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  if (!birthInfo) return null

  const { year, month, day, hour, gender } = birthInfo as Record<string, unknown>
  if (
    typeof year !== 'number' || typeof month !== 'number' ||
    typeof day !== 'number' || typeof hour !== 'number' ||
    typeof gender !== 'string'
  ) return null

  try {
    const genderStr = gender === 'MALE' || gender === '男' ? '男' : '女'
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return iztroAstro.bySolar(dateStr, hour as number, genderStr, true, 'zh-CN') as unknown as IztroAstrolabeData
  } catch (err) {
    console.error('[FortuneEngine] 重建命盘失败:', err)
    return null
  }
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
 * 从 iztro 命盘提取全部大限映射
 */
export function extractAllDaXianMappings(
  chartData: Record<string, unknown>,
  _birthYear: number,
): DaXianPalaceMapping[] {
  const astrolabe = reconstructAstrolabe(chartData)
  if (!astrolabe) return []

  const mappings: DaXianPalaceMapping[] = []

  for (let i = 0; i < astrolabe.palaces.length; i++) {
    const palace = astrolabe.palaces[i]
    const dec = palace.decadal
    if (!dec) continue

    const ageRange: [number, number] = dec.range ?? (
      palace.ages && palace.ages.length >= 2
        ? [palace.ages[0], palace.ages[palace.ages.length - 1]]
        : [0, 0]
    )

    if (ageRange[0] <= 0) continue

    const daXianGan = (dec.heavenlyStem ?? palace.heavenlyStem) as TianGan
    const mutagen = getSihuaFromGan(daXianGan)
    const palaceIndex = PALACE_NAMES.indexOf(palace.name as PalaceName)
    if (palaceIndex < 0) continue

    mappings.push({
      index: mappings.length + 1,
      ageRange,
      daXianGan,
      mingPalaceName: palace.name as PalaceName,
      palaceIndex,
      mutagen,
    })
  }

  mappings.sort((a, b) => a.ageRange[0] - b.ageRange[0])
  mappings.forEach((m, i) => { m.index = i + 1 })

  return mappings
}

/**
 * 构建三层宫位对照表
 */
export function buildThreeLayerTable(
  natalCtx: ScoringContext,
  chartData: Record<string, unknown>,
  targetYear: number,
): { table: ThreeLayerPalaceTable; daXianMappings: DaXianPalaceMapping[] } {
  const daXianMappings = extractAllDaXianMappings(chartData, 0)

  for (const mapping of daXianMappings) {
    try {
      const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
      if (daXianCtx) {
        mapping.scores = evaluateAllPalaces(daXianCtx)
      }
    } catch (err) {
      console.warn(`[FortuneEngine] 大限${mapping.index}评分失败:`, err)
    }
  }

  const natalLayer = buildNatalLayer(natalCtx)

  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentAge = targetYear - birthYear

  const currentDaXian = daXianMappings.find(
    d => d.ageRange[0] <= currentAge && d.ageRange[1] >= currentAge,
  ) ?? daXianMappings[0]

  const decadalLayer = currentDaXian
    ? buildDaXianLayer(currentDaXian, natalCtx)
    : buildEmptyLayer('大限')

  const birthHour = typeof birthInfo?.hour === 'number' ? birthInfo.hour : 12
  const yearlyData = getYearlyFromIztro(chartData, targetYear, birthHour)

  let liuNianGan: TianGan
  let liuNianZhi: DiZhi

  if (yearlyData) {
    liuNianGan = yearlyData.heavenlyStem as TianGan
    liuNianZhi = yearlyData.earthlyBranch as DiZhi
  } else {
    liuNianGan = GAN_TABLE[(targetYear - 4) % 10]
    liuNianZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
  }

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
 * 计算方向矩阵
 */
export function calculateDirectionMatrix(
  daXianMapping: DaXianPalaceMapping | undefined,
  targetYear: number,
  natalCtx?: ScoringContext,
): DirectionMatrix {
  let daXianScore = 0
  if (daXianMapping?.mutagen[0]) daXianScore += 2
  if (daXianMapping?.mutagen[1]) daXianScore += 1
  if (daXianMapping?.mutagen[2]) daXianScore += 0.5
  if (daXianMapping?.mutagen[3]) daXianScore -= 2

  if (natalCtx && daXianMapping) {
    const keyPalaceIndices = [0, 4, 6, 8]
    const weights = [2, 1, 0.5, -2]
    for (let i = 0; i < daXianMapping.mutagen.length && i < 4; i++) {
      const starName = daXianMapping.mutagen[i]
      if (!starName) continue
      for (const idx of keyPalaceIndices) {
        const palace = natalCtx.palaces[idx]
        if (palace?.stars.some(s => s.name === starName)) {
          daXianScore += weights[i] * 0.5
        }
      }
    }
  }

  const daXianDirection: '吉' | '凶' = daXianScore > 0 ? '吉' : (daXianScore < 0 ? '凶' : '吉')

  const liuNianGan = GAN_TABLE[(targetYear - 4) % 10]
  const liuNianSihua = getSihuaTable()[liuNianGan]

  let liuNianScore = 0
  if (liuNianSihua.禄) liuNianScore += 2
  if (liuNianSihua.权) liuNianScore += 1
  if (liuNianSihua.科) liuNianScore += 0.5
  if (liuNianSihua.忌) liuNianScore -= 2

  const liuNianDirection: '吉' | '凶' = liuNianScore > 0 ? '吉' : (liuNianScore < 0 ? '凶' : '吉')

  return `${daXianDirection}${liuNianDirection}` as DirectionMatrix
}

// ── 内部辅助 ──────────────────────────────────────────────

function getYearlyFromIztro(
  chartData: Record<string, unknown>,
  targetYear: number,
  birthHour: number,
): IztroScopeItemData | null {
  const astrolabe = reconstructAstrolabe(chartData)
  if (!astrolabe) return null

  try {
    const targetDate = new Date(targetYear, 5, 15)
    const horoscope = astrolabe.horoscope(targetDate, birthHour)
    if (!horoscope) return null
    return horoscope.yearly
  } catch (err) {
    console.warn('[FortuneEngine] iztro horoscope 调用失败:', err)
    return null
  }
}

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

function buildDaXianScoringContext(mapping: DaXianPalaceMapping, natalCtx: ScoringContext): ScoringContext | null {
  if (!mapping.mutagen || mapping.mutagen.length < 4) return null

  const daXianPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < mapping.mutagen.length && i < 4; i++) {
    const starName = mapping.mutagen[i]
    const sihuaType = sihuaTypes[i]
    for (const palace of daXianPalaces) {
      for (const star of palace.stars) {
        if (star.name === starName && !star.sihua) {
          star.sihua = sihuaType
          star.sihuaSource = '大限'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: daXianPalaces,
    birthGan: mapping.daXianGan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}
