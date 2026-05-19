/**
 * M6: 知识字典 — 统一导出
 *
 * 所有知识库数据从 data/ 目录 JSON 文件加载，支持热加载
 */

export type { StarAttribute, PalaceMeaning } from './types'
export {
  getStarAttributes,
  getPalaceMeanings,
  getEventStarAttributes,
  getTaiSuiTables,
  reloadAll,
} from './loader'
export {
  getStarAttr,
  getStarTraitByBrightness,
  getPalaceMeaning,
  isAuspicious,
  isInauspicious,
  getAuspiciousScore,
  getInauspiciousScore,
  getSubdueLevel,
  OPPOSITE_DECAY,
  TRINE_DECAY,
  getFlankingDecay,
  getLuCunDelta,
} from './query'
