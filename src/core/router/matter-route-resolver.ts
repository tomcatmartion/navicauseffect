/**
 * 事项路由解析 — 合并显式 answers 与对话规则提取
 */

import type { MatterRouteResult, MatterType } from '../types'
import { extractAnswersFromDialog } from './answer-extractor'
import { routeMatter } from './decision-tree'

export interface ResolvedMatterRoute extends MatterRouteResult {
  /** 实际参与路由的 answers */
  routingAnswers: Record<string, string>
  /** 规则提取置信度（0–1） */
  extractConfidence: number
  /** 未能从对话中提取的字段 */
  missingFields: string[]
}

export interface ResolveMatterRouteOptions {
  /** API/调试传入的合伙人生年 → 映射为 wealth_3b=has */
  partnerBirthYear?: number | null
}

/** 将非决策树字段（如 partnerBirthYear）映射为 router.json 条件字段 */
export function normalizeRoutingAnswers(
  matterType: MatterType,
  answers: Record<string, string>,
  partnerBirthYear?: number | null,
): Record<string, string> {
  const out: Record<string, string> = { ...answers }

  if (matterType === '求财') {
    const hasPartnerYear =
      (partnerBirthYear != null && Number.isFinite(partnerBirthYear)) ||
      Boolean(out.partnerBirthYear)
    if (hasPartnerYear) {
      out.wealth_3b = 'has'
      if (!out.wealth_3) out.wealth_3 = 'partner'
    }
  }

  return out
}

export function resolveMatterRoute(
  matterType: MatterType,
  question?: string,
  explicitAnswers?: Record<string, string>,
  options?: ResolveMatterRouteOptions,
): ResolvedMatterRoute {
  const routingAnswers: Record<string, string> = { ...(explicitAnswers ?? {}) }
  let extractConfidence = 0
  let missingFields: string[] = []

  const dialog = question?.trim()
  if (dialog) {
    const extracted = extractAnswersFromDialog(dialog, matterType)
    extractConfidence = extracted.confidence
    missingFields = extracted.missingFields
    for (const [key, value] of Object.entries(extracted.answers)) {
      if (!routingAnswers[key]) routingAnswers[key] = value
    }
  }

  const normalized = normalizeRoutingAnswers(
    matterType,
    routingAnswers,
    options?.partnerBirthYear,
  )

  const route = routeMatter(matterType, normalized)
  return {
    ...route,
    routingAnswers: normalized,
    extractConfidence,
    missingFields,
  }
}
