/**
 * limit_direction.json 查询 API
 */

import type { DirectionMatrix, DirectionWindow, MatterType } from '@/core/types'
import { getLimitDirection } from './loader'
import {
  DIRECTION_WINDOW_BY_MATRIX,
  type DaXianQualitativeLevel,
  type InnateLevelDetail,
  type LimitDirectionConfig,
  type MatterTypeMapping,
  type ProtectionMechanismEntry,
  type ScoreThresholdResult,
  type SihuaRuleEntry,
} from './limit-direction-types'

export type { LimitDirectionConfig } from './limit-direction-types'

const MATRIX_KEY: Record<DirectionMatrix, string> = {
  吉吉: '吉◇吉',
  吉凶: '吉◇凶',
  凶吉: '凶◇吉',
  凶凶: '凶◇凶',
}

function getConfig(): LimitDirectionConfig {
  return getLimitDirection() as unknown as LimitDirectionConfig
}

/** 从 limit_direction.json 读取大限×流年方向解读 */
/** 四化单星基础加减分（方向矩阵用；规则层 adjustment 见 getSihuaRuleAdjustment） */
export function getSihuaStarBaseAdjustments(): {
  lu: number
  quan: number
  ke: number
  ji: number
} {
  return { lu: 2, quan: 1, ke: 0.5, ji: -2 }
}

export function getLimitDirectionMeta(matrix: DirectionMatrix): {
  judgment: string
  suggestion: string
  description: string
} | null {
  const matrixMap = getConfig().timeAnalysis?.directionJudgment?.matrix
  if (!matrixMap) return null
  const entry = matrixMap[MATRIX_KEY[matrix]]
  if (!entry) return null
  return {
    judgment: entry.judgment ?? '',
    suggestion: entry.suggestion ?? '',
    description: entry.description ?? '',
  }
}

export function getMatterMapping(matterType: MatterType): MatterTypeMapping | null {
  return getConfig().matterTypeMappings?.[matterType] ?? null
}

export function getMatterPersonalityInfluence(matterType: MatterType): string {
  return getMatterMapping(matterType)?.personality_influence ?? ''
}

export function getFourDimensionFocus(matterType: MatterType): string[] {
  return getMatterMapping(matterType)?.fourDimensionFocus ?? []
}

export function getTimeDimensions(matterType: MatterType): string[] {
  return getMatterMapping(matterType)?.timeDimensions ?? []
}

export function getTimeWeights(): { daXian: number; liuNian: number; liuYue: number } {
  const w = getConfig().timeAnalysis?.weights
  return {
    daXian: w?.daXian?.weight ?? 0.5,
    liuNian: w?.liuNian?.weight ?? 0.3,
    liuYue: w?.liuYue?.weight ?? 0.2,
  }
}

export function getPalaceWeights(matterType: MatterType): Record<string, number> {
  const weights = getConfig().directionMatrix?.palaceWeights?.[matterType]
  if (!weights || typeof weights !== 'object' || 'description' in weights) return {}
  return weights as Record<string, number>
}

export function getScoreThreshold(score: number): ScoreThresholdResult {
  const thresholds = getConfig().directionMatrix?.scoreThresholds ?? {}
  const sorted = Object.values(thresholds).sort((a, b) => b.min - a.min)
  for (const val of sorted) {
    if (score >= val.min) return { label: val.label, action: val.action }
  }
  return { label: '未知', action: '谨慎' }
}

export function getSihuaRuleAdjustment(
  layer: 'daXianSihua' | 'liuNianSihua' | 'liuYueSihua',
  ruleKey: string,
): number {
  const rules = getConfig().sihuaWeights?.[layer]?.rules
  return rules?.[ruleKey]?.scoreAdjustment ?? 0
}

export function getSihuaRules(
  layer: 'daXianSihua' | 'liuNianSihua' | 'liuYueSihua',
): Record<string, SihuaRuleEntry> {
  return getConfig().sihuaWeights?.[layer]?.rules ?? {}
}

export function getDaXianQualitativeLevel(score: number): DaXianQualitativeLevel {
  const levels = getConfig().daXianQualitative?.levels ?? {}
  for (const [level, val] of Object.entries(levels)) {
    if (score >= val.scoreRange[0] && score <= val.scoreRange[1]) {
      return level as DaXianQualitativeLevel
    }
  }
  return '危机期'
}

