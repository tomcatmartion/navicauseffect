/**
 * 紫微 Hybrid 解盘 — 会话与 API 类型
 */

import { z } from 'zod'
import type { SessionPersisted } from '@/core/adapters/iztro/types'

export interface SihuaEvent {
  star: string
  type: '化禄' | '化权' | '化科' | '化忌'
  palace: string
  source: '本命' | '大限' | '流年'
}

export interface ReadingDomain {
  domains: string[]
  timeScope: '本命' | '大限' | '流年' | '流月'
}

export interface ReadingElements {
  palaces: string[]
  stars: string[]
  sihua: SihuaEvent[]
  patterns: string[]
  timeScope: string
  analysisPoints: string[]
}

export interface ConversationTurn {
  userQuestion: string
  domain: ReadingDomain
  elements: ReadingElements
  assistantReply: string
  timestamp: number
}

export interface ZiweiSessionData {
  sessionId: string
  userId: string
  chartData: Record<string, unknown>
  chartSummary: string
  turns: ConversationTurn[]
  currentDomain: string
  turnCount: number
  createdAt: number
  expiresAt: number
  stageCache?: {
    stage1?: string
    stage2?: string
  }
  hybridPersisted?: SessionPersisted
}

export const ReadingRequestSchema = z.object({
  sessionId: z.string().optional(),
  question: z.string().min(1).max(500),
  chartData: z.object({
    palaces: z.array(z.record(z.string(), z.unknown())).min(12),
    birthInfo: z.record(z.string(), z.unknown()).optional(),
    horoscope: z.record(z.string(), z.unknown()).optional(),
  }).passthrough().optional(),
  parentBirthYears: z.object({
    father: z.number().int().min(1900).max(2100).optional(),
    mother: z.number().int().min(1900).max(2100).optional(),
  }).optional(),
  targetYear: z.number().int().min(1900).max(2100).optional(),
  routingAnswers: z.record(z.string(), z.string()).optional(),
})
