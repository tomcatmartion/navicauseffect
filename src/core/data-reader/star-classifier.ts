/**
 * 星曜分类器
 *
 * 将 iztro 星曜名称分为：
 * - 十四主星 (major)
 * - 六吉星 (auspicious)
 * - 六煞星 (inauspicious)
 * - 禄存 (lucun)
 * - 丙丁级 (minor)
 * - 其他 (other)
 *
 * 分类依据：SKILL_宫位原生能级评估 V1.0 星曜吉煞分类表
 */

/** 星曜分类结果 */
export type StarClassification = 'major' | 'auspicious' | 'inauspicious' | 'lucun' | 'minor' | 'other'

/** 十四主星集合 */
const MAJOR_STARS = new Set([
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
])

/** 六吉星集合 */
const AUSPICIOUS_STARS = new Set([
  '左辅', '右弼', '文昌', '文曲', '天魁', '天钺',
])

/** 六煞星集合 */
const INAUSPICIOUS_STARS = new Set([
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
])

/** 丙丁级星曜集合 */
const MINOR_STARS = new Set([
  '红鸾', '天喜', '天刑', '天姚', '天哭', '天虚',
  '华盖', '天马', '咸池', '破碎',
  '力士', '青龙', '将军', '伏兵', '官府',
  '解神', '天巫', '天月', '阴煞', '天伤', '天使',
  '台辅', '封诰', '恩光', '天贵', '龙池', '凤阁',
  '截空', '旬空', '天空',
  '天官', '天福', '天寿',
])

/**
 * 分类单颗星曜
 *
 * @param starName 星曜名称
 * @returns 分类结果
 */
export function classifyStar(starName: string): StarClassification {
  if (MAJOR_STARS.has(starName)) return 'major'
  if (AUSPICIOUS_STARS.has(starName)) return 'auspicious'
  if (INAUSPICIOUS_STARS.has(starName)) return 'inauspicious'
  if (starName === '禄存') return 'lucun'
  if (MINOR_STARS.has(starName)) return 'minor'
  return 'other'
}

/**
 * 批量分类星曜
 *
 * @param starNames 星曜名称数组
 * @returns 按分类分组的星曜
 */
export function classifyStars(starNames: string[]): {
  major: string[]
  auspicious: string[]
  inauspicious: string[]
  lucun: boolean
  minor: string[]
  other: string[]
} {
  const result = {
    major: [] as string[],
    auspicious: [] as string[],
    inauspicious: [] as string[],
    lucun: false,
    minor: [] as string[],
    other: [] as string[],
  }

  for (const name of starNames) {
    switch (classifyStar(name)) {
      case 'major': result.major.push(name); break
      case 'auspicious': result.auspicious.push(name); break
      case 'inauspicious': result.inauspicious.push(name); break
      case 'lucun': result.lucun = true; break
      case 'minor': result.minor.push(name); break
      case 'other': result.other.push(name); break
    }
  }

  return result
}
