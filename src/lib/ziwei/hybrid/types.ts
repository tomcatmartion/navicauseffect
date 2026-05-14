/**
 * 程序混合（Hybrid）— BaseIR / FinalIR / 会话持久化类型
 *
 * 对齐《最终方案》§3.10：ChartBridge → 确定性引擎 → Session → Prompt → AI
 */

import type { DiZhi, TianGan } from '@/core/types'
import { createInitialState, type SessionState } from '@/core/orchestrator/state-machine'
import type { Stage1Output, Stage2Output, Stage3Output, Stage4Output } from '@/core/types'
import type { ThreeLayerPalaceTable } from '@/core/types'

/** 单层宫位在 BaseIR 中的精简表示 */
export interface BaseIRPalace {
  name: string
  index: number
  diZhi: DiZhi
  tianGan?: TianGan
  majorStars: Array<{ name: string; brightness: string; mutagen?: string }>
  minorStars: Array<{ name: string; mutagen?: string }>
  adjectiveStars?: string[]
}

/** 太岁入卦等额外星曜标注（查表结果） */
export interface BaseIRExtraStar {
  star: string
  label: string
  /** 查表来源键（如流年地支） */
  sourceKey: string
}

/**
 * BaseIR：iztro 归一化后的「程序可读」原局 + 行运壳层
 * 不含评分结论（评分在 FinalIR）
 */
export interface BaseIR {
  version: 1
  solarDate: string
  gender: string
  birthGan: TianGan
  birthZhi: DiZhi
  mingGongZhi: DiZhi
  shenGongZhi: DiZhi
  taiSuiZhi: DiZhi
  fiveElementsClass: string
  skeletonId: string
  soulStar: string
  bodyStar: string
  palaces: BaseIRPalace[]
  /** 大限/流年干支摘要（来自 horoscope 或 chartData 嵌套，缺则空） */
  horoscope?: {
    decadal?: { gan?: TianGan; zhi?: DiZhi; label?: string }
    yearly?: { gan?: TianGan; zhi?: DiZhi; year?: number }
  }
  /** 太岁入卦等额外星曜 */
  extraStars: BaseIRExtraStar[]
  /** 三层宫位对照（至少原局层完整） */
  threeLayer: ThreeLayerPalaceTable
  /** 对方命盘注入时的 BaseIR（互动分析） */
  partnerBaseIR?: BaseIR
}

/** 格局 DSL 单条（与 patterns.json 对齐） */
export interface PatternRuleJson {
  id: string
  name: string
  level: string
  category?: string
  /** 递归条件：{ all: [...] } | { any: [...] } | { palace: n, hasMajor: "紫微" } 等 */
  when: Record<string, unknown>
}

/** 问诊 / 路由收集（memory_update 合并目标） */
export interface HybridCollected {
  /** 事项路由答案（简档） */
  eventAnswers: Record<string, unknown>
  /** 自由意图标签 */
  lastIntent?: string
  /** 最近一次解析到的 memory_update 原文 */
  lastMemoryPatch?: Record<string, unknown>
}

export interface HybridHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 持久化到 Redis + MySQL `hybrid_state` 的混合会话包
 * 不再使用进程内 Map 作为事实来源
 */
export interface HybridPersisted {
  version: 1
  /** 与现有四阶段编排兼容的状态机快照 */
  sessionState: SessionState
  /** 最多保留 6 条（3 轮 user+assistant），与方案 §3.9 对齐 */
  conversationHistory: HybridHistoryMessage[]
  /** Stage 输出 JSON 字符串（避免 Prisma Json 循环引用） */
  stage1Json?: string
  stage2Json?: string
  stage3Json?: string
  stage4Json?: string
  /** ChartBridge 缓存（可选，可由 chartData 重建） */
  baseIR?: BaseIR
  collected: HybridCollected
}

/**
 * 性格分析详细结构（Stage2 输出）
 */
export interface PersonalityAnalysis {
  /** 三宫概述 */
  overview: {
    mingGong: string
    shenGong: string
    taiSuiGong: string
    overallTone: string
  }
  /** 性格特质分层 */
  traits: {
    /** 表层特质（命宫）- 早年即凸显 */
    surface: string[]
    /** 中层特质（身宫）- 第三个大限后逐渐凸显 */
    middle: string[]
    /** 核心特质（太岁宫）- 关键利益时刻爆发 */
    core: string[]
  }
  /** 四维合参分析 */
  fourDimensions: {
    self: string
    opposite: string
    trine: string
    flanking: string
    synthesis: string
  }
  /** 全息底色 */
  holographicBase: {
    sihuaDirection: string
    auspiciousEffect: string
    inauspiciousEffect: string
    minorEffect: string
    summary: string
  }
  /** 格局影响 */
  patternInfluences: string[]
  /** 优势 */
  strengths: string[]
  /** 挑战 */
  weaknesses: string[]
  /** 发展建议 */
  advice: {
    overall: string
    career: string
    relationship: string
    health: string
  }
}

/** FinalIR：确定性引擎输出摘要（供 Prompt / 调试；完整对象仍用 Stage1/2） */
export interface FinalIR {
  version: 1
  /** 十二宫评分摘要 */
  palaceLines: string[]
  /** 格局列表 */
  patternSummary: string[]
  /** 四化与叠加摘要 */
  sihuaSummary: string[]
  /** 性格四维摘要（Stage2 后才有） */
  personalitySummary?: PersonalityAnalysis
}

export type { Stage1Output, Stage2Output, Stage3Output, Stage4Output }

export function parseHybridStage1(json: string | undefined): Stage1Output | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as Stage1Output
  } catch {
    return undefined
  }
}

export function parseHybridStage2(json: string | undefined): Stage2Output | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as Stage2Output
  } catch {
    return undefined
  }
}

export function parseHybridStage3(json: string | undefined): Stage3Output | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as Stage3Output
  } catch {
    return undefined
  }
}

export function parseHybridStage4(json: string | undefined): Stage4Output | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as Stage4Output
  } catch {
    return undefined
  }
}

export function createEmptyHybridPersisted(): HybridPersisted {
  return {
    version: 1,
    sessionState: createInitialState(),
    conversationHistory: [],
    collected: { eventAnswers: {} },
  }
}
