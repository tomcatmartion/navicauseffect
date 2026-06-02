/**
 * Limit Analyzer — 限运分析器
 *
 * 整合原局底盘、大限分析、流年分析、运限格局识别的功能。
 * 从 stages/helpers/fortune-runner.ts 迁移而来。
 */

// ── 原 fortune-engine 导出 ──────────────────────────────
export {
  extractAllDaXianMappings,
  findCurrentDaXianFromChart,
  buildThreeLayerTable,
  calculateDirectionMatrix,
  resolveLiuNianGan,
  resolveLiuNianGanZhi,
} from './fortune-engine'

export { getLiuNianExtraStars } from './liu-nian-extra-stars'
export { scorePalacesToBrief, mapToneToBriefLevel } from './limit-layer-scoring'

export { executeMatterLimitAnalysis } from './matter-limit-engine'
export {
  matchDaXianSihuaRule,
  matchLiuNianSihuaRule,
  scoreMutagenLayerForDirection,
  analyzeMutagenHits,
  buildMutagenLandingRows,
  buildSihuaLandingReport,
  buildYuanJuTriggerEntries,
  buildLayerTriggerEntries,
  buildTriggerEntriesFromMutagen,
  detectSihuaTriggers,
  applyTriggerActivationAdjust,
} from './sihua-trigger-engine'
export {
  buildDaXianScoringContext,
  buildYearlyScoringContext,
  buildLiuYueScoringContext,
  buildMinorScoringContext,
  extractMonthlyHoroscope,
} from './limit-scoring-context'

// ── 运限格局识别引擎导出 ────────────────────────────────
export {
  evaluateLimitPatterns,
  evaluateSingleDecennialPatterns,
  evaluateSingleYearlyPatterns,
} from './limit-pattern-evaluator'

export type {
  LimitPatternInput,
} from './limit-pattern-evaluator'

// ── 类型重新导出 ────────────────────────────────────────
export type {
  DaXianPalaceMapping,
  ThreeLayerPalaceTable,
  PalaceLayer,
  PalaceLayerEntry,
  DirectionMatrix,
  LimitPatternResult,
  LimitPatternsOutput,
  LimitType,
} from '@/core/types'
