/**
 * Stage 4: 互动关系分析（兼容层）
 *
 * ⚠️ 所有实现已迁移至 @/core/interaction-analyzer/interaction-engine.ts
 * 此文件保留为向后兼容的适配器，请勿在此添加新逻辑。
 */

import type { Stage4Input, Stage4Output } from '@/core/types'
import { executeInteractionAnalysis } from '@/core/interaction-analyzer/interaction-engine'

/**
 * 执行阶段四：互动关系分析
 *
 * 当 partnerBirthYear 有值时：完整太岁入卦 + 三维合参
 * 当 partnerBirthYear 为 null 时：降级为单方关系宫分析（E3）
 */
export function executeStage4(input: Stage4Input): Stage4Output {
  const { stage1, stage2, partnerBirthYear, chartData, targetYear, focusContext } = input

  const result = executeInteractionAnalysis({
    stage1,
    stage2,
    partnerBirthYear,
    chartData,
    targetYear,
    focusContext,
  })

  return {
    interaction: result.interaction,
    knowledgeSnippets: result.knowledgeSnippets,
  }
}
