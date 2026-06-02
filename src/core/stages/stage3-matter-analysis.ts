/**
 * Stage 3: 事项分析（可循环多轮）
 *
 * P3 阶段：事项路由 → 原局底盘分析 → 行运分析 → 流年引动 → 方向矩阵
 * 由 matter-limit-engine 按 limit_direction.json analysisFlow 执行。
 */

import type { Stage3Input, Stage3Output } from '@/core/types'
import { executeMatterLimitAnalysis } from '@/core/limit-analyzer/matter-limit-engine'

/**
 * 执行阶段三：事项分析
 */
export function executeStage3(input: Stage3Input): Stage3Output {
  const result = executeMatterLimitAnalysis(input)
  return {
    matterType: input.matterType,
    ...result,
  }
}
