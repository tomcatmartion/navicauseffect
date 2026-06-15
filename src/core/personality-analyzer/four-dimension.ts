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
import { getPersonalityTriad } from '../knowledge-dict/loader'

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
  opposite: { majorStars: MajorStar[]; brightness: PalaceBrightness; auspiciousStars: string[]; inauspiciousStars: string[]; minorStars: string[] }
  /** 三合宫数据（两个） */
  trine: Array<{ majorStars: MajorStar[]; auspiciousStars: string[]; inauspiciousStars: string[]; minorStars: string[] }>
  /** 夹宫数据（两个） */
  flanking: Array<{ majorStars: MajorStar[]; auspiciousStars: string[]; inauspiciousStars: string[]; minorStars: string[]; brightness: PalaceBrightness }>
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
    // 借对宫所有主星（各自降一级）
    if (input.opposite.majorStars.length > 0) {
      const brightnessMap: Record<string, PalaceBrightness> = {
        '旺': '平',
        '平': '陷',
        '陷': '陷',
      }
      const borrowedBrightness = brightnessMap[input.opposite.brightness] || '陷'
      const borrowedStars = input.opposite.majorStars.map(s => `${s}(${borrowedBrightness})`).join('、')
      selfTags.push(`空宫借星: ${borrowedStars}`)
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

  // 丙丁级星曜标签（从 personality_triad.json 配置读取）
  if (input.minorStars.length > 0) {
    selfTags.push(`丙丁级: ${input.minorStars.join('、')}`)
    const minorConfig = getPersonalityTriad().extra_stars_rules.丙丁级星曜集
    if (minorConfig) {
      for (const ms of input.minorStars) {
        const trait = minorConfig[ms]
        if (trait) selfTags.push(trait)
      }
    }
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
  // 对宫丙丁级辅助参考
  if (input.opposite.minorStars.length > 0) {
    oppositeTags.push(`对宫丙丁级: ${input.opposite.minorStars.join('、')}`)
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
    // 三合丙丁级辅助参考
    if (t.minorStars.length > 0) {
      trineTags.push(`三合${i + 1}丙丁级: ${t.minorStars.join('、')}`)
    }
  }

  // ④ 夹宫标签（两侧有星=主星或辅星存在，空宫才算无星）
  const leftFlank = input.flanking[0]
  const rightFlank = input.flanking[1]
  const leftHasStars = leftFlank.majorStars.length > 0 || leftFlank.auspiciousStars.length > 0 || leftFlank.inauspiciousStars.length > 0
  const rightHasStars = rightFlank.majorStars.length > 0 || rightFlank.auspiciousStars.length > 0 || rightFlank.inauspiciousStars.length > 0

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

    // 夹宫丙丁级（近距离影响，不可忽略）
    const allFlankMinor = [...leftFlank.minorStars, ...rightFlank.minorStars]
    if (allFlankMinor.length > 0) {
      flankingTags.push(`夹宫丙丁级: ${allFlankMinor.join('、')}`)
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
      const brightnessMap: Record<string, PalaceBrightness> = {
        '旺': '平',
        '平': '陷',
        '陷': '陷',
      }
      const borrowedBrightness = brightnessMap[input.opposite.brightness] || '陷'
      const borrowedNames = input.opposite.majorStars.join('、')
      parts.push(`空宫借${borrowedNames}${borrowedBrightness}`)
    } else {
      parts.push('空宫无借星')
    }
    parts.push('依赖外部投射')
  } else {
    const mainStarDescs = input.majorStars.map(ms => `${ms.star}${ms.brightness}`)
    parts.push(mainStarDescs.join('、'))
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

  // 丙丁级星曜（本宫 + 三方四正汇总）
  const minorStars = input.minorStars ?? []
  const allMinorSet = new Set(minorStars)
  for (const m of input.opposite.minorStars ?? []) allMinorSet.add(m)
  for (const t of input.trine) for (const m of t.minorStars ?? []) allMinorSet.add(m)
  for (const f of input.flanking) for (const m of f.minorStars ?? []) allMinorSet.add(m)
  const allMinor = [...allMinorSet]
  const minorEffect = allMinor.length > 0
    ? `${allMinor.join('、')}，影响情感/社交/精神层面`
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
// 三宫综合定性（增强版：含交叉张力分析）
// ═══════════════════════════════════════════════════════════════════

/** 三宫交叉张力分析输入 */
export interface ThreePalaceCrossInput {
  /** 命宫评分 */
  mingScore: number
  /** 命宫主星 */
  mingStars: Array<{ star: string; brightness: string }>
  /** 命宫四化 */
  mingSihua: Array<{ star: string; type: string }>
  /** 身宫评分 */
  shenScore: number
  /** 身宫主星 */
  shenStars: Array<{ star: string; brightness: string }>
  /** 身宫四化 */
  shenSihua: Array<{ star: string; type: string }>
  /** 太岁宫评分 */
  taiSuiScore: number
  /** 太岁宫主星 */
  taiSuiStars: Array<{ star: string; brightness: string }>
  /** 太岁宫四化 */
  taiSuiSihua: Array<{ star: string; type: string }>
}

/** 三宫交叉张力分析结果 */
export interface ThreePalaceCrossResult {
  /** 基础基调（基于分数） */
  baseTone: string
  /** 交叉张力描述 */
  crossTensions: string[]
  /** 三宫综合结论 */
  synthesis: string
}

/**
 * 三宫综合强弱判定（增强版）
 * 不仅看分数，还分析主星/四化差异产生的性格张力
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

/**
 * 三宫交叉张力分析（P2）
 * 分析命宫/身宫/太岁宫之间的主星、四化差异产生的性格张力
 */
export function analyzeThreePalaceCrossTension(
  input: ThreePalaceCrossInput,
): ThreePalaceCrossResult {
  const { mingScore, mingStars, mingSihua, shenScore, shenStars, shenSihua, taiSuiScore, taiSuiStars, taiSuiSihua } = input

  const crossTensions: string[] = []

  // 1. 分数差异张力
  const mingShenDiff = Math.abs(mingScore - shenScore)
  const mingTaiDiff = Math.abs(mingScore - taiSuiScore)
  const shenTaiDiff = Math.abs(shenScore - taiSuiScore)

  if (mingShenDiff >= 2.5) {
    crossTensions.push(
      mingScore > shenScore
        ? `命宫(${mingScore.toFixed(1)})与身宫(${shenScore.toFixed(1)})落差大：外显强势但内在根基不稳，容易"外强中干"`
        : `命宫(${mingScore.toFixed(1)})与身宫(${shenScore.toFixed(1)})落差大：外在表现温和但内在意志坚定，属于"外柔内刚"`
    )
  }

  if (mingTaiDiff >= 2.5) {
    crossTensions.push(
      mingScore > taiSuiScore
        ? `命宫(${mingScore.toFixed(1)})与太岁宫(${taiSuiScore.toFixed(1)})落差大：先天条件好但后天发展受限，需注意运势起伏`
        : `命宫(${mingScore.toFixed(1)})与太岁宫(${taiSuiScore.toFixed(1)})落差大：先天条件一般但后天有发展潜力，可通过努力突破`
    )
  }

  if (shenTaiDiff >= 2.5) {
    crossTensions.push(
      shenScore > taiSuiScore
        ? `身宫(${shenScore.toFixed(1)})与太岁宫(${taiSuiScore.toFixed(1)})落差大：后天努力方向与运势走势不一致，需调整策略`
        : `身宫(${shenScore.toFixed(1)})与太岁宫(${taiSuiScore.toFixed(1)})落差大：后天发展受制于运势，需顺势而为`
    )
  }

  // 2. 主星差异张力
  const mingStarNames = new Set(mingStars.map(s => s.star))
  const shenStarNames = new Set(shenStars.map(s => s.star))
  const taiSuiStarNames = new Set(taiSuiStars.map(s => s.star))

  // 命宫 vs 身宫主星差异
  const mingShenOverlap = [...mingStarNames].filter(s => shenStarNames.has(s))
  if (mingShenOverlap.length === 0 && mingStars.length > 0 && shenStars.length > 0) {
    crossTensions.push(
      `命宫主星(${mingStars.map(s => s.star).join('、')})与身宫主星(${shenStars.map(s => s.star).join('、')})完全不同：` +
      `外在性格与内在追求存在明显反差，容易"表里不一"或"双重性格"`
    )
  }

  // 3. 四化差异张力
  const mingHasLu = mingSihua.some(s => s.type === '化禄')
  const mingHasQuan = mingSihua.some(s => s.type === '化权')
  const mingHasJi = mingSihua.some(s => s.type === '化忌')
  const shenHasLu = shenSihua.some(s => s.type === '化禄')
  const shenHasQuan = shenSihua.some(s => s.type === '化权')
  const shenHasJi = shenSihua.some(s => s.type === '化忌')
  const taiSuiHasLu = taiSuiSihua.some(s => s.type === '化禄')
  const taiSuiHasJi = taiSuiSihua.some(s => s.type === '化忌')

  if (mingHasLu && shenHasJi) {
    crossTensions.push('命宫化禄 + 身宫化忌：外圆内方，表面随和圆融但内心有执念和底线，对在意的事绝不妥协')
  }
  if (mingHasQuan && shenHasLu) {
    crossTensions.push('命宫化权 + 身宫化禄：外强内柔，外在强势主导但内在渴望和谐，容易在掌控与妥协间摇摆')
  }
  if (mingHasJi && taiSuiHasLu) {
    crossTensions.push('命宫化忌 + 太岁宫化禄：先天纠结但后天顺遂，早年多波折但中年后运势转好')
  }
  if (!mingHasLu && !mingHasQuan && shenHasLu) {
    crossTensions.push('命宫无禄权 + 身宫有禄：先天条件一般，但后天努力能带来财富和机遇，适合白手起家')
  }

  // 4. 旺弱差异张力
  const mingWang = mingStars.some(s => ['旺', '庙'].includes(s.brightness))
  const shenXian = shenStars.some(s => ['陷', '平'].includes(s.brightness))
  if (mingWang && shenXian) {
    crossTensions.push('命宫旺 + 身宫陷：先天资质好但后天发展受限，容易"高开低走"，需注重持续积累')
  }

  const baseTone = judgeThreePalaceTone(mingScore, shenScore, taiSuiScore)

  // 综合结论
  let synthesis = baseTone
  if (crossTensions.length > 0) {
    synthesis += `。交叉张力：${crossTensions.length > 2 ? crossTensions.slice(0, 2).join('；') + '等' + (crossTensions.length - 2) + '项' : crossTensions.join('；')}`
  } else {
    synthesis += '。三宫之间无明显交叉张力，性格较为统一。'
  }

  return {
    baseTone,
    crossTensions,
    synthesis,
  }
}
