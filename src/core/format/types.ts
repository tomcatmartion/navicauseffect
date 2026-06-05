/**
 * 通用单人事项分析数据格式规范 — 类型定义
 *
 * 完全对齐《通用单人事项分析数据格式规范（支持多事项宫位）》文档。
 * 所有字段名、枚举值、嵌套结构与文档 JSON Schema 一致。
 */

import type { PalaceName, DiZhi, TianGan, MatterType } from '../types'

// ═══════════════════════════════════════════════════════════════════
// 宫位基础结构
// ═══════════════════════════════════════════════════════════════════

/** 宫位基础结构（适用于所有层级） */
export interface PalaceBaseSpec {
  /** 宫位名称（如"命宫"、"财帛宫"） */
  palaceName: PalaceName
  /** 地支 */
  earthlyBranch: DiZhi
  /** 天干 */
  heavenlyStem: TianGan
  /** 十四主星，多个用 + 连接，无则空字符串 */
  majorStars: string
  /** 所有辅星（乙丙级），多个用 + 连接，无则空字符串 */
  minorStars: string
  /** 四化描述（如"天同化禄"），无则为 null */
  sihua: string | null
  /** 该层级评分 0-10 */
  score: number
  /** "吉旺" / "平" / "凶弱" */
  level: PalaceLevel
  /** 仅大限/流年宫位：对应原局宫位名称 */
  originalPalace: PalaceName | null
  /** 仅流年宫位：对应大限宫位名称 */
  daXianPalace: PalaceName | null
}

/** 宫位等级 */
export type PalaceLevel = '吉旺' | '平' | '凶弱'

/** 三方四正结构 */
export interface ThreeQuadrantsSpec {
  /** 对宫 */
  opposite: PalaceBaseSpec
  /** 三合宫1 */
  firstTrine: PalaceBaseSpec
  /** 三合宫2 */
  secondTrine: PalaceBaseSpec
}

// ═══════════════════════════════════════════════════════════════════
// 四化条目
// ═══════════════════════════════════════════════════════════════════

/** 四化单条 */
export interface SihuaItemSpec {
  /** "禄" / "权" / "科" / "忌" */
  type: '禄' | '权' | '科' | '忌'
  /** 星曜名称 */
  star: string
  /** 落入宫位 */
  palace: PalaceName
}

// ═══════════════════════════════════════════════════════════════════
// 引动结构
// ═══════════════════════════════════════════════════════════════════

/** 引动条目 */
export interface TriggerItemSpec {
  type: '禄' | '权' | '科' | '忌'
  star: string
  sihuaPalace: PalaceName
  relation: '本宫' | '对宫' | '三合' | '双夹'
  effect: string
}

/** 引动分组（按事项宫位分组） */
export interface TriggerGroupSpec {
  /** 对应的事项宫位 */
  primaryPalace: PalaceName
  /** 是否被引动 */
  isTriggered: boolean
  /** 引动条目列表 */
  triggerItems: TriggerItemSpec[]
  /** 综合建议 */
  combinedAdvice: string
}

// ═══════════════════════════════════════════════════════════════════
// 重叠结构
// ═══════════════════════════════════════════════════════════════════

/** 宫位重叠 */
export interface OverlapSpec {
  primaryPalace: PalaceName
  affectedPalaces: PalaceName[]
  isDirect: boolean
}

// ═══════════════════════════════════════════════════════════════════
// 原局数据
// ═══════════════════════════════════════════════════════════════════

/** 原局事项宫位（含三方四正） */
export interface YuanJuPrimaryItem extends PalaceBaseSpec {
  /** 三方四正 */
  threeQuadrants: ThreeQuadrantsSpec
  /** 可选：该宫位在用户询问中的角色（如"投资理财"） */
  role?: string
}

/** 原局四化汇总 */
export interface SihuaSummarySpec {
  /** 生年四化 */
  shengNian: SihuaItemSpec[]
  /** 太岁宫宫干四化 */
  taiSui: SihuaItemSpec[]
}

/** 原局数据 */
export interface YuanJuSpec {
  /** 命宫（含三方四正） */
  ming: PalaceBaseSpec & { threeQuadrants: ThreeQuadrantsSpec }
  /** 事项宫位列表 */
  primary: YuanJuPrimaryItem[]
  /** 辅助宫位列表（不含三方四正） */
  secondary: PalaceBaseSpec[]
  /** 四化汇总 */
  sihuaSummary: SihuaSummarySpec
}

// ═══════════════════════════════════════════════════════════════════
// 大限数据
// ═══════════════════════════════════════════════════════════════════

/** 大限事项宫位 */
export interface DaXianPrimaryItem extends PalaceBaseSpec {
  /** 三方四正（大限独立评分） */
  threeQuadrants: ThreeQuadrantsSpec
  /** 对应原局事项宫位名称 */
  correspondingYuanJuPrimary: PalaceName
}

/** 大限数据 */
export interface DaXianSpec {
  /** 年龄范围（如"36-45"） */
  ageRange: string
  /** 大限命宫（含三方四正） */
  ming: PalaceBaseSpec & { threeQuadrants: ThreeQuadrantsSpec }
  /** 事项宫位列表 */
  primary: DaXianPrimaryItem[]
  /** 大限四化 */
  sihua: { list: SihuaItemSpec[] }
  /** 对原局事项宫位的引动信息 */
  triggersOnYuanJuPrimary: TriggerGroupSpec[]
}

// ═══════════════════════════════════════════════════════════════════
// 流年数据
// ═══════════════════════════════════════════════════════════════════

/** 流年事项宫位 */
export interface LiuNianPrimaryItem extends PalaceBaseSpec {
  /** 三方四正（流年独立评分） */
  threeQuadrants: ThreeQuadrantsSpec
  /** 对应大限事项宫位名称 */
  correspondingDaXianPrimary: PalaceName
  /** 对应原局事项宫位名称 */
  correspondingYuanJuPrimary: PalaceName
}

/** 流年数据 */
export interface LiuNianSpec {
  /** 流年 */
  year: number
  /** 流年命宫（含三方四正） */
  ming: PalaceBaseSpec & { threeQuadrants: ThreeQuadrantsSpec }
  /** 事项宫位列表 */
  primary: LiuNianPrimaryItem[]
  /** 流年四化 */
  sihua: { list: SihuaItemSpec[] }
  /** 禄存所在宫位 */
  luCun: { palace: string }
  /** 对大限事项宫位的引动信息 */
  triggersOnDaXianPrimary: TriggerGroupSpec[]
  /** 重叠检测 */
  overlap: OverlapSpec
}

// ═══════════════════════════════════════════════════════════════════
// 顶层输出
// ═══════════════════════════════════════════════════════════════════

/** 分析模式 */
export type AnalysisMode = '已发生' | '未发生'

/** 通用单人事项分析完整输出 */
export interface MatterAnalysisSpec {
  /** 事项类型 */
  matterType: MatterType
  /** 分析模式 */
  mode: AnalysisMode
  /** 分析年份 */
  targetYear: number
  /** 系统当前年份 */
  currentYear: number
  /** 综合得分 0-10（仅未发生模式） */
  compositeScore: number | null
  /** 档位标签（仅未发生模式） */
  scoreLabel: string | null
  /** 原局数据 */
  yuanJu: YuanJuSpec
  /** 大限数据 */
  daXian: DaXianSpec
  /** 流年数据 */
  liuNian: LiuNianSpec
}
