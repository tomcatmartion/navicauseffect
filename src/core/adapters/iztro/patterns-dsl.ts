/**
 * 格局 DSL — pattern_library.json 递归条件求值
 *
 * Sprint 策略（Claude 评审）：先跑通少量核心格局，再增量扩展；当前 JSON 约 10 条，
 * `evaluateCondition` 仅支持 all/any、palace+hasMajor、named；新增原子条件时须同步扩展本文件与单测。
 */

import type { PatternRuleJson } from './types'
import { getPatternConfig } from '@/core/knowledge-dict/loader'

export interface PatternEvalContext {
  /** 宫位索引 0–11 → 主星名列表 */
  starsByPalaceIndex: string[][]
  /** 命盘上的格局名（来自引擎） */
  matchedPatternNames: Set<string>
}

function getPalaceStars(ctx: PatternEvalContext, palaceIndex: number): string[] {
  return ctx.starsByPalaceIndex[palaceIndex] ?? []
}

export function evaluateCondition(cond: Record<string, unknown>, ctx: PatternEvalContext): boolean {
  if ('all' in cond && Array.isArray(cond.all)) {
    return (cond.all as Record<string, unknown>[]).every(c => evaluateCondition(c, ctx))
  }
  if ('any' in cond && Array.isArray(cond.any)) {
    return (cond.any as Record<string, unknown>[]).some(c => evaluateCondition(c, ctx))
  }
  if (cond.palace !== undefined && typeof cond.hasMajor === 'string') {
    const idx = Number(cond.palace)
    return getPalaceStars(ctx, idx).includes(cond.hasMajor as string)
  }
  if (typeof cond.named === 'string') {
    return ctx.matchedPatternNames.has(cond.named as string)
  }
  return false
}

function getRules(): PatternRuleJson[] {
  const cfg = getPatternConfig()
  if (Array.isArray(cfg)) return cfg as PatternRuleJson[]
  // data/pattern_library.json 格式：{ multipliers, categories, patterns[] }
  // patterns[] 中条目使用 condition 字段（非 when），与 PatternRuleJson 格式不匹配
  // 此模块为旧版 DSL，主引擎已迁移到 json-evaluator.ts，此处安全返回空数组
  return []
}

export function evaluateJsonPatterns(ctx: PatternEvalContext): PatternRuleJson[] {
  const rules = getRules()
  return rules.filter(r => evaluateCondition(r.when, ctx))
}
