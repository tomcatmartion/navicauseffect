/**
 * M4: 性格定性 — 三宫四维合参标签生成
 *
 * 职责：提取命宫/身宫/太岁宫数据，按本对合临四维生成结构化标签
 *       不生成自然语言，只输出标签供 LLM 消费
 *
 * 来源：SKILL_定性命主性格 V1.0
 */

import type { DiZhi, PalaceBrightness, MajorStar } from '../types'
import { getOppositeGong, getTrineGong, getFlankingGong } from '../types'
import type { FourDimensionTags, HolographicBase, PalaceScore } from '../types'
import { getStarAttr, getStarTraitByBrightness, getSubdueLevel } from '../knowledge-dict'

// ═══════════════════════════════════════════════════════════════════
// 四维合参标签生成
// ═══════════════════════════════════════════════════════════════════

/**
 * 单宫四维合参输入
 */
export interface PalaceInput {
  /** 宫位名 */
  palaceName: string
  /** 地支 */
  diZhi: DiZhi
  /** 主星 */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness }>
  /** 旺弱 */
  brightness: PalaceBrightness
  /** 四化星 */
  sihua: Array<{ star: string; type: string }>
  /** 吉星 */
  auspiciousStars: string[]
  /** 煞星 */
  inauspiciousStars: string[]
  /** 丙丁级星曜（红鸾/天喜/天刑/天姚等） */
  minorStars: string[]
  /** 评分 */
  finalScore: number
  /** 对宫数据（简化） */
  opposite: { majorStars: MajorStar[]; brightness: PalaceBrightness; auspiciousStars: string[]; inauspiciousStars: string[] }
  /** 三合宫数据（两个） */
  trine: Array<{ majorStars: MajorStar[]; auspiciousStars: string[]; inauspiciousStars: string[] }>
  /** 夹宫数据（两个） */
  flanking: Array<{ majorStars: MajorStar[]; auspiciousStars: string[]; inauspiciousStars: string[]; brightness: PalaceBrightness }>
}

/**
 * 为单宫生成四维合参标签
 */
