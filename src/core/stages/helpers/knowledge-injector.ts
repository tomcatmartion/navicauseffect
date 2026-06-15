/**
 * Helper: 知识注入器
 *
 * 在每个阶段从 M6 知识字典查询相关片段，注入到 IR 供 M7 使用。
 * 所有查询基于精确 KV，严禁向量检索。
 *
 * 注入策略：
 * - Stage1: 格局相关星曜赋性 + 宫位含义（概览）
 * - Stage2: 命宫主星赋性 + 宫位含义（性格相关）
 * - Stage3: 事项宫位含义 + 星曜赋性 + 大限星曜赋性
 * - Stage4: 互动取象规则 + 忌星三维取象 + 四化注入能量
 */

import type {
  KnowledgeSnippet,
  PalaceScore,
  PalaceName,
  MajorStar,
  DaXianPalaceMapping,
  SihuaType,
  MatterType,
} from '@/core/types'
import { getStarAttr, getStarTraitByBrightness, getPalaceMeaning } from '@/core/knowledge-dict/query'
import { getInteractionQuXiang, getPersonalityTriad } from '@/core/knowledge-dict/loader'
import { findCurrentDaXianFromChart } from '@/core/limit-analyzer/fortune-engine'
import {
  getMatterPersonalityInfluence,
  getFourDimensionFocus,
} from '@/core/knowledge-dict/limit-direction'

/** 构建"星曜赋性"片段 */
function starSnippet(star: string, brightness?: string): KnowledgeSnippet | null {
  const attr = getStarAttr(star as MajorStar)
  if (!attr) return null
  const trait = brightness
    ? getStarTraitByBrightness(star as MajorStar, brightness as Parameters<typeof getStarTraitByBrightness>[1])
    : attr.coreTrait
  return {
    source: '星曜赋性',
    key: star,
    content: `${star}：${attr.coreTrait}。正面：${attr.positiveTrait}。负面：${attr.negativeTrait}。${brightness ? `在${brightness}宫时：${trait}` : ''}`,
  }
}

/** 构建"宫位含义"片段 */
function palaceSnippet(palace: PalaceName): KnowledgeSnippet | null {
  const meaning = getPalaceMeaning(palace)
  if (!meaning) return null
  return {
    source: '宫位含义',
    key: palace,
    content: `${palace}宫：${meaning.meaning}`,
  }
}

/**
 * Stage1 知识注入：格局相关星曜 + 各宫位含义概览 + 当前大限四化星赋性
 */
export function injectStage1Knowledge(
  palaceScores: PalaceScore[],
  currentDaXianMapping?: import('@/core/types').DaXianPalaceMapping,
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = []
  const seenStars = new Set<string>()

  for (const score of palaceScores) {
    // 各宫位含义
    const pSnip = palaceSnippet(score.palace)
    if (pSnip) snippets.push(pSnip)

    // 主星赋性
    for (const ms of score.majorStars) {
      if (!seenStars.has(ms.star)) {
        seenStars.add(ms.star)
        const sSnip = starSnippet(ms.star, ms.brightness)
        if (sSnip) snippets.push(sSnip)
      }
    }

    // 四化星赋性
    for (const p of score.patterns) {
      const sSnip = starSnippet(p.name)
      if (sSnip && !seenStars.has(p.name)) {
        seenStars.add(p.name)
        snippets.push(sSnip)
      }
    }
  }

  // 当前大限四化星的赋性知识注入
  if (currentDaXianMapping?.mutagen) {
    for (const star of currentDaXianMapping.mutagen) {
      if (star && !seenStars.has(star)) {
        seenStars.add(star)
        const sSnip = starSnippet(star)
        if (sSnip) snippets.push(sSnip)
      }
    }
  }

  return snippets
}

/**
 * Stage2 知识注入：命宫/身宫/太岁宫主星赋性 + 宫位含义
 */
export function injectStage2Knowledge(
  focusPalaces: Array<{ name: PalaceName; stars: Array<{ star: string; brightness?: string }> }>,
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = []
  const seen = new Set<string>()

  for (const fp of focusPalaces) {
    const pSnip = palaceSnippet(fp.name)
    if (pSnip) snippets.push(pSnip)

    for (const s of fp.stars) {
      const key = `${s.star}_${s.brightness ?? ''}`
      if (!seen.has(key)) {
        seen.add(key)
        const sSnip = starSnippet(s.star, s.brightness)
        if (sSnip) snippets.push(sSnip)
      }
    }
  }

  return snippets
}

