/**
 * iztro 库完整类型定义
 *
 * 精确映射 iztro FunctionalAstrolabe / FunctionalHoroscope 的数据结构，
 * 确保从 iztro 读取的数据全程类型安全。
 *
 * 关键理解：
 * - iztro palaces 数组从寅宫开始（index=0=寅, 1=卯, ..., 11=丑）
 * - earthlyBranchOfSoulPalace = 命宫地支
 * - earthlyBranchOfBodyPalace = 身宫地支
 * - 太岁宫地支 = 生年地支（出生年的地支，独立于命宫位置）
 */

// ═══════════════════════════════════════════════════════════════════
// 基础常量类型
// ═══════════════════════════════════════════════════════════════════

/** 十二地支（iztro 宫位从此顺序排列，但起始为寅） */
export const IZTRO_DI_ZHI_ORDER = [
  '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑',
] as const

/** 标准地支顺序（子→亥） */
export const STANDARD_DI_ZHI_ORDER = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
] as const

/** 十天干 */
export const TIAN_GAN_ORDER = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
] as const

// ═══════════════════════════════════════════════════════════════════
// iztro 星曜类型
// ═══════════════════════════════════════════════════════════════════

/** iztro 星曜亮度 */
export type IztroBrightness = '庙' | '旺' | '得' | '利' | '平' | '不' | '陷' | ''

/** iztro 四化类型 */
export type IztroMutagen = '化禄' | '化权' | '化科' | '化忌' | undefined

/** iztro 星曜数据 */
export interface IztroStar {
  /** 星曜名称 */
  name: string
  /** 星曜类型：major/minor/adjective */
  type: string
  /** 亮度：庙/旺/得/利/平/不/陷 */
  brightness: IztroBrightness
  /** 四化标注（如有） */
  mutagen?: IztroMutagen
}

// ═══════════════════════════════════════════════════════════════════
// iztro 宫位类型
// ═══════════════════════════════════════════════════════════════════

/** iztro 大限数据（palace.decadal 字段） */
export interface IztroDecadal {
  /** 年龄范围 [起始, 结束] */
  range: [number, number]
  /** 大限天干 */
  heavenlyStem: string
  /** 大限地支 */
  earthlyBranch: string
}


/** iztro 单个宫位数据 */
export interface IztroPalace {
  /** 宫位索引（0-11，从寅宫开始） */
  index: number
  /** 宫位名称 */
  name: string
  /** 是否为身宫 */
  isBodyPalace: boolean
  /** 宫位天干 */
  heavenlyStem: string
  /** 宫位地支 */
  earthlyBranch: string
  /** 主星数组 */
  majorStars: IztroStar[]
  /** 辅星数组（含六吉、六煞、禄存等） */
  minorStars: IztroStar[]
  /** 杂耀数组（丙丁级：红鸾、天喜、华盖、天刑等） */
  adjectiveStars: IztroStar[]
  /** 大限数据 */
  decadal: IztroDecadal
}

// ═══════════════════════════════════════════════════════════════════
// iztro 命盘类型
// ═══════════════════════════════════════════════════════════════════

/** iztro 完整命盘数据 */
export interface IztroAstrolabe {
  /** 十二宫数据（从寅宫 index=0 开始） */
  palaces: IztroPalace[]
  /** 命宫地支（太岁宫 ≠ 此字段，太岁宫 = 生年地支） */
  earthlyBranchOfSoulPalace: string
  /** 身宫地支 */
  earthlyBranchOfBodyPalace: string
  /** 命主星名 */
  soul: string
  /** 身主星名 */
  body: string
  /** 五行局名 */
  fiveElementsClass: string
  /** 性别 */
  gender: string
  /** 公历日期 */
  solarDate: string
  /** 农历日期 */
  lunarDate: string
  /** 干支日期 */
  chineseDate: string
  /** 时辰 */
  time: string
  /** 生肖 */
  zodiac: string
  /** 星座 */
  sign: string
}

// ═══════════════════════════════════════════════════════════════════
// iztro 运限类型
// ═══════════════════════════════════════════════════════════════════

/** iztro 运限单项 */
export interface IztroHoroscopeItem {
  /** 宫位索引 */
  index: number
  /** 运限名称 */
  name: string
  /** 天干 */
  heavenlyStem: string
  /** 地支 */
  earthlyBranch: string
  /** 十二宫名数组 */
  palaceNames: string[]
  /** 四化星名数组 */
  mutagen: string[]
}

