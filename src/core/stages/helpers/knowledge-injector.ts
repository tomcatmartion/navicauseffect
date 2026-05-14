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
} from '@/core/types'
import { getStarAttr, getStarTraitByBrightness, getPalaceMeaning } from '@/core/knowledge-dict/query'

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
 * Stage1 知识注入：格局相关星曜 + 各宫位含义概览
 */
export function injectStage1Knowledge(palaceScores: PalaceScore[]): KnowledgeSnippet[] {
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
 * Stage3 知识注入：事项宫位含义 + 星曜赋性 + 大限相关
 */
export function injectStage3Knowledge(
  primaryPalace: PalaceName,
  secondaryPalaces: PalaceName[],
  palaceScores: PalaceScore[],
  daXianMappings: DaXianPalaceMapping[],
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

  // 当前大限四化星赋性
  const currentDaXian = daXianMappings.find(d => {
    const now = new Date().getFullYear()
    return d.ageRange[0] <= (now - 1990) && d.ageRange[1] >= (now - 1990)
  })
  if (currentDaXian) {
    for (const star of currentDaXian.mutagen) {
      if (!seen.has(star)) {
        seen.add(star)
        const sSnip = starSnippet(star)
        if (sSnip) snippets.push(sSnip)
      }
    }
  }

  return snippets
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

  return snippets
}
