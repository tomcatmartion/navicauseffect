/**
 * 紫微斗数解盘引擎
 *
 * 程序混合（Hybrid）：确定性 Stage1–4 + LLM 表达
 * - 编排：orchestration/hybrid/
 * - iztro 适配：core/adapters/iztro/
 * - 知识库：项目根 data/*.json
 */

export * from './types'
export * from './data'
export * from './utils'

export {
  runHybridPipeline,
  appendAssistantReply,
  cleanupExpiredSessions,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
  type PipelineDebugInfo,
} from '@/orchestration/hybrid'

export type {
  BaseIR,
  BaseIRPalace,
  BaseIRExtraStar,
  FinalIR,
  PersonalityAnalysis,
  PatternRuleJson,
  HybridCollected,
  HybridPersisted,
  HybridHistoryMessage,
  SessionPersisted,
  ConversationMessage,
} from '@/core/adapters/iztro/types'

export {
  parseHybridStage1,
  parseHybridStage2,
  parseHybridStage3,
  parseHybridStage4,
  createEmptyHybridPersisted,
} from '@/core/adapters/iztro/types'

export type {
  ConversationTurn,
  ReadingDomain,
  ReadingElements,
  ZiweiSessionData,
} from './session'

export {
  ReadingRequestSchema,
  SessionManager,
} from './session'
