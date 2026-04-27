/**
 * RAG 精准召回 — 类型定义与 Zod Schema
 *
 * 核心数据结构：四步流水线（意图路由 → 要素提取 → 精准召回 → 上下文组装）
 */

import { z } from 'zod'

// ── 四化事件 ────────────────────────────────────────────

export interface SihuaEvent {
  star: string               // "天机"
  type: '化禄' | '化权' | '化科' | '化忌'
  palace: string             // "官禄宫"
  source: '本命' | '大限' | '流年'
}

// ── 意图路由结果 ─────────────────────────────────────────

export interface ReadingDomain {
  domains: string[]          // ["财运", "事业"]
  timeScope: '本命' | '大限' | '流年' | '流月'
}

// ── 命盘要素提取结果（Step 2 输出）─────────────────────────

export interface ReadingElements {
  palaces: string[]          // ["官禄宫", "财帛宫"]
  stars: string[]            // ["天机", "太阴"]
  sihua: SihuaEvent[]
  patterns: string[]         // ["机月同梁格"]
  timeScope: string
  analysisPoints: string[]   // AI 提取的关键解盘点
}

// ── 知识块（Step 3 输出）──────────────────────────────────

export interface KnowledgeChunk {
  id: number
  title: string
  content: string
  stars: string[]
  palaces: string[]
  sihua: string[]
  domains: string[]
  patterns: string[]
  topicType: string
  timeScope: string
  priority: number
  score?: number             // 召回相关性得分（精确=1.0，向量<1.0）
}

// ── 会话轮次 ────────────────────────────────────────────

export interface ConversationTurn {
  userQuestion: string
  domain: ReadingDomain
  elements: ReadingElements
  /** 助手回复摘要（截断到前 500 字，不存全文） */
  assistantReply: string
  timestamp: number
}

// ── 会话数据 ────────────────────────────────────────────

export interface ZiweiSessionData {
  sessionId: string
  userId: string
  chartData: Record<string, unknown>   // iztro 命盘 JSON
  chartSummary: string                 // 命盘文字摘要
  turns: ConversationTurn[]
  currentDomain: string
  turnCount: number
  createdAt: number
  expiresAt: number
}

// ── 流水线参数与结果 ─────────────────────────────────────

export interface PipelineParams {
  sessionId: string
  userId: string
  question: string
  chartData?: Record<string, unknown>  // 首次传入命盘，后续从 session 取
}

export interface PipelineResult {
  reply: string
  elements: ReadingElements
  sessionId: string
}

// ── Zod Schema（用于 Step 2 LLM 输出校验）──────────────────

export const SihuaEventSchema = z.object({
  star: z.string().min(1),
  type: z.enum(['化禄', '化权', '化科', '化忌']),
  palace: z.string().min(1),
  source: z.enum(['本命', '大限', '流年']),
})

export const ReadingElementsSchema = z.object({
  palaces: z.array(z.string()),
  stars: z.array(z.string()),
  sihua: z.array(SihuaEventSchema),
  patterns: z.array(z.string()),
  timeScope: z.string(),
  analysisPoints: z.array(z.string()),
})

// ── API 请求体 Schema ───────────────────────────────────

export const ReadingRequestSchema = z.object({
  sessionId: z.string().optional(),
  question: z.string().min(1).max(500),
  chartData: z.record(z.string(), z.unknown()).optional(),
})
