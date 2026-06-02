/**
 * limit_direction.json 类型定义
 */

import type { DirectionMatrix, DirectionWindow, MatterType, PalaceName } from '@/core/types'

export interface MatterTypeMapping {
  primaryPalace: PalaceName
  secondaryPalaces: PalaceName[]
  personality_influence?: string
  timeDimensions?: string[]
  routingConditions?: Record<string, unknown>
  fourDimensionFocus?: string[]
}

export interface SihuaRuleEntry {
  effect: string
  scoreAdjustment: number
}

export interface InnateLevelEntry {
  scoreRange: [number, number]
  description: string
  carryingCapacity: string
  sihuaEffect: string
  advice: string
}

export interface DaXianQualitativeEntry {
  scoreRange: [number, number]
  features: string
  protectionNeeded: boolean | string
  effect: string
  color: string
}

export interface ProtectionMechanismEntry {
  priority: number
  description: string
  effect: string
  scoreBonus: number
}

export interface LimitDirectionConfig {
  version: string
  matterTypeMappings: Record<MatterType, MatterTypeMapping>
  timeAnalysis: {
    weights: {
      daXian: { weight: number }
      liuNian: { weight: number }
      liuYue: { weight: number }
    }
    directionJudgment: {
      matrix: Record<string, { judgment: string; suggestion: string; description: string }>
    }
  }
  directionMatrix: {
    scoreThresholds: Record<string, { min: number; label: string; action: string }>
    palaceWeights: Record<string, Record<string, number> | { description: string }>
  }
  sihuaWeights: {
    daXianSihua: { weight: number; rules: Record<string, SihuaRuleEntry> }
    liuNianSihua: { weight: number; rules: Record<string, SihuaRuleEntry> }
    liuYueSihua: { weight: number; rules: Record<string, SihuaRuleEntry> }
  }
  daXianQualitative: { levels: Record<string, DaXianQualitativeEntry> }
  liuNianTimeWindow: { windows: Record<DirectionWindow, { condition: string; action: string; duration: string }> }
  innateLevelMap: { levels: Record<string, InnateLevelEntry> }
  protectionMechanism: { mechanisms: Record<string, ProtectionMechanismEntry> }
  palaceProjection: {
    coefficients: Record<string, { factor?: number; description?: string; matrix?: Record<string, number> }>
  }
  compositeScoring: {
    formula: Record<string, string | Record<string, number>>
  }
  causalChainTemplates?: Record<DirectionMatrix, string>
  matrixStressValues?: Record<DirectionMatrix, number>
  resilienceThresholds?: {
    crisis: number
    development: number
    crisisPromptSuffix: string
    developmentPromptSuffix: string
    empowermentPromptSuffix: string
  }
  luluJiFlowTemplates?: {
    pattern: string
  }
}

export type DaXianQualitativeLevel = '顺畅期' | '转机期' | '艰辛期' | '危机期'

export interface InnateLevelDetail {
  level: string
  description: string
  carryingCapacity: string
  sihuaEffect: string
  advice: string
}

export interface ScoreThresholdResult {
  label: string
  action: string
}

export const DIRECTION_WINDOW_BY_MATRIX: Record<DirectionMatrix, DirectionWindow> = {
  吉吉: '推进窗口',
  吉凶: '挑战期',
  凶吉: '蛰伏期',
  凶凶: '风险期',
}