/**
 * Stage2 丙丁级星曜知识注入补充
 * 数据来源：data/personality_triad.json → extra_stars_rules.丙丁级星曜集
 */
export function injectStage2MinorStarKnowledge(
  minorStarNames: string[],
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = []
  const minorConfig = getPersonalityTriad().extra_stars_rules.丙丁级星曜集
  if (!minorConfig) return snippets

  for (const name of minorStarNames) {
    const trait = minorConfig[name]
    if (trait) {
      snippets.push({
        source: '丙丁级星曜赋性',
        key: name,
        content: `${name}：${trait}`,
      })
    }
  }

  return snippets
}

/**
 * Stage3 知识注入：事项宫位含义 + 星曜赋性 + 大限/流年完整数据
 */
export function injectStage3Knowledge(
  primaryPalace: PalaceName,
  secondaryPalaces: PalaceName[],
  palaceScores: PalaceScore[],
  daXianMappings: DaXianPalaceMapping[],
  matterType?: MatterType,
  targetYear?: number,
  birthYear?: number,
  chartData?: Record<string, unknown>,
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = []
  const seen = new Set<string>()

  // 主看宫位含义
  const primary = palaceSnippet(primaryPalace)
  if (primary) snippets.push(primary)

  // 兼看宫位含义
  for (const sp of secondaryPalaces) {
    const sSnip = palaceSnippet(sp)
    if (sSnip) snippets.push(sSnip)
  }

  // 主看宫位主星赋性
  const primaryScore = palaceScores.find(p => p.palace === primaryPalace)
  if (primaryScore) {
    for (const ms of primaryScore.majorStars) {
      if (!seen.has(ms.star)) {
        seen.add(ms.star)
        const sSnip = starSnippet(ms.star, ms.brightness)
        if (sSnip) snippets.push(sSnip)
      }
    }
  }

  // 当前大限四化星赋性（从 horoscope.decadal 匹配）
  const year = targetYear ?? new Date().getFullYear()
  const safeBirthYear = birthYear ?? 1990
  const currentDaXian = findCurrentDaXianFromChart(daXianMappings, year, safeBirthYear, chartData)
  if (currentDaXian) {
    // 大限四化星赋性
    for (const star of currentDaXian.mutagen) {
      if (!seen.has(star)) {
        seen.add(star)
        const sSnip = starSnippet(star)
        if (sSnip) snippets.push(sSnip)
      }
    }

    // 大限十二宫摘要（天干、地支、星曜、四化、格局、评分）
    const daXianSummaryLines = buildDaXianPalaceSummary(currentDaXian, palaceScores)
    if (daXianSummaryLines.length > 0) {
      snippets.push({
        source: '大限数据',
        key: `大限_${currentDaXian.ageRange[0]}-${currentDaXian.ageRange[1]}_十二宫摘要`,
        content: `当前大限（第${currentDaXian.index}限，${currentDaXian.ageRange[0]}-${currentDaXian.ageRange[1]}岁），宫干${currentDaXian.daXianGan}，命宫在${currentDaXian.mingPalaceName}。\n四化：${currentDaXian.mutagen.join('、')}\n十二宫数据：\n${daXianSummaryLines.join('\n')}`,
      })
    }

    // 大限格局列表
    const daXianPatterns = currentDaXian.scores?.flatMap(s => s.patterns) ?? []
    const uniquePatterns = [...new Map(daXianPatterns.map(p => [p.name, p])).values()]
    if (uniquePatterns.length > 0) {
      snippets.push({
        source: '大限数据',
        key: `大限_格局列表`,
        content: `大限格局：${uniquePatterns.map(p => `${p.name}（${p.level}，乘数${p.multiplier}）`).join('；')}`,
      })
    }

    // 大限两夹宫信息
    const daXianFlanking = currentDaXian.scores?.flatMap(s =>
      s.flankingPairs.map(fp => `${s.palace}：${fp.displayName}[${fp.pairType}]`)
    ) ?? []
    if (daXianFlanking.length > 0) {
      snippets.push({
        source: '大限数据',
        key: `大限_两夹宫`,
        content: `大限两夹宫：${daXianFlanking.join('；')}`,
      })
    }
  }

  if (matterType) {
    const personalityInfluence = getMatterPersonalityInfluence(matterType)
    if (personalityInfluence) {
      snippets.push({
        source: '限运方向',
        key: `${matterType}_性格影响`,
        content: personalityInfluence,
      })
    }
    const fourFocus = getFourDimensionFocus(matterType)
    if (fourFocus.length) {
      snippets.push({
        source: '限运方向',
        key: `${matterType}_四维焦点`,
        content: `事项四维分析焦点：${fourFocus.join('；')}`,
      })
    }
  }

  return snippets
}