export function generateFourDimensionTags(input: PalaceInput): FourDimensionTags {
  const selfTags: string[] = []
  const oppositeTags: string[] = []
  const trineTags: string[] = []
  const flankingTags: string[] = []

  // ① 本宫标签
  // 空宫处理：如果本宫无主星，则借对宫主星（降一级），并添加底层标签
  const isEmptyPalace = input.majorStars.length === 0

  if (isEmptyPalace) {
    // 借对宫主星
    if (input.opposite.majorStars.length > 0) {
      const borrowedStar = input.opposite.majorStars[0]
      const brightnessMap: Record<string, PalaceBrightness> = {
        '旺': '平',
        '平': '陷',
        '陷': '陷',
      }
      const borrowedBrightness = brightnessMap[input.opposite.brightness] || '陷'
      selfTags.push(`空宫借星: ${borrowedStar}(${borrowedBrightness})`)
      selfTags.push('容易受外界环境影响')
      selfTags.push('缺乏核心主见')
    } else {
      selfTags.push('空宫无主星')
      selfTags.push('完全依赖外部投射')
      selfTags.push('缺乏核心主见')
    }
  } else {
    // 正常情况：遍历本宫主星
    for (const { star, brightness } of input.majorStars) {
      const attr = getStarAttr(star)
      if (attr) {
        selfTags.push(`${star}(${brightness})`)
        // 根据旺弱选正面/负面特质关键词
        const trait = getStarTraitByBrightness(star, brightness)
        selfTags.push(trait.split('，')[0]) // 取第一个特质短语
      }
    }
  }

  // 四化标签
  for (const sh of input.sihua) {
    selfTags.push(`${sh.type}${sh.star}`)
  }

  // 吉煞标签
  if (input.auspiciousStars.length > 0) {
    selfTags.push(`吉星加持: ${input.auspiciousStars.join('、')}`)
  }
  if (input.inauspiciousStars.length > 0) {
    selfTags.push(`煞星干扰: ${input.inauspiciousStars.join('、')}`)
  }

  // ② 对宫投射标签
  if (input.opposite.majorStars.length > 0) {
    oppositeTags.push(`对宫: ${input.opposite.majorStars.join('、')}(${input.opposite.brightness})`)
    if (input.opposite.auspiciousStars.length > input.opposite.inauspiciousStars.length) {
      oppositeTags.push('加强本宫')
    } else if (input.opposite.inauspiciousStars.length > input.opposite.auspiciousStars.length) {
      oppositeTags.push('制约本宫')
    } else {
      oppositeTags.push('中性投射')
    }
  } else {
    oppositeTags.push('对宫无主星')
  }

  // ③ 三合宫支撑标签
  for (let i = 0; i < input.trine.length; i++) {
    const t = input.trine[i]
    if (t.majorStars.length > 0) {
      const auspCount = t.auspiciousStars.length
      const inauspCount = t.inauspiciousStars.length
      if (auspCount > inauspCount) {
        trineTags.push(`三合${i + 1}: ${t.majorStars.join('、')} — 强力支撑`)
      } else if (inauspCount > auspCount) {
        trineTags.push(`三合${i + 1}: ${t.majorStars.join('、')} — 侧翼受压`)
      } else {
        trineTags.push(`三合${i + 1}: ${t.majorStars.join('、')} — 中性`)
      }
    }
  }

  // ④ 夹宫标签
  const leftFlank = input.flanking[0]
  const rightFlank = input.flanking[1]
  const leftHasStars = leftFlank.majorStars.length > 0
  const rightHasStars = rightFlank.majorStars.length > 0

  if (leftHasStars && rightHasStars) {
    flankingTags.push('夹宫成立')
    const leftAus = leftFlank.auspiciousStars.length
    const rightAus = rightFlank.auspiciousStars.length
    const leftInaus = leftFlank.inauspiciousStars.length
    const rightInaus = rightFlank.inauspiciousStars.length

    if (Math.abs(leftAus - rightAus) <= 1 && Math.abs(leftInaus - rightInaus) <= 1) {
      flankingTags.push('两侧均衡')
    } else {
      flankingTags.push('两侧悬殊')
      if (leftAus + leftInaus > rightAus + rightInaus) {
        flankingTags.push('左侧偏强')
      } else {
        flankingTags.push('右侧偏强')
      }
    }

    // 羊陀夹忌检测
    const allFlankStars = [...leftFlank.inauspiciousStars, ...rightFlank.inauspiciousStars]
    if (allFlankStars.includes('擎羊') && allFlankStars.includes('陀罗')) {
      flankingTags.push('羊陀夹制')
    }
  } else if (leftHasStars || rightHasStars) {
    flankingTags.push('仅单侧有星，夹宫不成立')
  } else {
    flankingTags.push('两侧均无星，无夹宫')
  }

  // 综合定性
  const summary = generatePalaceSummary(input, selfTags, oppositeTags, trineTags, flankingTags)

  return {
    palace: input.palaceName as FourDimensionTags['palace'],
    diZhi: input.diZhi,
    selfTags,
    oppositeTags,
    trineTags,
    flankingTags,
    summary,
  }
}

/**
 * 生成综合定性描述
 */
