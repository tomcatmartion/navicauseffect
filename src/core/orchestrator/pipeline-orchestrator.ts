/**
 * 兼容入口：程序混合编排已迁移至 `src/lib/ziwei/hybrid/orchestrator.ts`
 */

import 'server-only'

export {
  runHybridPipeline,
  appendAssistantReply,
  cleanupExpiredSessions,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
  type PipelineDebugInfo,
} from '@/lib/ziwei/hybrid/orchestrator'
