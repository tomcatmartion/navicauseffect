/**
 * M5: 事项路由 — 决策树
 *
 * 职责：根据用户回答序列，确定事项类型、主看宫位、兼看宫位
 *       6分支决策树：求学/求爱/求财/求职/求健康/求名
 *
 * 数据来源：data/router_tree.json（支持热加载）
 */

import type { MatterType, MatterRouteResult, PalaceName } from '../types'
import { getRouterTree } from '../knowledge-dict/loader'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

export interface RouteQuestion {
  id: string
  question: string
  options: RouteOption[]
}

export interface RouteOption {
  label: string
  value: string
  next: string | 'result'
}

export interface RouteResult {
  primaryPalace: PalaceName
  secondaryPalaces: PalaceName[]
  specialConditions: string[]
  needInteraction: boolean
}

interface BranchResolver {
  primaryPalace?: string
  primaryRules?: Array<{ condition: string; palace: string }>
  defaultPrimary?: string
  secondaryRules?: Array<{ condition: string; palace: string }>
  secondaryPalaces?: string[]
  specialConditions?: Array<string | { condition: string; text: string }>
  needInteraction?: boolean
  needInteractionRules?: string[]
}

interface BranchData {
  resolver: BranchResolver
  questions: Record<string, RouteQuestion>
  firstQuestion: string
}

interface RouterTreeData {
  branches: Record<string, BranchData>
  intentDetection: Array<{ keywords: string[]; type: string }>
}

// ═══════════════════════════════════════════════════════════════════
// 路由解析
// ═══════════════════════════════════════════════════════════════════

function evaluateCondition(condition: string, answers: Record<string, string>): boolean {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('answers', `return (${condition})`)
    return fn(answers)
  } catch {
    return false
  }
}

function resolveBranch(matterType: MatterType, answers: Record<string, string>): RouteResult {
  const tree = getRouterTree() as unknown as RouterTreeData
  const branch = tree.branches[matterType]
  if (!branch) {
    return { primaryPalace: '命宫', secondaryPalaces: [], specialConditions: [], needInteraction: false }
  }

  const resolver = branch.resolver
  const secondary: PalaceName[] = []
  const specialConditions: string[] = []

  // 解析主宫位
  let primaryPalace: PalaceName = '命宫'
  if ('primaryPalace' in resolver) {
    primaryPalace = resolver.primaryPalace as PalaceName
  } else if ('primaryRules' in resolver) {
    const primaryRules = resolver.primaryRules as Array<{ condition: string; palace: string }>
    for (const rule of primaryRules) {
      if (evaluateCondition(rule.condition, answers)) {
        primaryPalace = rule.palace as PalaceName
        break
      }
    }
    if (primaryPalace === '命宫' && resolver.defaultPrimary) {
      primaryPalace = resolver.defaultPrimary as PalaceName
    }
  }

  // 解析兼看宫位
  if (resolver.secondaryRules) {
    for (const rule of resolver.secondaryRules) {
      if (evaluateCondition(rule.condition, answers)) {
        if (!secondary.includes(rule.palace as PalaceName)) {
          secondary.push(rule.palace as PalaceName)
        }
      }
    }
  }

  // 解析特殊条件
  if (resolver.specialConditions) {
    for (const cond of resolver.specialConditions) {
      if (typeof cond === 'string') {
        specialConditions.push(cond)
      } else if (evaluateCondition(cond.condition, answers)) {
        specialConditions.push(cond.text)
      }
    }
  }

  // 解析是否需要互动关系
  let needInteraction = false
  if (resolver.needInteraction !== undefined) {
    needInteraction = resolver.needInteraction as boolean
  } else if (resolver.needInteractionRules) {
    for (const rule of resolver.needInteractionRules) {
      if (evaluateCondition(rule, answers)) {
        needInteraction = true
        break
      }
    }
  }

  return { primaryPalace, secondaryPalaces: secondary, specialConditions, needInteraction }
}

// ═══════════════════════════════════════════════════════════════════
// 统一路由接口
// ═══════════════════════════════════════════════════════════════════

/** 获取各事项的问题集合 */
export function getMatterQuestions(): Record<MatterType, Record<string, RouteQuestion>> {
  const tree = getRouterTree() as unknown as RouterTreeData
  const result: Record<string, Record<string, RouteQuestion>> = {}
  for (const [matterType, branch] of Object.entries(tree.branches)) {
    result[matterType] = branch.questions
  }
  return result as Record<MatterType, Record<string, RouteQuestion>>
}

/** 获取各事项的首问题ID */
export function getMatterFirstQuestion(): Record<MatterType, string> {
  const tree = getRouterTree() as unknown as RouterTreeData
  const result: Record<string, string> = {}
  for (const [matterType, branch] of Object.entries(tree.branches)) {
    result[matterType] = branch.firstQuestion
  }
  return result as Record<MatterType, string>
}

/**
 * 完整事项路由
 */
export function routeMatter(matterType: MatterType, answers: Record<string, string>): MatterRouteResult {
  const result = resolveBranch(matterType, answers)

  return {
    matterType,
    primaryPalace: result.primaryPalace,
    secondaryPalaces: result.secondaryPalaces,
    specialConditions: result.specialConditions,
    needInteraction: result.needInteraction,
  }
}

/**
 * 意图识别 — 从用户文本识别事项类型
 */
export function detectMatterIntent(text: string): MatterType | '互动关系' | '综合' | null {
  const tree = getRouterTree() as unknown as RouterTreeData

  for (const rule of tree.intentDetection) {
    if (rule.keywords.some((kw: string) => text.includes(kw))) {
      return rule.type as MatterType | '互动关系' | '综合'
    }
  }

  return null
}
