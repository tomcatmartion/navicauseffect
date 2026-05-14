/**
 * M2: 格局判定 — 统一导出
 */

export { greatAuspiciousPatterns } from './great-auspicious'
export { mediumAuspiciousPatterns } from './medium-auspicious'
export { smallAuspiciousPatterns } from './small-auspicious'
export { smallInauspiciousPatterns } from './small-inauspicious'
export { mediumInauspiciousPatterns } from './medium-inauspicious'
export { greatInauspiciousPatterns } from './great-inauspicious'
export type { PatternPredicate, PatternLevel, ChartAccessor } from './types'
export {
  getSanFangSiZheng,
  hasStarInSanFang,
  hasSihuaInSanFang,
  hasZuoYouInSanFang,
  hasLuInSanFang,
  isJiGeYinDong,
  isMiaoWang,
  isLuoXian,
  checkSanQiFromSameSource,
} from './types'

import { greatAuspiciousPatterns } from './great-auspicious'
import { mediumAuspiciousPatterns } from './medium-auspicious'
import { smallAuspiciousPatterns } from './small-auspicious'
import { smallInauspiciousPatterns } from './small-inauspicious'
import { mediumInauspiciousPatterns } from './medium-inauspicious'
import { greatInauspiciousPatterns } from './great-inauspicious'

/** 所有格局的扁平数组 */
export const allPatterns = [
  ...greatAuspiciousPatterns,
  ...mediumAuspiciousPatterns,
  ...smallAuspiciousPatterns,
  ...smallInauspiciousPatterns,
  ...mediumInauspiciousPatterns,
  ...greatInauspiciousPatterns,
]
