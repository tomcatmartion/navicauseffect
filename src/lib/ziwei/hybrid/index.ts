/**
 * 程序混合（Hybrid）模块 barrel
 */

export * from './types'
export { buildBaseIR, buildThreeLayerShell } from './chart-bridge'
export { adaptIztroChartData } from './iztro-adapter'
export { mergeSihuaFromChartData } from './sihua-merger'
export { extractAuxiliaryStarsFromChart, lookupExtraStarsForTaiSui } from './extra-stars'
export { evaluateJsonPatterns, type PatternEvalContext } from './patterns-dsl'
export { buildFinalIRFromStages } from './final-ir-builder'
export { parseHybridAssistantPayload, mergeCollected } from './ai-parse'
export {
  runHybridPipeline,
  appendAssistantReply,
  cleanupExpiredSessions,
  type RunHybridPipelineParams,
  type RunHybridPipelineResult,
  type PipelineDebugInfo,
} from './orchestrator'
