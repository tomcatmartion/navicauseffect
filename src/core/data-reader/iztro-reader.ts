/**
 * iztro 数据统一读取器
 *
 * 从前端 chartData 或直接调用 iztro 排盘，输出完整的 NormalizedChart。
 * 严格对接 iztro API，确保所有数据（十二宫星曜、身宫、太岁宫、四化、大限）100%读取。
 *
 * 关键修正：
 * 1. 太岁宫地支 = 生年地支（出生年的地支），独立于命宫位置
 *    来源：SKILL_宫位原生能级评估 "命主生年地支 = 太岁宫"
 *    注意：SKILL_原局四化读取规则中 earthlyBranchOfSoulPalace 的标注是错误的字段映射
 * 2. 每宫必须读取 adjectiveStars（丙丁级星曜）
 * 3. 宫位按 PALACE_NAMES 顺序重排（iztro 从寅宫开始）
 */

import 'server-only'

import type { TianGan, DiZhi, PalaceBrightness, MajorStar, AuspiciousStar, InauspiciousStar, MinorStar } from '../types'
import { PALACE_NAMES } from '../types'
import type {
  NormalizedChart, NormalizedPalace,
  IztroChartDataInput, IztroPalace, IztroStar,
  IztroBrightness,
} from './types-iztro'
import { STANDARD_DI_ZHI_ORDER } from './types-iztro'
import { classifyStar } from './star-classifier'

/** 十天干 */
const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

/** 十二地支（标准顺序） */
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// ═══════════════════════════════════════════════════════════════════
// 亮度转换
// ═══════════════════════════════════════════════════════════════════

/**
 * iztro 亮度 → 系统旺弱等级
 *
 * SKILL_宫位原生能级评估 定义：
 * 极旺/旺 = 正面发挥
 * 平 = 中性
 * 陷/极弱 = 负面放大
 * 空 = 无主星
 */
function convertBrightness(raw: IztroBrightness | undefined): PalaceBrightness {
  if (raw === undefined || raw === '') return '平'
  const map: Record<string, PalaceBrightness> = {
    '庙': '极旺',
    '旺': '旺',
    '得': '平',
    '利': '平',
    '平': '平',
    '不': '陷',
    '陷': '极弱',
  }
  return map[raw] ?? '平'
}

// ═══════════════════════════════════════════════════════════════════
// 出生信息提取
// ═══════════════════════════════════════════════════════════════════

/** 从公历日期提取天干 */
export function extractBirthGan(dateStr: string): TianGan {
  const yearMatch = dateStr.match(/(\d{4})/)
  if (!yearMatch) return '甲'
  const year = parseInt(yearMatch[1], 10)
  return GAN_TABLE[(year - 4) % 10]
}

/** 从公历日期提取地支 */
function extractBirthZhi(dateStr: string): DiZhi {
  const yearMatch = dateStr.match(/(\d{4})/)
  if (!yearMatch) return '子'
  const year = parseInt(yearMatch[1], 10)
  return DI_ZHI_ORDER[(year - 4) % 12]
}

// ═══════════════════════════════════════════════════════════════════
// 核心读取：从前端 chartData 提取完整命盘
// ═══════════════════════════════════════════════════════════════════

/**
 * 从前端传入的 chartData 读取并标准化命盘
 *
 * 关键步骤：
 * 1. 提取出生信息（公历日期→天干地支）
 * 2. 读取 earthlyBranchOfSoulPalace（命宫地支 = 太岁宫地支）
 * 3. 读取 earthlyBranchOfBodyPalace（身宫地支）
 * 4. 遍历12宫，提取 majorStars + minorStars + adjectiveStars
 * 5. 按 PALACE_NAMES 顺序重排宫位
 * 6. 计算骨架序号（紫微星位置→P01-P12）
 *
 * @param chartData 前端传入的命盘 JSON
 * @returns 标准化后的命盘数据
 */
