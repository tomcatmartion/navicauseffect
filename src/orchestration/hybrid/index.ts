/**
 * Hybrid Orchestrator — Hybrid Stage 管线编排器
 *
 * 从 lib/ziwei/hybrid/orchestrator.ts 迁移而来。
 * 负责管理状态机、调用各阶段、组装 Prompt、流式 AI 输出。
 */

export {
  runHybridPipeline,
  appendAssistantReply,
  cleanupExpiredSessions,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
} from './orchestrator'

export type { HybridDebugInfo, PipelineDebugInfo } from '@/types/hybrid-debug'
