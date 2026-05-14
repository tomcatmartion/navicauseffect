/**
 * 编排层 — 4阶段状态机
 *
 * 阶段一：宫位评分
 * 阶段二：性格定性 + 事项问诊
 * 阶段三：事项分析（可随时触发）
 * 阶段四：互动关系分析（与阶段三并列）
 *
 * 来源：PROCESS_智能解盘总体流程 V1.0
 */

import type { MatterType } from '../types'

// ═══════════════════════════════════════════════════════════════════
// 阶段定义
// ═══════════════════════════════════════════════════════════════════

export type Stage = 1 | 2 | 3 | 4

export interface SessionState {
  /** 当前阶段 */
  currentStage: Stage
  /** 阶段一是否完成 */
  stage1Completed: boolean
  /** 阶段二是否完成 */
  stage2Completed: boolean
  /** 阶段三是否完成（可多次触发） */
  stage3Completed: boolean
  /** 阶段四是否完成（可多次触发） */
  stage4Completed: boolean
  /** 当前事项类型 */
  currentMatterType: MatterType | null
  /** 是否有父母生年 */
  hasParentInfo: boolean
  /** 是否有互动关系信息 */
  hasPartnerInfo: boolean
  /** 是否在问诊中 */
  isDiagnosing: boolean
  /** 问诊进度（当前问题ID） */
  diagnosisProgress: string | null
}

// ═══════════════════════════════════════════════════════════════════
// 状态机
// ═══════════════════════════════════════════════════════════════════

/**
 * 创建初始会话状态
 */
export function createInitialState(): SessionState {
  return {
    currentStage: 1,
    stage1Completed: false,
    stage2Completed: false,
    stage3Completed: false,
    stage4Completed: false,
    currentMatterType: null,
    hasParentInfo: false,
    isDiagnosing: false,
    diagnosisProgress: null,
    hasPartnerInfo: false,
  }
}

/**
 * 推进到下一阶段
 *
 * 规则：
 * - 阶段一 → 阶段二：自动（评分完成后）
 * - 阶段二 → 阶段三：需要用户明确事项方向
 * - 阶段二 → 阶段四：用户直接提及互动关系
 * - 阶段三 ↔ 阶段四：可交替
 * - 禁止跳步（不能从1直接到3/4）
 */
export function advanceStage(state: SessionState, target: Stage, matterType?: MatterType): SessionState {
  const newState = { ...state }

  // 阶段一完成
  if (target === 2 && state.currentStage === 1) {
    newState.currentStage = 2
    newState.stage1Completed = true
    return newState
  }

  // 阶段二完成 → 阶段三或四
  if ((target === 3 || target === 4) && state.stage2Completed) {
    newState.currentStage = target
    if (matterType) newState.currentMatterType = matterType
    return newState
  }

  // 阶段二完成
  if (target === 2 && state.currentStage === 2) {
    newState.stage2Completed = true
    return newState
  }

  // 阶段三 ↔ 阶段四 交替
  if ((target === 3 && state.currentStage === 4) ||
      (target === 4 && state.currentStage === 3)) {
    newState.currentStage = target
    return newState
  }

  // 回到同一阶段（继续分析）
  if (target === state.currentStage) {
    return newState
  }

  // 其他情况不变（禁止跳步）
  return newState
}

/**
 * 检查是否可以进入目标阶段
 */
export function canAdvanceTo(state: SessionState, target: Stage): boolean {
  // 阶段一：任何时候都可以（初始状态）
  if (target === 1) return true

  // 阶段二：需要阶段一完成
  if (target === 2) return state.stage1Completed

  // 阶段三/四：需要阶段二完成
  if (target === 3 || target === 4) return state.stage2Completed

  return false
}

/**
 * 获取当前阶段描述
 */
export function getStageDescription(stage: Stage): string {
  switch (stage) {
    case 1: return '宫位评分 — 生成命盘 + 十二宫评分'
    case 2: return '性格定性 + 事项问诊 — 命主性格图谱 + 引导用户说出关注方向'
    case 3: return '事项分析 — 原局/大限/流年三层合参'
    case 4: return '互动关系分析 — 太岁入卦三维合参'
  }
}
