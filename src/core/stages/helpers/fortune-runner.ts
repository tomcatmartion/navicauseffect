/**
 * Helper: 行运计算器（兼容层）
 *
 * ⚠️ 所有实现已迁移至 @/core/limit-analyzer/fortune-engine.ts
 * 此文件保留为向后兼容的重新导出，请勿在此添加新逻辑。
 */

export {
  extractAllDaXianMappings,
  buildThreeLayerTable,
  calculateDirectionMatrix,
} from '@/core/limit-analyzer/fortune-engine'

export type {
  DaXianPalaceMapping,
  ThreeLayerPalaceTable,
  PalaceLayer,
  PalaceLayerEntry,
  DirectionMatrix,
} from '@/core/types'
