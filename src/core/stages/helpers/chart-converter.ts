/**
 * Helper: iztro 命盘数据转换器
 *
 * 将前端传入的 iztro 命盘 JSON 转换为 ScoringContext（评分上下文）。
 * 核心逻辑已迁移到 data-reader/iztro-reader.ts，此文件保留为兼容层。
 *
 * 关键修正（vs 旧版）：
 * 1. 太岁宫地支 = 生年地支（出生年地支），独立于命宫位置
 *    来源：SKILL_宫位原生能级评估 "命主生年地支 = 太岁宫"
 *    注意：SKILL_原局四化读取规则中 earthlyBranchOfSoulPalace 的标注是错误的字段映射
 * 2. 每宫完整读取 majorStars + minorStars + adjectiveStars（丙丁级）
 * 3. 宫位按 PALACE_NAMES 顺序重排（iztro 从寅宫 index=0 开始）
 */

import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import type { TianGan, DiZhi } from '@/core/types'
import { readChartFromData, normalizedChartToScoringContext } from '@/core/data-reader/iztro-reader'

export { extractBirthGan } from '@/core/data-reader/iztro-reader'

/**
 * 将 iztro 命盘 JSON 转换为评分上下文
 *
 * 使用 data-reader/iztro-reader 的标准化流程。
 */
export function convertIztroToScoringContext(chartData: Record<string, unknown>): ScoringContext {
  const chart = readChartFromData(chartData)
  return normalizedChartToScoringContext(chart)
}

/** 从 chartData 获取身宫索引（重排后 PALACE_NAMES 顺序） */
export function findShenGongFromChart(chartData: Record<string, unknown>): number {
  const chart = readChartFromData(chartData)
  for (let i = 0; i < chart.palaces.length; i++) {
    if (chart.palaces[i].isBodyPalace) return i
  }
  return 6 // 默认对宫
}

/**
 * 从 chartData 获取太岁宫地支
 *
 * 太岁宫 = 生年地支（独立于命宫位置）
 * 来源：SKILL_宫位原生能级评估 "命主生年地支 = 太岁宫"
 */
export function getTaiSuiZhi(chartData: Record<string, unknown>): DiZhi {
  const chart = readChartFromData(chartData)
  return chart.taiSuiZhi
}

/**
 * 从 chartData 获取出生天干
 */
export function getBirthGan(chartData: Record<string, unknown>): TianGan {
  const chart = readChartFromData(chartData)
  return chart.birthGan
}
