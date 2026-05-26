/**
 * M2: 宫位评分引擎 — 统一导出
 */

export { getSkeleton, getSkeletonBrightness, SKELETON_MAP } from './skeleton'
export { allPatterns } from './patterns'
export type { PatternPredicate, PatternLevel, ChartAccessor } from './patterns'
// scoring-flow 可能还在被 agent 修复中，这里按需导出
export {
  evaluateAllPalaces,
  evaluateSinglePalace,
  type ScoringContext,
  type PalaceForScoring,
  type StarInPalaceForScoring,
  getOppositeIndex,
  getTrineIndices,
  getFlankingIndices,
  getWeakerBrightness,
} from './scoring-flow'
export {
  getAllFlankingPairs,
  getNativeSihuaHitsInPalace,
  NATIVE_OWNER_SAME_SOURCE_LABEL,
  type FlankingPairResult,
} from './jiagong-matcher'
export {
  evaluatePalacePatternsOnly,
  buildChartAccessor,
} from './pattern-scoring'
