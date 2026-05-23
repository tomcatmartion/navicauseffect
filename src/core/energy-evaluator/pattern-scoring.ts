/**
 * 锚定宫格局识别 — 原局/大限/流年/小限共用内核
 *
 * 对每个 anchorIdx (0..11)：
 * - buildChartAccessor(ctx, anchorIdx) → 格局匹配 → palacePatterns[anchorIdx]
 *
 * 格局识别与宫位能级评分已解耦，评分由调用方自行调用 evaluateAllPalaces。
 */

import type { PatternMatch } from '@/core/types'
import { allPatterns } from './patterns'
import type { ChartAccessor } from './patterns/types'
import type { ScoringContext } from './scoring-flow'
import { getPatternDefinition, getPatternMultiplierByLevel } from '../knowledge-dict/loader'

/**
 * 对 12 个锚定宫各跑格局识别（纯格局识别，不含评分）
 * 会写入 ctx.palacePatterns / ctx.patterns（命宫锚定兼容）
 *
 * 格局识别与宫位能级评分已解耦：
 * - 格局识别：本函数 evaluatePalacePatternsOnly
 * - 宫位能级评分：evaluateAllPalaces（scoring-flow.ts）
 * 调用方需自行编排两者。
 */
export function evaluatePalacePatternsOnly(ctx: ScoringContext): PatternMatch[][] {
  const palacePatterns: PatternMatch[][] = []

  for (let anchorIdx = 0; anchorIdx < 12; anchorIdx++) {
    const accessor = buildChartAccessor(ctx, anchorIdx)
    palacePatterns[anchorIdx] = allPatterns
      .filter(p => p.evaluate(accessor))
      .map(p => {
        const def = getPatternDefinition(p.name)
        return {
          name: p.name,
          level: p.level,
          multiplier: def?.multiplier ?? getPatternMultiplierByLevel(p.level) ?? 1.0,
          category: p.category,
        }
      })
  }

  ctx.patterns = palacePatterns[0] ?? []
  ctx.palacePatterns = palacePatterns

  return palacePatterns
}

/**
 * 构建 ChartAccessor（供格局判定使用）
 */
export function buildChartAccessor(ctx: ScoringContext, anchorPalaceIndex: number = 0): ChartAccessor {
  const palaces = ctx.palaces

  return {
    getStarsInPalace(idx: number) {
      return palaces[idx]?.majorStars ?? []
    },
    getAuxStarsInPalace(idx: number) {
      const p = palaces[idx]
      if (!p) return []
      const majorNames = new Set(p.majorStars.map(ms => ms.star as string))
      return p.stars.filter(s => !majorNames.has(s.name)).map(s => s.name)
    },
    hasStarInPalace(idx: number, star: string) {
      const p = palaces[idx]
      if (!p) return false
      return p.stars.some(s => s.name === star) || p.majorStars.some(ms => ms.star === star)
    },
    hasSihuaInPalace(idx: number, type: '化禄' | '化权' | '化科' | '化忌', _source?: string) {
      const p = palaces[idx]
      if (!p) return false
      // 当 source 指定了具体星名时，只匹配该星的四化
      if (_source && _source !== '命造' && _source !== '父亲' && _source !== '母亲' && _source !== '太岁宫宫干四化') {
        return p.stars.some(s => s.sihua === type && s.name === _source)
      }
      return p.stars.some(s => s.sihua === type)
    },
    getPalaceBrightness(idx: number) {
      return palaces[idx]?.brightness ?? '平'
    },
    getPalaceDiZhi(idx: number) {
      return palaces[idx]?.diZhi ?? '子'
    },
    getOppositeIndex(idx: number) {
      return (idx + 6) % 12
    },
    getTrineIndices(idx: number) {
      return [(idx + 4) % 12, (idx + 8) % 12]
    },
    getFlankingIndices(idx: number) {
      return [(idx + 1) % 12, (idx - 1 + 12) % 12]
    },
    hasFlanking(idx: number) {
      const [left, right] = [(idx + 1) % 12, (idx - 1 + 12) % 12]
      return (palaces[left]?.stars.length ?? 0) > 0 && (palaces[right]?.stars.length ?? 0) > 0
    },
    countAuspiciousInPalaces(indices: number[]) {
      const auspicious = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'])
      let count = 0
      for (const idx of indices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (auspicious.has(s.name)) count++
          if (s.sihua === '化禄') count++
        }
      }
      return count
    },
    countInauspiciousInPalaces(indices: number[]) {
      const inauspicious = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'])
      let count = 0
      for (const idx of indices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (inauspicious.has(s.name)) count++
          if (s.sihua === '化忌') count++
        }
      }
      return count
    },
    mingGongIndex: 0,
    shenGongIndex: ctx.shenGongIndex ?? findShenGongFallback(palaces),
    anchorPalaceIndex,
    birthGan: ctx.birthGan,
    birthZhi: palaces[0]?.diZhi ?? '子',
    hasStarSihua(star: string, type: '化禄' | '化权' | '化科' | '化忌') {
      for (const p of palaces) {
        for (const s of p.stars) {
          if (s.name === star && s.sihua === type) return true
        }
      }
      return false
    },
    countSihuaInPalacesFromSource(palaceIndices: number[], type: string, _source: string) {
      let count = 0
      for (const idx of palaceIndices) {
        const p = palaces[idx]
        if (!p) continue
        for (const s of p.stars) {
          if (s.sihua === type) {
            // 当 source 指定了具体星名时，只统计该星的四化
            if (_source && _source !== '命造' && _source !== '父亲' && _source !== '母亲' && _source !== '太岁宫宫干四化') {
              if (s.name === _source) count++
            } else if (_source && (s.sihuaSource === _source)) {
              count++
            } else {
              count++
            }
          }
        }
      }
      return count
    },
  }
}

function findShenGongFallback(_palaces: ScoringContext['palaces']): number {
  return 6
}