/** iztro 小限（含虚岁） */
export interface IztroAgeItem extends IztroHoroscopeItem {
  /** 虚岁 */
  nominalAge: number
}

/** iztro 流年（含流年星曜） */
export interface IztroYearlyItem extends IztroHoroscopeItem {
  /** 流年星曜 */
  yearlyDecStar: {
    jiangqian12: string[]
    suiqian12: string[]
  }
}

/** iztro 运限完整数据 */
export interface IztroHoroscope {
  /** 大限 */
  decadal: IztroHoroscopeItem
  /** 流年 */
  yearly: IztroYearlyItem
  /** 小限 */
  age: IztroAgeItem
  /** 流月 */
  monthly: IztroHoroscopeItem
  /** 流日 */
  daily: IztroHoroscopeItem
  /** 流时 */
  hourly: IztroHoroscopeItem
}

// ═══════════════════════════════════════════════════════════════════
// 前端传入的 chartData 类型
// ═══════════════════════════════════════════════════════════════════

/** 前端 chartData 中可能包含的出生信息 */
export interface BirthInfoFromChart {
  year: number
  month: number
  day: number
  hour: number
  gender: string
}

/** 前端传入的 chartData 结构（宽松，需校验后使用） */
export interface IztroChartDataInput {
  /** iztro 排盘后的完整命盘 JSON */
  palaces?: IztroPalace[]
  /** 公历日期 */
  solarDate?: string
  /** 性别 */
  gender?: string
  /** 命宫地支 */
  earthlyBranchOfSoulPalace?: string
  /** 身宫地支 */
  earthlyBranchOfBodyPalace?: string
  /** 命主星 */
  soul?: string
  /** 身主星 */
  body?: string
  /** 五行局 */
  fiveElementsClass?: string
  /** 农历日期 */
  lunarDate?: string
  /** 干支日期 */
  chineseDate?: string
  /** 原始日期数据（iztro rawDates） */
  rawDates?: {
    chineseDate?: {
      yearly?: [string, string]
      monthly?: [string, string]
      daily?: [string, string]
      hourly?: [string, string]
    }
  }
  /** 出生信息（旧版前端可能使用此格式） */
  birthInfo?: BirthInfoFromChart
  /** 其他字段 */
  [key: string]: unknown
}

// ═══════════════════════════════════════════════════════════════════
// 标准化后的命盘数据
// ═══════════════════════════════════════════════════════════════════

import type { TianGan, DiZhi, PalaceBrightness, MajorStar, AuspiciousStar, InauspiciousStar, MinorStar } from '../types'

/** 标准化后的单宫数据 */
export interface NormalizedPalace {
  /** 宫位名称（PALACE_NAMES 顺序） */
  name: string
  /** 宫位地支 */
  diZhi: DiZhi
  /** 宫位天干 */
  tianGan: TianGan
  /** 主星（含亮度） */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness; mutagen?: string }>
  /** 六吉星 */
  auspiciousStars: Array<AuspiciousStar>
  /** 六煞星 */
  inauspiciousStars: Array<InauspiciousStar>
  /** 禄存 */
  hasLuCun: boolean
  /** 丙丁级星曜 */
  minorStars: Array<MinorStar>
  /** 四化标注（落入本宫的四化） */
  sihuaAnnotations: Array<{ star: string; type: string; source: string }>
  /** 是否空宫 */
  isEmpty: boolean
  /** 是否身宫 */
  isBodyPalace: boolean
  /** 大限信息 */
  decadal: {
    ageRange: [number, number]
    heavenlyStem: string
    earthlyBranch: string
  } | null
}

/** 标准化后的完整命盘 */
export interface NormalizedChart {
  /** 命主生年天干 */
  birthGan: TianGan
  /** 命主生年地支 */
  birthZhi: DiZhi
  /** 命宫地支 (= earthlyBranchOfSoulPalace) */
  mingGongZhi: DiZhi
  /** 身宫地支 (= earthlyBranchOfBodyPalace) */
  shenGongZhi: DiZhi
  /** 太岁宫地支 (= 生年地支，独立于命宫位置) */
  taiSuiZhi: DiZhi
  /** 命主星 */
  soulStar: string
  /** 身主星 */
  bodyStar: string
  /** 五行局 */
  fiveElementsClass: string
  /** 骨架序号 (P01-P12) */
  skeletonId: string
  /** 十二宫数据（按 PALACE_NAMES 顺序） */
  palaces: NormalizedPalace[]
  /** 公历日期 */
  solarDate: string
  /** 性别 */
  gender: string
}
