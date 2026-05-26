import type { DirectionMatrix } from '@/core/types'
import { getLimitDirection } from './loader'

const MATRIX_KEY: Record<DirectionMatrix, string> = {
  吉吉: '吉◇吉',
  吉凶: '吉◇凶',
  凶吉: '凶◇吉',
  凶凶: '凶◇凶',
}

/** 从 limit_direction.json 读取大限×流年方向解读 */
export function getLimitDirectionMeta(matrix: DirectionMatrix): {
  judgment: string
  suggestion: string
  description: string
} | null {
  const raw = getLimitDirection()
  const timeAnalysis = raw.timeAnalysis as Record<string, unknown> | undefined
  const directionJudgment = timeAnalysis?.directionJudgment as Record<string, unknown> | undefined
  const matrixMap = directionJudgment?.matrix as Record<
    string,
    { judgment?: string; suggestion?: string; description?: string }
  > | undefined
  if (!matrixMap) return null

  const entry = matrixMap[MATRIX_KEY[matrix]]
  if (!entry) return null

  return {
    judgment: entry.judgment ?? '',
    suggestion: entry.suggestion ?? '',
    description: entry.description ?? '',
  }
}
