/**
 * FinalIR 摘要 — 由 Stage1/2 确定性输出拼装（供调试与 Prompt 补充块）
 */

import type { Stage1Output, Stage2Output } from '@/core/types'
import type { FinalIR, PersonalityAnalysis } from './types'

function buildFourDimensionSynthesis(tags: Stage2Output['mingGongTags']): PersonalityAnalysis['fourDimensions'] {
  const self = [
    tags.selfTags.filter(t => !t.includes('吉星') && !t.includes('煞星')).slice(0, 3),
    tags.summary,
  ].filter(Boolean).join('；')

  const opposite = tags.oppositeTags.join('；') || '对宫无主星'

  const trine = tags.trineTags.length > 0
    ? tags.trineTags.join('；')
    : '三合无明显支撑'

  const flanking = tags.flankingTags.join('；') || '夹宫信息不足'

  const synthesis = `本宫：${tags.summary}；对宫投射：${tags.oppositeTags[0] || '中性'}；三合支撑：${tags.trineTags[0] || '无'}；夹宫：${tags.flankingTags[0] || '不成立'}`

  return { self, opposite, trine, flanking, synthesis }
}

function buildPatternInfluences(stage1: Stage1Output): string[] {
  const influences: string[] = []

  for (const pattern of stage1.allPatterns) {
    if (pattern.level === '大吉' || pattern.level === '中吉' || pattern.level === '小吉') {
      influences.push(`【吉格】${pattern.name}：增强${pattern.multiplier > 1 ? `${pattern.multiplier}倍` : ''}正面性格特质`)
    } else if (pattern.level === '大凶' || pattern.level === '中凶' || pattern.level === '小凶') {
      influences.push(`【凶格】${pattern.name}：放大负面性格倾向`)
    } else {
      influences.push(`【混合格】${pattern.name}：性格具有双重面向`)
    }
  }

  return influences
}

function buildStrengthsWeaknesses(stage2: Stage2Output): { strengths: string[], weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []

  for (const tag of stage2.mingGongTags.trineTags) {
    if (tag.includes('强力支撑')) {
      strengths.push(`三合强旺：${tag}`)
    }
  }

  for (const tag of stage2.mingGongTags.oppositeTags) {
    if (tag.includes('制约')) {
      weaknesses.push(`对宫制约：${tag}`)
    } else if (tag.includes('加强')) {
      strengths.push(`对宫助力：${tag}`)
    }
  }

  if (stage2.mingGongHolographic.auspiciousEffect.includes('加持')) {
    strengths.push(`吉星加持：${stage2.mingGongHolographic.auspiciousEffect.split('，')[0]}`)
  }

  if (stage2.mingGongHolographic.inauspiciousEffect.includes('干扰')) {
    weaknesses.push(`煞星影响：${stage2.mingGongHolographic.inauspiciousEffect.split('，')[0]}`)
  }

  const luCount = (stage2.mingGongHolographic.sihuaDirection.match(/化禄/g) || []).length
  const quanCount = (stage2.mingGongHolographic.sihuaDirection.match(/化权/g) || []).length
  const jiCount = (stage2.mingGongHolographic.sihuaDirection.match(/化忌/g) || []).length

  if (luCount > 0) strengths.push(`化禄${luCount}颗：性格圆融顺畅`)
  if (quanCount > 0) strengths.push(`化权${quanCount}颗：主导意识强`)
  if (jiCount > 0) weaknesses.push(`化忌${jiCount}颗：执念倾向需注意`)

  return {
    strengths: strengths.length > 0 ? strengths : ['基础稳固，性格特质均衡'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['无明显性格弱点'],
  }
}

function buildAdvice(stage2: Stage2Output): PersonalityAnalysis['advice'] {
  const overall = `命宫全息底色为：${stage2.mingGongHolographic.summary}。${stage2.overallTone}。建议注重${stage2.mingGongHolographic.auspiciousEffect.includes('加持') ? '发挥吉星优势' : '平衡性格双面性'}。`

  let career = ''
  const hasLu = stage2.mingGongHolographic.sihuaDirection.includes('化禄')
  const hasQuan = stage2.mingGongHolographic.sihuaDirection.includes('化权')
  const hasJi = stage2.mingGongHolographic.sihuaDirection.includes('化忌')

  if (hasQuan) {
    career = '化权入命，适合主导型工作，可承担管理或决策角色'
  } else if (hasLu) {
    career = '化禄入命，适合人际协调型工作，财运亨通'
  } else if (hasJi) {
    career = '化忌影响，宜选择稳定领域，避免激进决策'
  } else {
    career = '命局平稳，根据主星特质选择适合的发展方向'
  }

  const relationship = hasJi
    ? '情感表达需注意避免执着，多沟通理解'
    : hasLu
      ? '人缘佳，感情发展顺畅，注意珍惜缘分'
      : '感情顺其自然，相互理解是长久之道'

  const health = stage2.overallTone.includes('弱')
    ? '注意抵抗力培养，保持规律作息'
    : '精力充沛，注意劳逸结合'

  return { overall, career, relationship, health }
}

export function buildFinalIRFromStages(stage1: Stage1Output, stage2?: Stage2Output): FinalIR {
  const palaceLines = stage1.palaceScores
    .slice()
    .sort((a, b) => b.finalScore - a.finalScore)
    .map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`)

  const patternSummary = stage1.allPatterns.map(p => `${p.name}(${p.level})`)
  const sihuaSummary = [
    ...stage1.mergedSihua.entries.map(e => `${e.type}${e.star}(${e.source})`),
    ...stage1.mergedSihua.specialOverlaps.map(o => `${o.type}:${o.star}`),
  ]

  let personalitySummary: PersonalityAnalysis | undefined
  if (stage2) {
    const { strengths, weaknesses } = buildStrengthsWeaknesses(stage2)

    personalitySummary = {
      overview: {
        mingGong: `${stage2.mingGongTags.palace}（${stage2.mingGongTags.diZhi}）：${stage2.mingGongTags.summary}`,
        shenGong: `${stage2.shenGongTags.palace}（${stage2.shenGongTags.diZhi}）：${stage2.shenGongTags.summary}`,
        taiSuiGong: `${stage2.taiSuiTags.palace}（${stage2.taiSuiTags.diZhi}）：${stage2.taiSuiTags.summary}`,
        overallTone: stage2.overallTone,
      },
      traits: {
        surface: stage2.mingGongTags.selfTags.slice(0, 5),
        middle: stage2.shenGongTags.selfTags.slice(0, 5),
        core: stage2.taiSuiTags.selfTags.slice(0, 5),
      },
      fourDimensions: buildFourDimensionSynthesis(stage2.mingGongTags),
      holographicBase: {
        sihuaDirection: stage2.mingGongHolographic.sihuaDirection,
        auspiciousEffect: stage2.mingGongHolographic.auspiciousEffect,
        inauspiciousEffect: stage2.mingGongHolographic.inauspiciousEffect,
        minorEffect: stage2.mingGongHolographic.minorEffect,
        summary: stage2.mingGongHolographic.summary,
      },
      patternInfluences: buildPatternInfluences(stage1),
      strengths,
      weaknesses,
      advice: buildAdvice(stage2),
    }
  }

  return {
    version: 1,
    palaceLines,
    patternSummary,
    sihuaSummary,
    personalitySummary,
  }
}
