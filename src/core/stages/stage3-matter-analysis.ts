/**
 * Stage 3: 事项分析（可循环多轮）
 *
 * P3 阶段：事项路由 → 原局底盘分析 → 行运分析 → 流年引动 → 方向矩阵
 *
 * 数据流：
 * Stage1Output + Stage2Output + matterType + routeResult
 *   → 原局底盘（命宫全息底色 + 四维合参 + 格局护佑）
 *   → 行运分析（三层宫位对照表 + 逐大限四化引动）
 *   → 流年引动（流年命宫 × 大限命宫合参 + 方向矩阵）
 *   → injectStage3Knowledge
 *   → Stage3Output
 *
 * 模块调用：M2(评分) + M5(路由) + M6(知识注入)
 * LLM 不参与本阶段任何逻辑判断。
 */

import type {
  Stage3Input, Stage3Output, MatterAnalysis, DaXianPalaceMapping,
  DirectionMatrix, PalaceName,
} from '@/core/types'
import { getDirectionWindow } from '@/core/types'
import { buildThreeLayerTable, calculateDirectionMatrix } from './helpers/fortune-runner'
import { injectStage3Knowledge } from './helpers/knowledge-injector'

/**
 * 执行阶段三：事项分析
 */
export function executeStage3(input: Stage3Input): Stage3Output {
  const { stage1, stage2, matterType, routeResult, chartData, targetYear } = input

  // 1. 原局底盘分析
  const primaryIdx = stage1.palaceScores.findIndex(p => p.palace === routeResult.primaryPalace)
  const primaryScore = primaryIdx >= 0 ? stage1.palaceScores[primaryIdx] : null

  const primaryAnalysis: MatterAnalysis = {
    palace: routeResult.primaryPalace,
    fourDimensionResult: primaryScore
      ? `${primaryScore.tone}，${primaryScore.finalScore.toFixed(1)}分`
      : '暂无数据',
    mingGongRegulation: stage2.overallTone,
    protectionStatus: primaryScore
      ? (primaryScore.patterns.length > 0
          ? `有格局保护：${primaryScore.patterns.map(p => p.name).join('、')}`
          : '无特殊格局')
      : '未知',
    innateLevel: primaryScore?.tone ?? '未知',
  }

  // 2. 行运分析（三层宫位对照表 + 全量大限映射）
  const { table: threeLayerTable, daXianMappings: allDaXianMappings } =
    buildThreeLayerTable(stage1.scoringCtx, chartData, targetYear)

  // 3. 流年引动 + 方向矩阵
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentAge = targetYear - birthYear

  const currentDaXian = allDaXianMappings.find(
    d => d.ageRange[0] <= currentAge && d.ageRange[1] >= currentAge,
  )

  const directionMatrix = calculateDirectionMatrix(currentDaXian, targetYear, stage1.scoringCtx)
  const directionWindow = getDirectionWindow(directionMatrix)

  // 4. 知识注入（M6）
  const knowledgeSnippets = injectStage3Knowledge(
    routeResult.primaryPalace,
    routeResult.secondaryPalaces,
    stage1.palaceScores,
    allDaXianMappings,
  )

  return {
    matterType,
    primaryAnalysis,
    allDaXianMappings,
    threeLayerTable,
    directionMatrix,
    directionWindow,
    knowledgeSnippets,
  }
}
