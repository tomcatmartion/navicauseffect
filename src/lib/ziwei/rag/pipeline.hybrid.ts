/**
 * 程序模型混合架构 — Pipeline 薄包装
 *
 * 编排入口在 `src/lib/ziwei/hybrid/orchestrator.ts`（BaseIR/FinalIR + Session 持久化）。
 * 本文件仅作 API 兼容 re-export。
 */

import 'server-only'

export {
  runHybridPipeline,
  appendAssistantReply,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
  type PipelineDebugInfo as HybridDebugInfo,
} from '@/lib/ziwei/hybrid/orchestrator'
