/**
 * Helper: 行运计算器
 *
 * 集成 horoscope-computer 和 iztro，计算全部大限和流年数据。
 * 输出 ThreeLayerPalaceTable + DaXianPalaceMapping[]。
 *
 * 核心修正（vs 旧版）：
 * 1. palace.decadal 只有 range/heavenlyStem/earthlyBranch，没有 mutagen/palaceNames/index
 *    → 大限四化从 heavenlyStem 通过 getSihuaTable() 计算
 *    → palaceIndex 从 palace.name 在 PALACE_NAMES 中的位置获取
 * 2. 流年数据使用 iztro horoscope() API 获取天干地支
 * 3. 宫位索引统一使用 PALACE_NAMES 序（命宫=0），不再混用地支序
 * 4. 流年四化只取流年（或论限）之天干四化，不叠用五虎遁宫干（原局太岁宫宫干四化 / 遁干法第二层）
 *
 * 数据流：
 * chartData + birthInfo
 *   → iztro astrolabe（排盘一次）
 *   → 提取所有大限宫位/天干/年龄范围（从 palace.decadal）
 *   → 计算大限四化（从大限天干查 SIHUA_TABLE）
 *   → 当前流年数据（iztro API 或自行推算）
 *   → 构建三层宫位对照表
 */

import 'server-only'

import { astro as iztroAstro } from 'iztro'

import type {
  TianGan, DiZhi, PalaceName, SihuaEntry, SihuaType,
  ThreeLayerPalaceTable, PalaceLayer, PalaceLayerEntry,
  DaXianPalaceMapping, PalaceBrightness, MajorStar,
  DirectionMatrix,
} from '@/core/types'
import { PALACE_NAMES, getDirectionWindow } from '@/core/types'
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
    console.error('[FortuneRunner] 重建命盘失败:', err)
    return null
  }
}

/**
 * 从天干查四化星名数组
 *
 * @returns [化禄星, 化权星, 化科星, 化忌星]
 */
function getSihuaFromGan(gan: TianGan): string[] {
  const mapping = getSihuaTable()[gan]
  return [mapping.禄, mapping.权, mapping.科, mapping.忌]
}

/**
 * 从 iztro 命盘提取全部大限映射
 *
 * 关键修正：
 * - palace.decadal 只有 range/heavenlyStem/earthlyBranch
 * - 四化从 heavenlyStem 通过 getSihuaTable() 计算（不依赖不存在的 mutagen 字段）
 * - palaceIndex 使用 PALACE_NAMES.indexOf(palace.name)（PALACE_NAMES 序，非 iztro 序）
 *
 * @param chartData 原始命盘数据
 * @param _birthYear 出生年（保留参数兼容）
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

    // 跳过无效范围
    if (ageRange[0] <= 0) continue

    const daXianGan = (dec.heavenlyStem ?? palace.heavenlyStem) as TianGan

    // 大限四化：从大限天干查 SIHUA_TABLE（非 palace.decadal.mutagen，那个字段不存在）
    const mutagen = getSihuaFromGan(daXianGan)

    // palaceIndex：使用 PALACE_NAMES 序（命宫=0），不是 iztro 序（寅=0）
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

  // 按年龄范围排序
  mappings.sort((a, b) => a.ageRange[0] - b.ageRange[0])
  mappings.forEach((m, i) => { m.index = i + 1 })

  return mappings
}

/**
 * 构建三层宫位对照表
 *
 * 核心修正：
 * 1. 流年四化只用流年天干查 getSihuaTable()，不含五虎遁宫干（太岁宫宫干）四化
 * 2. 宫位索引统一使用 PALACE_NAMES 序
 *
 * @param natalCtx 原局评分上下文
 * @param chartData 原始命盘数据
 * @param targetYear 目标流年
 */
