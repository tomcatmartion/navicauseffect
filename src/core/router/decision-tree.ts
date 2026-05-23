/**
 * M5: 事项路由 — 决策树
 *
 * 职责：根据用户回答序列，确定事项类型、主看宫位、兼看宫位
 *       6分支决策树：求学/求爱/求财/求职/求健康/求名
 *
 * 数据来源：data/routing.json（支持热加载）
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
// 安全表达式解析器（替代 new Function，防止代码注入）
// ═══════════════════════════════════════════════════════════════════

/**
 * 解析并求值条件表达式。
 * 支持的语法：
 *   - 比较：answers['key'] === 'value' 或 answers['key'] !== 'value'
 *   - 逻辑与：cond1 && cond2
 *   - 逻辑或：cond1 || cond2
 *   - 括号分组：(cond1 && cond2) || cond3
 * 不支持：函数调用、属性访问（除 answers['x'] 外）、赋值、new 等
 */
function evaluateCondition(condition: string, answers: Record<string, string>): boolean {
  try {
    return parseExpression(condition.trim(), answers)
  } catch (err) {
    console.error('[decision-tree] Condition parse error:', condition, err)
    return false
  }
}

/** 递归下降解析表达式 */
function parseExpression(expr: string, answers: Record<string, string>): boolean {
  expr = expr.trim()
  if (!expr) return true

  // 处理括号分组
  if (expr.startsWith('(') && expr.endsWith(')')) {
    // 检查是否是最外层的一对括号
    let depth = 0
    let isOuterParens = true
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++
      else if (expr[i] === ')') depth--
      if (depth === 0 && i < expr.length - 1) {
        isOuterParens = false
        break
      }
    }
    if (isOuterParens) {
      return parseExpression(expr.slice(1, -1), answers)
    }
  }

  // 按 || 分割（最低优先级）
  const orParts = splitByOperator(expr, '||')
  if (orParts.length > 1) {
    return orParts.some(part => parseExpression(part, answers))
  }

  // 按 && 分割
  const andParts = splitByOperator(expr, '&&')
  if (andParts.length > 1) {
    return andParts.every(part => parseExpression(part, answers))
  }

  // 原子表达式：answers['key'] === 'value' 或 answers['key'] !== 'value'
  return evaluateAtom(expr, answers)
}

/** 按运算符分割，尊重括号层级 */
function splitByOperator(expr: string, op: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0

  while (i < expr.length) {
    if (expr[i] === '(') depth++
    else if (expr[i] === ')') depth--

    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(current.trim())
      current = ''
      i += op.length
      continue
    }

    current += expr[i]
    i++
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

/** 求值原子比较表达式 */
function evaluateAtom(expr: string, answers: Record<string, string>): boolean {
  expr = expr.trim()

  // 支持 === 和 !==
  const eqMatch = expr.match(/^answers\[(['"`])(.+?)\1\]\s*===\s*(['"`])(.*?)\3$/)
  if (eqMatch) {
    const key = eqMatch[2]
    const expected = eqMatch[4]
    return answers[key] === expected
  }

  const neMatch = expr.match(/^answers\[(['"`])(.+?)\1\]\s*!==\s*(['"`])(.*?)\3$/)
  if (neMatch) {
    const key = neMatch[2]
    const expected = neMatch[4]
    return answers[key] !== expected
  }

  // 如果无法解析，记录警告并返回 false
  console.warn('[decision-tree] Unrecognized atom expression:', expr)
  return false
}

function resolveBranch(matterType: MatterType, answers: Record<string, string>): RouteResult {
  const tree = getRouterTree() as unknown as RouterTreeData
  // 优先使用 detailedBranches（包含完整决策逻辑），回退到 branches
  const branch = (tree as unknown as { detailedBranches?: Record<string, BranchData> }).detailedBranches?.[matterType] ?? tree.branches[matterType]
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
