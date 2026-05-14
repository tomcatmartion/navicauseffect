/**
 * Stage 1: 命盘生成 + 宫位评分
 *
 * P1 阶段：系统排盘 → 四化计算 → 格局匹配 → 十二宫评分
 *
 * 数据流：
 * iztro JSON → convertIztroToScoringContext → calculateOriginalSihua
 *   → applySihuaAndAnnotate（四化标注+落宫标注） → allPatterns.match
 *   → evaluateAllPalaces → injectStage1Knowledge → Stage1Output
 *
 * 模块调用：M1(四化) + M2(评分) + M6(知识注入)
 * LLM 不参与本阶段任何逻辑判断。
 */

import type { Stage1Input, Stage1Output, PatternMatch } from '@/core/types'
import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { evaluateAllPalaces, allPatterns } from '@/core/energy-evaluator'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import type { ChartAccessor } from '@/core/energy-evaluator/patterns/types'
import type { PalaceBrightness, MajorStar, DiZhi } from '@/core/types'
import { convertIztroToScoringContext } from './helpers/chart-converter'
import { applySihuaAndAnnotate } from './helpers/sihua-applier'
import { injectStage1Knowledge } from './helpers/knowledge-injector'

/**
 * 执行阶段一：命盘生成 + 宫位评分
 */
export function executeStage1(input: Stage1Input): Stage1Output {
  // 1. iztro 命盘 → ScoringContext
  const scoringCtx = convertIztroToScoringContext(input.chartData)

  // 2. 计算原局四化（生年 + 太岁宫宫干四化，宫干来自五虎遁）
  const rawSihua = calculateOriginalSihua(scoringCtx.birthGan, scoringCtx.taiSuiZhi)

  // 3. 四化标注到宫位星曜 + 生成落宫标注（合并为完整 mergedSihua）
  const mergedSihua = applySihuaAndAnnotate(scoringCtx, rawSihua)

  // 4. 格局匹配
  const accessor = buildChartAccessor(scoringCtx)
  const matchedPatterns = allPatterns
    .filter(p => p.evaluate(accessor))
    .map(p => ({
      name: p.name,
      level: p.level,
      multiplier: p.level === '大吉' ? 1.5 : p.level === '中吉' ? 1.3 : p.level === '中凶' ? 0.7 : p.level === '大凶' ? 0.5 : 1.0,
      category: p.category,
    }))
  scoringCtx.patterns = matchedPatterns

  // 5. 十二宫评分（M2 六步评分）
  const palaceScores = evaluateAllPalaces(scoringCtx)

  // 6. 知识注入（M6）
  const knowledgeSnippets = injectStage1Knowledge(palaceScores)

  return {
    scoringCtx,
    palaceScores,
    allPatterns: matchedPatterns,
    mergedSihua,
    knowledgeSnippets,
    hasParentInfo: !!(input.parentBirthYears?.father || input.parentBirthYears?.mother),
  }
}

// ── ChartAccessor 适配器 ──────────────────────────────────

/**
 * 构建 ChartAccessor（供格局判定使用）
 * 适配 ScoringContext 到 PatternPredicate 所需的接口
 */
function buildChartAccessor(ctx: ScoringContext): ChartAccessor {
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
      // 当前原局阶段只有命造来源，source 过滤在行运阶段生效
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
      return [(idx - 1 + 12) % 12, (idx + 1) % 12]
    },
    hasFlanking(idx: number) {
      const [left, right] = [(idx - 1 + 12) % 12, (idx + 1) % 12]
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
          if (s.sihua === type) count++
        }
      }
      return count
    },
  }
}

function findShenGongFallback(palaces: ScoringContext['palaces']): number {
  // 身宫在 iztro 的宫位数据中有 isBodyPalace 标记
  // 此处为 ScoringContext 未设置 shenGongIndex 时的回退
  return 6
}