export function buildThreeLayerTable(
  natalCtx: ScoringContext,
  chartData: Record<string, unknown>,
  targetYear: number,
): { table: ThreeLayerPalaceTable; daXianMappings: DaXianPalaceMapping[] } {
  const daXianMappings = extractAllDaXianMappings(chartData, 0)

  // 对每个大限计算评分（M2 六步评分）
  for (const mapping of daXianMappings) {
    try {
      const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
      if (daXianCtx) {
        mapping.scores = evaluateAllPalaces(daXianCtx)
      }
    } catch (err) {
      console.warn(`[FortuneRunner] 大限${mapping.index}评分失败:`, err)
    }
  }

  // 原局层
  const natalLayer = buildNatalLayer(natalCtx)

  // 当前大限
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentAge = targetYear - birthYear

  const currentDaXian = daXianMappings.find(
    d => d.ageRange[0] <= currentAge && d.ageRange[1] >= currentAge,
  ) ?? daXianMappings[0]

  const decadalLayer = currentDaXian
    ? buildDaXianLayer(currentDaXian, natalCtx)
    : buildEmptyLayer('大限')

  // 流年层 —— 优先使用 iztro horoscope() API
  const birthHour = typeof birthInfo?.hour === 'number' ? birthInfo.hour : 12
  const yearlyData = getYearlyFromIztro(chartData, targetYear, birthHour)

  let liuNianGan: TianGan
  let liuNianZhi: DiZhi

  if (yearlyData) {
    // 使用 iztro API 返回的流年数据（推荐路径）
    liuNianGan = yearlyData.heavenlyStem as TianGan
    liuNianZhi = yearlyData.earthlyBranch as DiZhi
  } else {
    // 降级：自行推算（兼容旧版）
    liuNianGan = GAN_TABLE[(targetYear - 4) % 10]
    liuNianZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
  }

  // 流年四化：只用流年天干四化，不含五虎遁宫干（太岁宫宫干）叠用
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
 * 使用 iztro horoscope() API 获取流年数据
 */
function getYearlyFromIztro(
  chartData: Record<string, unknown>,
  targetYear: number,
  birthHour: number,
): IztroScopeItemData | null {
  const astrolabe = reconstructAstrolabe(chartData)
  if (!astrolabe) return null

  try {
    // 使用年中日期获取流年数据
    const targetDate = new Date(targetYear, 5, 15)
    const horoscope = astrolabe.horoscope(targetDate, birthHour)
    if (!horoscope) return null
    return horoscope.yearly
  } catch (err) {
    console.warn('[FortuneRunner] iztro horoscope 调用失败，降级自行推算:', err)
    return null
  }
}

/**
 * 计算方向矩阵
 *
 * 流年吉/凶 × 大限吉/凶
 * 判定标准：综合化禄+化权（吉）vs 化忌（凶）的加权计数
 * - 化禄: +2（滋养/机遇）
 * - 化权: +1（掌控/动力）
 * - 化科: +0.5（贵人/调和）
 * - 化忌: -2（消耗/执念）
 *
 * 修正：大限四化使用 SIHUA_TABLE 计算的正确数据，流年四化也只取天干四化
 */
export function calculateDirectionMatrix(
  daXianMapping: DaXianPalaceMapping | undefined,
  targetYear: number,
  natalCtx?: ScoringContext,
): DirectionMatrix {
  // 大限判定：四化加权计分
  let daXianScore = 0
  if (daXianMapping?.mutagen[0]) daXianScore += 2  // 化禄
  if (daXianMapping?.mutagen[1]) daXianScore += 1  // 化权
  if (daXianMapping?.mutagen[2]) daXianScore += 0.5 // 化科
  if (daXianMapping?.mutagen[3]) daXianScore -= 2  // 化忌

  // 若有原局上下文，检查大限四化星是否落入关键宫位（命宫/财帛/事业/夫妻）
  if (natalCtx && daXianMapping) {
    const keyPalaceIndices = [0, 4, 6, 8] // 命宫、官禄、迁移、财帛
    const weights = [2, 1, 0.5, -2]
    for (let i = 0; i < daXianMapping.mutagen.length && i < 4; i++) {
      const starName = daXianMapping.mutagen[i]
      if (!starName) continue
      for (const idx of keyPalaceIndices) {
        const palace = natalCtx.palaces[idx]
        if (palace?.stars.some(s => s.name === starName)) {
          daXianScore += weights[i] * 0.5 // 关键宫位加成
        }
      }
    }
  }

  const daXianDirection: '吉' | '凶' = daXianScore > 0 ? '吉' : (daXianScore < 0 ? '凶' : '吉')

  // 流年判定：只用流年天干四化，不含五虎遁宫干叠用
  const liuNianGan = GAN_TABLE[(targetYear - 4) % 10]
  const liuNianSihua = getSihuaTable()[liuNianGan]

  let liuNianScore = 0
  // 化禄
  if (liuNianSihua.禄) liuNianScore += 2
  // 化权
  if (liuNianSihua.权) liuNianScore += 1
  // 化科
  if (liuNianSihua.科) liuNianScore += 0.5
  // 化忌
  if (liuNianSihua.忌) liuNianScore -= 2

  const liuNianDirection: '吉' | '凶' = liuNianScore > 0 ? '吉' : (liuNianScore < 0 ? '凶' : '吉')

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

/**
 * 构建大限层
 *
 * 修正：offset 使用 PALACE_NAMES 序的 palaceIndex（命宫=0），
 * 不是 iztro 序（寅=0）。
 *
 * 大限层宫位映射规则：
 * - 大限[i] = natalCtx.palaces[(offset + i) % 12]
 * - 即从大限命宫位置开始，依次映射到原局宫位
 */
function buildDaXianLayer(mapping: DaXianPalaceMapping, natalCtx: ScoringContext): PalaceLayer {
  const gan = mapping.daXianGan

  // 大限四化（已从 getSihuaTable() 计算）
  const sihuaEntries: SihuaEntry[] = []
  if (mapping.mutagen[0]) sihuaEntries.push({ type: '化禄', star: mapping.mutagen[0] as MajorStar, source: '大限' })
  if (mapping.mutagen[1]) sihuaEntries.push({ type: '化权', star: mapping.mutagen[1] as MajorStar, source: '大限' })
  if (mapping.mutagen[2]) sihuaEntries.push({ type: '化科', star: mapping.mutagen[2] as MajorStar, source: '大限' })
  if (mapping.mutagen[3]) sihuaEntries.push({ type: '化忌', star: mapping.mutagen[3] as MajorStar, source: '大限' })

  // palaceIndex 是 PALACE_NAMES 序（命宫=0, 父母=1, ..., 兄弟=11）
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

/**
 * 构建流年层
 *
 * 修正：startIdx 通过匹配 diZhi 从 natalCtx.palaces 中查找，
 * 而非使用 DI_ZHI_ORDER.indexOf(zhi)（两者索引体系不同）。
 *
 * natalCtx.palaces 是 PALACE_NAMES 序（命宫=0, 父母=1, ...），
 * 而 DI_ZHI_ORDER 是地支序（子=0, 丑=1, ...），不能直接互换。
 */
function buildYearlyLayer(
  gan: TianGan,
  zhi: DiZhi,
  sihuaEntries: SihuaEntry[],
  natalCtx: ScoringContext,
): PalaceLayer {
  // 在 natalCtx.palaces 中找到地支匹配的宫位索引（PALACE_NAMES 序）
  const startIdx = natalCtx.palaces.findIndex(p => p.diZhi === zhi)
  if (startIdx < 0) {
    // 理论上不可能，安全回退
    return buildEmptyLayer('流年')
  }

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

/**
 * 为大限构建临时 ScoringContext，用于 M2 评分
 */
function buildDaXianScoringContext(mapping: DaXianPalaceMapping, natalCtx: ScoringContext): ScoringContext | null {
  if (!mapping.mutagen || mapping.mutagen.length < 4) return null

  // 深拷贝原局宫位
  const daXianPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  // 大限四化标注到宫位星曜
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
