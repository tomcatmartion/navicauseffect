/**
 * 供前端问诊 UI 使用的 router 树（不含 resolver 条件表达式）
 */

import { getRouterTree } from '../knowledge-dict/loader'
import type { MatterPreAnalysis } from './decision-tree'
import type { RouteQuestion } from './decision-tree'
import type { MatterType } from '../types'

export interface ClientRouterBranch {
  firstQuestion: string
  questions: Record<string, RouteQuestion>
  pre_analysis?: MatterPreAnalysis
}

export interface ClientRouterTree {
  branches: Partial<Record<MatterType, ClientRouterBranch>>
  intentDetection: Array<{ keywords: string[]; type: string }>
}

/** 导出问诊 UI 所需字段 */
export function getRouterTreeForClient(): ClientRouterTree {
  const raw = getRouterTree() as {
    branches?: Record<
      string,
      {
        firstQuestion?: string
        questions?: Record<string, RouteQuestion>
        pre_analysis?: MatterPreAnalysis
      }
    >
    intentDetection?: Array<{ keywords: string[]; type: string }>
  }

  const branches: Partial<Record<MatterType, ClientRouterBranch>> = {}
  for (const [matterType, branch] of Object.entries(raw.branches ?? {})) {
    if (!branch?.firstQuestion || !branch.questions) continue
    branches[matterType as MatterType] = {
      firstQuestion: branch.firstQuestion,
      questions: branch.questions,
      pre_analysis: branch.pre_analysis,
    }
  }

  return {
    branches,
    intentDetection: raw.intentDetection ?? [],
  }
}