function generatePalaceSummary(
  input: PalaceInput,
  selfTags: string[],
  oppositeTags: string[],
  trineTags: string[],
  flankingTags: string[],
): string {
  const parts: string[] = []

  // 基于评分定性
  if (input.finalScore >= 6.0) {
    parts.push('强旺')
  } else if (input.finalScore >= 4.5) {
    parts.push('中等')
  } else if (input.finalScore >= 3.0) {
    parts.push('虚浮')
  } else {
    parts.push('凶危')
  }

  // 主星定性
  const isEmptyPalace = input.majorStars.length === 0
  if (isEmptyPalace) {
    // 空宫：看借星情况
    if (input.opposite.majorStars.length > 0) {
      const borrowedStar = input.opposite.majorStars[0]
      const brightnessMap: Record<string, PalaceBrightness> = {
        '旺': '平',
        '平': '陷',
        '陷': '陷',
      }
      const borrowedBrightness = brightnessMap[input.opposite.brightness] || '陷'
      parts.push(`空宫借${borrowedStar}${borrowedBrightness}`)
    } else {
      parts.push('空宫无借星')
    }
    parts.push('依赖外部投射')
  } else {
    const mainStar = input.majorStars[0]
    parts.push(`${mainStar.star}${mainStar.brightness}`)
  }

  // 四化影响
  const jiList = input.sihua.filter(s => s.type === '化忌')
  if (jiList.length > 0) {
    parts.push(`有忌(${jiList.map(j => j.star).join('、')})`)
  }

  return parts.join('，')
}

// ═══════════════════════════════════════════════════════════════════
// 命宫全息底色标注
// ═══════════════════════════════════════════════════════════════════

/**
 * 生成命宫全息底色
 */
export function generateHolographicBase(input: PalaceInput): HolographicBase {
  const sihuaList = input.sihua
  const auspicious = input.auspiciousStars
  const inauspicious = input.inauspiciousStars

  // 四化方向
  const sihuaDirection = sihuaList.map(s => `${s.type}${s.star}`).join('；') || '无四化'

  // 六吉影响
  const auspiciousEffect = auspicious.length > 0
    ? `${auspicious.join('、')}加持，稳定性和助力增强`
    : '无吉星直接加持'

  // 六煞影响
  const inauspiciousEffect = inauspicious.length > 0
    ? `${inauspicious.join('、')}干扰，须注意方向`
    : '无煞星直接冲击'

  // 丙丁级星曜
  const minorStars = input.minorStars ?? []
  const minorEffect = minorStars.length > 0
    ? `${minorStars.join('、')}，影响情感/社交/精神层面`
    : '无特殊丙丁级星曜'

  // 综合底色定性
  const hasLu = sihuaList.some(s => s.type === '化禄')
  const hasQuan = sihuaList.some(s => s.type === '化权')
  const hasJi = sihuaList.some(s => s.type === '化忌')

  const summaryParts: string[] = []
  if (hasLu) summaryParts.push('顺畅喜悦方向')
  if (hasQuan) summaryParts.push('强势主导方向')
  if (hasJi) summaryParts.push('执念阻滞方向')
  if (summaryParts.length === 0) summaryParts.push('中性平顺底色')

  const summary = summaryParts.join('；')

  return {
    sihuaDirection,
    auspiciousEffect,
    inauspiciousEffect,
    minorEffect,
    summary,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 三宫综合定性
// ═══════════════════════════════════════════════════════════════════

/**
 * 三宫综合强弱判定
 */
export function judgeThreePalaceTone(
  mingScore: number,
  shenScore: number,
  taiSuiScore: number,
): string {
  const avg = (mingScore + shenScore + taiSuiScore) / 3

  if (mingScore >= 6.0 && shenScore >= 6.0 && taiSuiScore >= 6.0) {
    return '三宫均强旺 — 主见坚定，意志力强'
  }
  if (mingScore >= 6.0 && (shenScore < 4.5 || taiSuiScore < 4.5)) {
    return '表强里弱 — 外显强势但内核动摇'
  }
  if (mingScore < 4.5 && shenScore >= 6.0 && taiSuiScore >= 6.0) {
    return '表弱里强 — 外显柔和但有韧性'
  }
  if (avg < 4.5) {
    return '三宫均弱 — 易受外界影响'
  }
  return '三宫混杂 — 逐宫分析，内外层存在落差'
}
