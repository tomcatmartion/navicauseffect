/**
 * M6: 知识字典 — 类型定义
 */

// ═══════════════════════════════════════════════════════════════════
// 宫位系统类型（palace_system.json）
// ═══════════════════════════════════════════════════════════════════

/** 宫位含义数据 */
export interface PalaceMeaning {
  meaning: string
  domains: string[]
  modernContext: string
}

/** 骨架中单个宫位的数据 */
export interface SkeletonPalaceEntry {
  /** 主星（空字符串表示无主星/空宫） */
  major: string
  /** 旺弱等级 */
  brightness: string
}

/**
 * 宫位系统配置（palace_system.json）
 *
 * 包含宫位含义与骨架亮度映射
 */
export interface PalaceSystem {
  version: string
  description: string
  宫位含义: Record<string, PalaceMeaning>
  宫位骨架亮度映射: Record<string, Record<string, SkeletonPalaceEntry>>
}

// ═══════════════════════════════════════════════════════════════════

export interface StarAttribute {
  element: string
  coreTrait: string
  positiveTrait: string
  negativeTrait: string
  specialNote: string
}

export interface EventStarTraitMap {
  [brightness: string]: string
}

export interface EventStarPalaceMap {
  [star: string]: EventStarTraitMap
}

export interface EventPalaceMap {
  [palace: string]: EventStarPalaceMap
}

export interface EventStarAttributes {
  [event: string]: EventPalaceMap
}

export interface ShengNianSihua {
  lu: string
  quan: string
  ke: string
  ji: string
}

export interface LuCunYangTuo {
  luCun: string
  qingYang: string
  tuoLuo: string
}

export interface TianKuiYue {
  tianKui: string
  tianYue: string
}

export interface HongLuanTianXi {
  hongLuan: string
  tianXi: string
}

export interface TaiSuiTables {
  shengNianSihua: Record<string, ShengNianSihua>
  luCunYangTuo: Record<string, LuCunYangTuo>
  tianKuiYue: Record<string, TianKuiYue>
  hongLuanTianXi: Record<string, HongLuanTianXi>
  wuHuDunGan: Record<string, string[]>
}

export interface BrightnessConfig {
  base: number
  ceiling: number
}

export interface CriticalThreshold {
  min: number
  max: number
  brightness: string[]
}

export interface AbsoluteFailException {
  description: string
  majorStar: string[]
  condition: string
}

export interface AbsoluteFailCondition {
  description: string
  requires?: string[]
  scope: string
  exceptions?: AbsoluteFailException[]
  jiCountThreshold?: number
}

export interface ParentPenalty {
  fatherShengNianJi: number
  fatherDunGanJi: number
  motherShengNianJi: number
  motherDunGanJi: number
}

/** 格局倍率条目（V3.1：从数字升级为对象） */
export interface PatternMultiplierEntry {
  multiplier: number
  scope: string
}

/** 夹宫有效组合 */
export interface JiagongValidPair {
  name: string
  left: string
  right: string
  type: string
  /** 四化夹是否要求同源（命主：生年+遁干算同源） */
  sameSourceRequired?: boolean
  note?: string
}

/** 四化来源条目 */
export interface SihuaSourceEntry {
  name: string
  weight: number
  note: string
  mustCalculate: boolean
  conditional?: string
}

export interface ScoringParams {
  brightnessMap: Record<string, BrightnessConfig>
  initialBaseByBrightness: Record<string, number>
  ceilingByBrightness: Record<string, number>
  subdueLevel: {
    strong: string[]
    medium: string[]
    weak: string[]
  }
  parentSihuaDiscount: number
  jiStarScore: number
  shaStarScore: number
  recordOnlySihua: string[]
  jiStarNames: string[]
  shaStarNames: string[]
  /** V3.1: 值为 { multiplier, scope } 对象 */
  patternMultiplierMap: Record<string, PatternMultiplierEntry>
  patternScopeDescription: Record<string, string>
  dunGanLuBonus: number
  dunGanJiPenalty: number
  dunGanDecay: number
  warmCoolThresholds: Record<string, number>
  toneThresholds: Record<string, number>
  criticalThresholds: Record<string, CriticalThreshold>
  absoluteFailRules: Record<string, AbsoluteFailCondition>
  parentPenalty: ParentPenalty
  sihuaSourcesPriority: {
    description: string
    sources: SihuaSourceEntry[]
    rule: string
  }
  jiagongValidPairs: {
    description: string
    pairs: JiagongValidPair[]
  }
  jiagongInvalidConditions: {
    description: string
    conditions: string[]
  }
  jiagongDecayMatrix: Record<string, Record<string, number>>
  fixedDecay: {
    opposite: number
    trine: number
  }
  luCunDelta: Record<string, number>
  /** 化权加分值 */
  quanScore: number
  /** 化科加分值 */
  keScore: number
  /** 化禄加分值 */
  luScore: number
  /** 化忌减分值 */
  jiScore: number
}
