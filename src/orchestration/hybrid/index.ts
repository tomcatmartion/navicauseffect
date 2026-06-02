/**
 * Hybrid Orchestrator — 自由对话模式管线编排器
 *
 * 负责管理意图分类、调用各阶段、组装 Prompt、流式 AI 输出。
 */

export {
  runHybridPipeline,
  appendAssistantReply,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
} from './orchestrator'

export type { HybridDebugInfo, PipelineDebugInfo } from '@/types/hybrid-debug'