export function readChartFromData(chartData: Record<string, unknown>): NormalizedChart {
  const data = chartData as IztroChartDataInput

  // 1. 提取出生信息
  let solarDate = data.solarDate ?? ''
  if (!solarDate && data.birthInfo) {
    const bi = data.birthInfo
    if (bi.year && bi.month && bi.day) {
      solarDate = `${bi.year}-${String(bi.month).padStart(2, '0')}-${String(bi.day).padStart(2, '0')}`
    }
  }

  // 优先从 iztro 提供的 chineseDate / rawDates 读取生年干支（更准确，已处理农历跨年）
  let birthGan: TianGan = extractBirthGan(solarDate)
  let birthZhi: DiZhi = extractBirthZhi(solarDate)

  // iztro 的 rawDates.chineseDate.yearly = [天干, 地支]
  const rawChinese = (data as any).rawDates?.chineseDate
  if (rawChinese?.yearly && Array.isArray(rawChinese.yearly) && rawChinese.yearly.length === 2) {
    const [gan, zhi] = rawChinese.yearly
    if (GAN_TABLE.includes(gan as TianGan)) birthGan = gan as TianGan
    if (DI_ZHI_ORDER.includes(zhi as DiZhi)) birthZhi = zhi as DiZhi
  } else if (data.chineseDate && typeof data.chineseDate === 'string') {
    // 回退：从 chineseDate 字符串解析，如 "庚午 壬午 辛亥 甲午"
    const match = data.chineseDate.match(/^([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/)
    if (match) {
      birthGan = match[1] as TianGan
      birthZhi = match[2] as DiZhi
    }
  }

  // 2. 太岁宫地支 = 生年地支（独立于命宫位置）
  //    SKILL_宫位原生能级评估："命主生年地支 = 太岁宫"
  //    太岁宫是紫微斗数中独立的宫位概念，等于出生年的地支对应的宫位
  //    注意：SKILL_原局四化读取规则标注 earthlyBranchOfSoulPalace 是错误的字段映射
  const taiSuiZhi = birthZhi

  // 3. 身宫地支 = earthlyBranchOfBodyPalace
  const shenGongZhi = (data.earthlyBranchOfBodyPalace ?? '寅') as DiZhi

  // 4. 命宫地支 = earthlyBranchOfSoulPalace
  const mingGongZhi = (data.earthlyBranchOfSoulPalace ?? '寅') as DiZhi

  // 5. 遍历原始12宫数据
  const rawPalaces = data.palaces ?? []

  // 建立 palace.name → 原始索引的映射
  const nameToRawPalace = new Map<string, IztroPalace>()
  for (const p of rawPalaces) {
    nameToRawPalace.set(p.name, p as IztroPalace)
  }

  // 6. 找到紫微星所在的地支 → 确定骨架序号
  let ziweiDiZhi: DiZhi = '子'
  for (const p of rawPalaces) {
    const palace = p as IztroPalace
    const majorStars = palace.majorStars ?? []
    if (majorStars.some(ms => ms.name === '紫微')) {
      ziweiDiZhi = (palace.earthlyBranch as DiZhi) ?? '子'
      break
    }
  }
  // 骨架序号：紫微所在地支在标准地支顺序中的位置 + 1
  const skeletonId = `P${String(DI_ZHI_ORDER.indexOf(ziweiDiZhi) + 1).padStart(2, '0')}`

  // 7. 按 PALACE_NAMES 顺序重排宫位
  const palaces: NormalizedPalace[] = PALACE_NAMES.map((palaceName) => {
    const rawPalace = nameToRawPalace.get(palaceName)
    return normalizePalace(rawPalace, palaceName)
  })

  return {
    birthGan,
    birthZhi,
    mingGongZhi,
    shenGongZhi,
    taiSuiZhi,
    soulStar: data.soul ?? '',
    bodyStar: data.body ?? '',
    fiveElementsClass: data.fiveElementsClass ?? '',
    skeletonId,
    palaces,
    solarDate,
    gender: data.gender ?? '',
  }
}

// ═══════════════════════════════════════════════════════════════════
// 单宫标准化
// ═══════════════════════════════════════════════════════════════════

/**
 * 将单个 iztro 宫位标准化
 *
 * 必须读取：majorStars + minorStars + adjectiveStars
 * 然后按星曜分类器归入对应的数组
 */
function normalizePalace(raw: IztroPalace | undefined, palaceName: string): NormalizedPalace {
  if (!raw) {
    // 无数据时返回空宫
    return {
      name: palaceName,
      diZhi: '子',
      tianGan: '甲',
      majorStars: [],
      auspiciousStars: [],
      inauspiciousStars: [],
      hasLuCun: false,
      minorStars: [],
      sihuaAnnotations: [],
      isEmpty: true,
      isBodyPalace: false,
      decadal: null,
    }
  }

  // 收集所有星曜
  const allStars: IztroStar[] = [
    ...(raw.majorStars ?? []),
    ...(raw.minorStars ?? []),
    ...(raw.adjectiveStars ?? []),
  ]

  // 按分类器归入各类别
  const majorStars: NormalizedPalace['majorStars'] = []
  const auspiciousStars: NormalizedPalace['auspiciousStars'] = []
  const inauspiciousStars: NormalizedPalace['inauspiciousStars'] = []
  const minorStars: NormalizedPalace['minorStars'] = []
  const sihuaAnnotations: NormalizedPalace['sihuaAnnotations'] = []
  let hasLuCun = false

  for (const star of allStars) {
    const classification = classifyStar(star.name)

    switch (classification) {
      case 'major':
        majorStars.push({
          star: star.name as MajorStar,
          brightness: convertBrightness(star.brightness),
          mutagen: star.mutagen,
        })
        break
      case 'auspicious':
        auspiciousStars.push(star.name as AuspiciousStar)
        break
      case 'inauspicious':
        inauspiciousStars.push(star.name as InauspiciousStar)
        break
      case 'lucun':
        hasLuCun = true
        break
      case 'minor':
        minorStars.push(star.name as MinorStar)
        break
      // 'other' 类型忽略
    }

    // 收集四化标注
    if (star.mutagen) {
      sihuaAnnotations.push({
        star: star.name,
        type: star.mutagen,
        source: '生年', // 临时标注，后续由 applyPalaceAnnotations 修正
      })
    }
  }

  // 大限信息（palace.decadal 只有 range/heavenlyStem/earthlyBranch）
  const dec = raw.decadal
  let decadal: NormalizedPalace['decadal'] = null
  if (dec && dec.range) {
    decadal = {
      ageRange: dec.range,
      heavenlyStem: dec.heavenlyStem ?? raw.heavenlyStem,
      earthlyBranch: dec.earthlyBranch ?? raw.earthlyBranch,
    }
  }

  return {
    name: palaceName,
    diZhi: raw.earthlyBranch as DiZhi,
    tianGan: raw.heavenlyStem as TianGan,
    majorStars,
    auspiciousStars,
    inauspiciousStars,
    hasLuCun,
    minorStars,
    sihuaAnnotations,
    isEmpty: majorStars.length === 0,
    isBodyPalace: raw.isBodyPalace ?? false,
    decadal,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 重写 chart-converter 兼容层
// ═══════════════════════════════════════════════════════════════════

/**
 * 兼容层：从 NormalizedChart 构建 ScoringContext
 *
 * 供旧代码平滑迁移使用，最终应直接使用 NormalizedChart。
 */
export function normalizedChartToScoringContext(
  chart: NormalizedChart,
): import('../energy-evaluator/scoring-flow').ScoringContext {
  const { palaces } = chart

  // 找到身宫在 PALACE_NAMES 中的索引
  let shenGongIndex = 6 // 默认对宫
  for (let i = 0; i < palaces.length; i++) {
    if (palaces[i].isBodyPalace) {
      shenGongIndex = i
      break
    }
  }

  return {
    skeletonId: chart.skeletonId,
    palaces: palaces.map((p, idx) => ({
      palaceIndex: idx,
      diZhi: p.diZhi,
      brightness: p.majorStars.length > 0 ? p.majorStars[0].brightness : '空',
      majorStars: p.majorStars.map(ms => ({ star: ms.star, brightness: ms.brightness })),
      stars: [
        ...p.majorStars.map(ms => ({
          name: ms.star,
          sihua: ms.mutagen as '化禄' | '化权' | '化科' | '化忌' | undefined,
          sihuaSource: ms.mutagen ? '生年' as const : undefined,
        })),
        ...p.auspiciousStars.map(s => ({ name: s, sihua: undefined as undefined, sihuaSource: undefined as undefined })),
        ...p.inauspiciousStars.map(s => ({ name: s, sihua: undefined as undefined, sihuaSource: undefined as undefined })),
        ...(p.hasLuCun ? [{ name: '禄存' as const, sihua: undefined as undefined, sihuaSource: undefined as undefined }] : []),
        ...p.minorStars.map(s => ({ name: s, sihua: undefined as undefined, sihuaSource: undefined as undefined })),
      ],
      hasLuCun: p.hasLuCun,
    })),
    birthGan: chart.birthGan,
    taiSuiZhi: chart.taiSuiZhi,  // 正确：= 生年地支 (birthZhi)
    shenGongIndex,
    patterns: [],
  }
}