/**
 * 构建大限十二宫摘要文本
 *
 * 从 natalScores 获取原局宫名和地支，从 daXian.scores 获取大限独立评分
 */
function buildDaXianPalaceSummary(
  daXian: DaXianPalaceMapping,
  natalScores: PalaceScore[],
): string[] {
  const lines: string[] = []
  const scores = daXian.scores

  // 大限命宫在原局的索引
  const mingIdx = daXian.palaceIndex

  for (let i = 0; i < 12; i++) {
    // 大限第i宫对应的原局宫位索引
    const originalIdx = (mingIdx + i) % 12
    const natalScore = natalScores[originalIdx]
    const daXianScore = scores?.[i]

    const palaceName = natalScore?.palace ?? `宫${i + 1}`
    const diZhi = natalScore?.diZhi ?? '?'
    const majorStars = natalScore?.majorStars.map(s => s.star).join('+') ?? '空'
    const score = daXianScore?.finalScore ?? natalScore?.finalScore ?? 0
    const level = score >= 6.5 ? '吉旺' : score >= 3.5 ? '平' : '凶弱'

    lines.push(`  ${palaceName}(${diZhi})：${majorStars}，评分${score.toFixed(1)}（${level}）`)
  }

  return lines
}

/**
 * Stage4 知识注入：互动取象 + 忌星三维取象 + 四化能量表
 */
export function injectStage4Knowledge(
  partnerStars: Array<{ star: string; sihuaType?: SihuaType }>,
  tensionStars: string[],
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = []
  const seen = new Set<string>()

  // 入卦星曜赋性
  for (const ps of partnerStars) {
    if (!seen.has(ps.star)) {
      seen.add(ps.star)
      const sSnip = starSnippet(ps.star)
      if (sSnip) snippets.push(sSnip)
    }
  }

  // 忌星三维取象（化忌相关星曜的负面特质）
  const jiStars = partnerStars.filter(s => s.sihuaType === '化忌')
  for (const js of jiStars) {
    const attr = getStarAttr(js.star as MajorStar)
    if (attr) {
      snippets.push({
        source: '互动取象',
        key: `${js.star}_化忌取象`,
        content: `${js.star}化忌在互动中的表现：${attr.negativeTrait}。容易引发${attr.specialNote ?? '摩擦与误解'}。`,
      })
    }
  }

  // 张力点星曜
  for (const ts of tensionStars) {
    if (!seen.has(ts)) {
      seen.add(ts)
      const sSnip = starSnippet(ts)
      if (sSnip) snippets.push(sSnip)
    }
  }

  // 四化注入能量描述
  const luStars = partnerStars.filter(s => s.sihuaType === '化禄')
  for (const ls of luStars) {
    const attr = getStarAttr(ls.star as MajorStar)
    if (attr) {
      snippets.push({
        source: '四化能量',
        key: `${ls.star}_化禄能量`,
        content: `${ls.star}化禄带来的正面能量：${attr.positiveTrait}。在互动中表现为给予和支持。`,
      })
    }
  }

  const rules = getInteractionQuXiang()
  const advice = rules.adjustableAdvice as Record<string, { trigger?: string; text?: string }> | undefined
  const defaultAdvice = advice?.default?.text
  if (defaultAdvice) {
    snippets.push({
      source: '互动取象',
      key: 'adjustableAdvice_default',
      content: defaultAdvice,
    })
  }
  if (jiStars.length >= 2 && advice?.doubleJi?.text) {
    snippets.push({
      source: '互动取象',
      key: 'adjustableAdvice_doubleJi',
      content: advice.doubleJi.text,
    })
  }

  return snippets
}
