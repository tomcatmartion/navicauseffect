/**
 * M1: 四化计算器 — 统一导出
 */

export { SIHUA_TABLE, WU_HU_DUN_TABLE, getDunGan, getWuHuDunGroup } from './tables'
export type { SihuaMapping, WuHuDunGroup } from './tables'
export {
  getShengNianSihua,
  getDunGanSihua,
  mergeWithOverlap,
  calculateOriginalSihua,
} from './calculator'
