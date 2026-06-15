/**
 * Stage 1: 命盘生成 + 宫位评分 + 全量大限预评分
 *
 * P1 阶段：系统排盘 → 四化计算 → 格局匹配 → 十二宫评分 → 全量大限评分
 *
 * 数据流：
 * iztro JSON → convertIztroToScoringContext → calculateOriginalSihua
 *   → applySihuaAndAnnotate（四化标注+落宫标注） → allPatterns.match
 *   → evaluateAllPalaces → 全量大限增量评分 → injectStage1Knowledge → Stage1Output
 *
 * 模块调用：M1(四化) + M2(评分) + M3(大限) + M6(知识注入)
 * LLM 不参与本阶段任何逻辑判断。
 */

import type { Stage1Input, Stage1Output } from '@/core/types'
import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { evaluatePalacePatternsOnly } from '@/core/energy-evaluator/pattern-scoring'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { readChartFromData, normalizedChartToScoringContext } from '@/core/data-reader/iztro-reader'
import { applySihuaAndAnnotate } from './helpers/sihua-applier'
import { injectStage1Knowledge } from './helpers/knowledge-injector'
import { extractAllDaXianMappings } from '@/core/limit-analyzer/fortune-engine'
import { buildDaXianScoringContext } from '@/core/limit-analyzer/limit-scoring-context'
import { scoreLayerByDelta } from '@/core/energy-evaluator/layer-delta-scoring'

/** 从 chartData 提取出生年份（用于计算当前年龄和大限定位） */
function extractBirthYear(chartData: Record<string, unknown>): number {
  // 优先从 birthInfo.year
  const birthInfo = chartData.birthInfo as { year?: number } | undefined
  if (birthInfo?.year) return birthInfo.year
  // 回退到 solarDate 解析
  const solarDate = chartData.solarDate as string | undefined
  if (solarDate) {
    const match = solarDate.match(/^(\d{4})/)
    if (match) return parseInt(match[1], 10)
  }
  // 兜底：假设 30 岁
  return new Date().getFullYear() - 30
}

/** 根据大限命宫评分给出定性 */
function deriveDaXianTone(scores: import('@/core/types').PalaceScore[] | undefined): string {
  if (!scores?.length) return '待评估'
  // 找大限命宫（通常是 scores 中排在第一位的，或者找最高分的宫位）
  const avg = scores.reduce((sum, p) => sum + p.finalScore, 0) / scores.length
  if (avg >= 6.0) return '顺畅期'
  if (avg >= 5.0) return '转机期'
  if (avg >= 3.5) return '艰辛期'
  return '危机期'
}

/**
 * 执行阶段一：命盘生成 + 宫位评分
 */
export function executeStage1(input: Stage1Input): Stage1Output {
  // 1. iztro 命盘 → NormalizedChart → ScoringContext
  const chart = readChartFromData(input.chartData)
  const scoringCtx = normalizedChartToScoringContext(chart, input.parentBirthYears)

  // 2. 计算原局四化（生年 + 太岁宫宫干四化，宫干来自五虎遁）
  const rawSihua = calculateOriginalSihua(scoringCtx.birthGan, scoringCtx.taiSuiZhi)

  // 3. 四化标注到宫位星曜 + 生成落宫标注（合并为完整 mergedSihua）
  const mergedSihua = applySihuaAndAnnotate(scoringCtx, rawSihua)

  // 4. 十二锚定格局识别（纯格局识别，与评分解耦）
  const palacePatterns = evaluatePalacePatternsOnly(scoringCtx)

  // 5. 六步宫位能级评分（消费格局结果）
  const palaceScores = evaluateAllPalaces(scoringCtx)

  // 5.5 全量大限评分（增量模式：在原局评分基础上叠加每个大限的四化增量）
  const birthYear = extractBirthYear(input.chartData)
  const targetYear = new Date().getFullYear()
  const daXianMappings = extractAllDaXianMappings(input.chartData, birthYear)

  for (const mapping of daXianMappings) {
    try {
      const daXianCtx = buildDaXianScoringContext(mapping, scoringCtx)
      if (!daXianCtx) continue
      const dxPatterns = evaluatePalacePatternsOnly(daXianCtx)
      mapping.scores = scoreLayerByDelta(palaceScores, {
        layerCtx: daXianCtx,
        layerLabel: '大限',
        palacePatterns: dxPatterns,
      })
      mapping.palacePatterns = dxPatterns
      mapping.patterns = dxPatterns[mapping.palaceIndex] ?? dxPatterns[0] ?? []
    } catch (err) {
      console.warn(`[Stage1] 大限${mapping.index}评分失败:`, err)
    }
  }

  const currentAge = targetYear - birthYear + 1
  const currentDaXianMapping = daXianMappings.find(d =>
    currentAge >= d.ageRange[0] && currentAge <= d.ageRange[1],
  )

  // 6. 知识注入（M6，传入当前大限信息用于注入大限四化星赋性）
  const knowledgeSnippets = injectStage1Knowledge(palaceScores, currentDaXianMapping)

  return {
    scoringCtx,
    palaceScores,
    allPatterns: palacePatterns[0] ?? [],
    mergedSihua,
    knowledgeSnippets,
    hasParentInfo: !!(input.parentBirthYears?.father || input.parentBirthYears?.mother),
    allDaXianSummary: daXianMappings.map(d => ({
      index: d.index,
      ageRange: `${d.ageRange[0]}-${d.ageRange[1]}`,
      daXianGan: d.daXianGan,
      mingPalaceName: d.mingPalaceName,
      sihuaStars: d.mutagen,
      isCurrent: currentDaXianMapping?.index === d.index,
      palaceScores: d.scores ?? [],
      topPatterns: (d.patterns ?? []).map(p => `${p.name}(${p.level})`),
    })),
    currentDaXian: currentDaXianMapping ? {
      index: currentDaXianMapping.index,
      ageRange: `${currentDaXianMapping.ageRange[0]}-${currentDaXianMapping.ageRange[1]}岁`,
      daXianGan: currentDaXianMapping.daXianGan,
      mingPalaceName: currentDaXianMapping.mingPalaceName,
      sihuaPositions: currentDaXianMapping.mutagen.map((star, i) => {
        const types = ['化禄', '化权', '化科', '化忌']
        return `${types[i]}${star}`
      }),
      tone: deriveDaXianTone(currentDaXianMapping.scores),
      palaceScores: currentDaXianMapping.scores ?? [],
    } : undefined,
  }
}
