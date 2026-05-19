/**
 * Limit Analyzer — 限运分析器
 *
 * 整合原局底盘、大限分析、流年分析的功能。
 * 从 stages/helpers/fortune-runner.ts 迁移而来。
 */

export {
  extractAllDaXianMappings,
  buildThreeLayerTable,
  calculateDirectionMatrix,
} from './fortune-engine'

export type {
  DaXianPalaceMapping,
  ThreeLayerPalaceTable,
  PalaceLayer,
  PalaceLayerEntry,
  DirectionMatrix,
} from '@/core/types'
