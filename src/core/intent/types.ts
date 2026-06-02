/**
 * 意图分类器 — 类型定义
 *
 * 自由对话模式下的用户意图识别，用于在程序计算和 LLM 之间切换
 */

import type { MatterType } from '../types'

/** 意图动作类型 */
export type IntentAction =
  | 'NEW_MATTER'     // 新事项 → 运行 Stage3
  | 'RE_CALC'        // 年份变更 → 重跑 Stage3
  | 'FOLLOW_UP'      // 追问 → 用缓存 IR 继续
  | 'CHITCHAT'       // 闲聊 → 纯 LLM
  | 'REPORT'         // 生成报告 → 程序编译 + LLM 润色
  | 'INTERACTION'    // 互动关系 → 运行 Stage4

/** 分类结果 */
export interface IntentResult {
  action: IntentAction
  /** 事项类型（NEW_MATTER / RE_CALC / INTERACTION 时有值） */
  matterType?: MatterType
  /** 目标年份（RE_CALC 时有值） */
  targetYear?: number
  /** 对方出生年份（INTERACTION 时有值） */
  partnerBirthYear?: number
}

/** 分类上下文（从会话状态提取） */
export interface IntentContext {
  /** 当前活跃事项 key（如 '求财'） */
  currentMatterKey: string | null
  /** 当前活跃事项的查询年份 */
  currentQueryYear: number | null
  /** 已分析过的所有事项 key 集合 */
  knownMatterKeys: string[]
  /** 最近几条对话（用于上下文判断） */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  /** 是否已初始化（Stage1+2 完成） */
  initialized: boolean
}

/** 事项记录（简化版，用于分类上下文） */
export interface MatterRecord {
  matterType: MatterType
  queryYear: number
  /** 序列化的 Stage3Output */
  stage3Json: string
  /** 最近 AI 回复摘要（前 200 字） */
  lastAiSummary: string
  /** 该事项被分析了几轮 */
  turnCount: number
  /** 最后分析时间戳 */
  lastAnalyzedAt: number
}