export function getInnateLevelDetail(score: number): InnateLevelDetail {
  const levels = getConfig().innateLevelMap?.levels ?? {}
  for (const [level, val] of Object.entries(levels)) {
    if (score >= val.scoreRange[0] && score <= val.scoreRange[1]) {
      return {
        level,
        description: val.description,
        carryingCapacity: val.carryingCapacity,
        sihuaEffect: val.sihuaEffect,
        advice: val.advice,
      }
    }
  }
  return {
    level: '凶危',
    description: '原局有险，需化解调整',
    carryingCapacity: '极弱',
    sihuaEffect: '煞象直接穿透',
    advice: '全面防范，寻求化解',
  }
}

export function getMingRegulatorCoefficient(innateLevel: string): number {
  const formula = getConfig().compositeScoring?.formula ?? {}
  const map = formula['命宫调节系数'] as Record<string, number> | undefined
  if (!map) return 1.0
  return map[`命宫${innateLevel}`] ?? 1.0
}

export function getDirectionWindowFromMatrix(matrix: DirectionMatrix): DirectionWindow {
  const windows = getConfig().liuNianTimeWindow?.windows
  const mapped = DIRECTION_WINDOW_BY_MATRIX[matrix]
  if (windows && mapped in windows) return mapped
  return mapped
}

export function getLiuNianTimeWindowMeta(window: DirectionWindow): {
  condition: string
  action: string
  duration: string
} | null {
  return getConfig().liuNianTimeWindow?.windows?.[window] ?? null
}

export function getProtectionMechanismDefs(): Record<string, ProtectionMechanismEntry> {
  return getConfig().protectionMechanism?.mechanisms ?? {}
}

export function getPalaceProjectionFactor(
  relation: '本宫' | '对宫' | '三合宫',
): number {
  const item = getConfig().palaceProjection?.coefficients?.[relation]
  if (item && 'factor' in item && typeof item.factor === 'number') return item.factor
  return 1.0
}

export function getFlankingProjectionFactor(
  selfTone: '旺' | '平' | '弱',
  flankTone: '旺' | '平' | '弱',
): number {
  const item = getConfig().palaceProjection?.coefficients?.['夹宫']
  const matrix = item?.matrix
  if (!matrix) return 0
  const key = `本宫${selfTone}×夹宫${flankTone}`
  return matrix[key] ?? 0
}

export function getCausalChainTemplate(matrix: DirectionMatrix): string {
  return getConfig().causalChainTemplates?.[matrix] ?? ''
}

export function getMatrixStressValue(matrix: DirectionMatrix): number {
  return getConfig().matrixStressValues?.[matrix] ?? 0
}

export function getResilienceThresholds(): NonNullable<LimitDirectionConfig['resilienceThresholds']> {
  const t = getConfig().resilienceThresholds
  return {
    crisis: t?.crisis ?? 3,
    development: t?.development ?? 5,
    crisisPromptSuffix: t?.crisisPromptSuffix ?? '',
    developmentPromptSuffix: t?.developmentPromptSuffix ?? '',
    empowermentPromptSuffix: t?.empowermentPromptSuffix ?? '',
  }
}

export function getLuluJiFlowTemplate(): string {
  return getConfig().luluJiFlowTemplates?.pattern ?? ''
}

export function computeCompositeScore(
  originScore: number,
  daXianScore: number,
  liuNianScore: number,
  liuYueScore: number,
): number {
  const weights = getTimeWeights()
  const originWeight = 0.3
  return (
    originScore * originWeight
    + daXianScore * weights.daXian
    + liuNianScore * weights.liuNian
    + liuYueScore * weights.liuYue
  )
}

/** @deprecated 使用 getDirectionWindowFromMatrix */
export function getDirectionWindow(matrix: DirectionMatrix): DirectionWindow {
  return getDirectionWindowFromMatrix(matrix)
}

export type {
  DaXianQualitativeLevel,
  InnateLevelDetail,
  MatterTypeMapping,
  ProtectionMechanismEntry,
  ScoreThresholdResult,
} from './limit-direction-types'
