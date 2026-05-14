/**
 * Helper: PalaceInput 构建器
 *
 * 从 ScoringContext 和评分结果构建 M4 PersonalityAnalyzer 所需的 PalaceInput。
 */

import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import { getOppositeIndex, getTrineIndices, getFlankingIndices } from '@/core/energy-evaluator/scoring-flow'
import type { PalaceInput } from '@/core/personality-analyzer/four-dimension'
import type { PalaceScore, PalaceName, DiZhi } from '@/core/types'

/** 吉星名单 */
const AUSPICIOUS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']

/** 煞星名单 */
const INAUSPICIOUS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']

/** 丙丁级星曜名单 */
const MINOR_STARS = ['红鸾', '天喜', '天刑', '天姚', '天哭', '天虚', '华盖', '天马', '咸池', '破碎', '力士', '青龙', '将军', '伏兵', '官府']

function filterByNames(stars: PalaceForScoring['stars'], names: string[]): string[] {
  return stars.filter(s => names.includes(s.name)).map(s => s.name)
}

/**
 * 构建单个宫位的 PalaceInput
 */
export function buildPalaceInput(
  ctx: ScoringContext,
  scores: PalaceScore[],
  palaceIdx: number,
  palaceName: string,
): PalaceInput {
  const palace = ctx.palaces[palaceIdx]
  const oppIdx = getOppositeIndex(palaceIdx)
  const [t1, t2] = getTrineIndices(palaceIdx)
  const [f1, f2] = getFlankingIndices(palaceIdx)

  const opp = ctx.palaces[oppIdx]
  const tri1 = ctx.palaces[t1]
  const tri2 = ctx.palaces[t2]
  const flk1 = ctx.palaces[f1]
  const flk2 = ctx.palaces[f2]

  return {
    palaceName,
    diZhi: palace.diZhi as DiZhi,
    majorStars: palace.majorStars,
    brightness: palace.brightness,
    sihua: palace.stars.filter(s => s.sihua).map(s => ({ star: s.name, type: s.sihua! })),
    auspiciousStars: filterByNames(palace.stars, AUSPICIOUS),
    inauspiciousStars: filterByNames(palace.stars, INAUSPICIOUS),
    minorStars: filterByNames(palace.stars, MINOR_STARS),
    finalScore: scores[palaceIdx]?.finalScore ?? 5,
    opposite: {
      majorStars: opp?.majorStars.map(ms => ms.star) ?? [],
      brightness: opp?.brightness ?? '平',
      auspiciousStars: opp ? filterByNames(opp.stars, AUSPICIOUS) : [],
      inauspiciousStars: opp ? filterByNames(opp.stars, INAUSPICIOUS) : [],
    },
    trine: [
      {
        majorStars: tri1?.majorStars.map(ms => ms.star) ?? [],
        auspiciousStars: tri1 ? filterByNames(tri1.stars, AUSPICIOUS) : [],
        inauspiciousStars: tri1 ? filterByNames(tri1.stars, INAUSPICIOUS) : [],
      },
      {
        majorStars: tri2?.majorStars.map(ms => ms.star) ?? [],
        auspiciousStars: tri2 ? filterByNames(tri2.stars, AUSPICIOUS) : [],
        inauspiciousStars: tri2 ? filterByNames(tri2.stars, INAUSPICIOUS) : [],
      },
    ],
    flanking: [
      {
        majorStars: flk1?.majorStars.map(ms => ms.star) ?? [],
        auspiciousStars: flk1 ? filterByNames(flk1.stars, AUSPICIOUS) : [],
        inauspiciousStars: flk1 ? filterByNames(flk1.stars, INAUSPICIOUS) : [],
        brightness: flk1?.brightness ?? '平',
      },
      {
        majorStars: flk2?.majorStars.map(ms => ms.star) ?? [],
        auspiciousStars: flk2 ? filterByNames(flk2.stars, AUSPICIOUS) : [],
        inauspiciousStars: flk2 ? filterByNames(flk2.stars, INAUSPICIOUS) : [],
        brightness: flk2?.brightness ?? '平',
      },
    ],
  }
}
