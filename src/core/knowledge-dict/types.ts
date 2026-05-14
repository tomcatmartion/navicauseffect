/**
 * M6: 知识字典 — 类型定义
 */

export interface StarAttribute {
  element: string
  coreTrait: string
  positiveTrait: string
  negativeTrait: string
  specialNote: string
}

export interface PalaceMeaning {
  meaning: string
  domains: string[]
  modernContext: string
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

export interface AstroRules {
  auspiciousStars: string[]
  inauspiciousStars: string[]
  subdueLevels: {
    strong: string[]
    medium: string[]
    weak: string[]
  }
  flankingDecay: Record<string, Record<string, number>>
  fixedDecay: {
    opposite: number
    trine: number
  }
  luCunDelta: Record<string, number>
  auspiciousScore: number
  inauspiciousScore: number
}
