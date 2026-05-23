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

import type { Stage1Input, Stage1Output } from '@/core/types'
import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { evaluatePalacePatternsOnly } from '@/core/energy-evaluator/pattern-scoring'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
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

  // 4. 十二锚定格局识别（纯格局识别，与评分解耦）
  const palacePatterns = evaluatePalacePatternsOnly(scoringCtx)

  // 5. 六步宫位能级评分（消费格局结果）
  const palaceScores = evaluateAllPalaces(scoringCtx)

  // 6. 知识注入（M6）
  const knowledgeSnippets = injectStage1Knowledge(palaceScores)

  return {
    scoringCtx,
    palaceScores,
    allPatterns: palacePatterns[0] ?? [],
    mergedSihua,
    knowledgeSnippets,
    hasParentInfo: !!(input.parentBirthYears?.father || input.parentBirthYears?.mother),
  }
}
