/**
 * iztro 适配器 — 业务逻辑层
 *
 * iztro 命盘适配与 Hybrid IR（权威实现；单测在 `lib/ziwei/hybrid/__tests__`）。
 */

export { buildBaseIR, buildThreeLayerShell } from './chart-bridge'
export { extractAuxiliaryStarsFromChart, lookupExtraStarsForTaiSui } from './extra-stars'
export { adaptIztroChartData } from './iztro-adapter'
export { mergeSihuaFromChartData } from './sihua-merger'
export { evaluateJsonPatterns, evaluateCondition } from './patterns-dsl'
export { buildFinalIRFromStages } from './final-ir-builder'
export { parseHybridAssistantPayload, mergeCollected } from './ai-parse'

export type {
  BaseIR, BaseIRPalace, BaseIRExtraStar,
  FinalIR, PersonalityAnalysis,
  PatternRuleJson, HybridCollected,
  HybridPersisted, HybridHistoryMessage,
} from './types'

export {
  parseHybridStage1, parseHybridStage2,
  parseHybridStage3, parseHybridStage4,
  createEmptyHybridPersisted,
} from './types'
