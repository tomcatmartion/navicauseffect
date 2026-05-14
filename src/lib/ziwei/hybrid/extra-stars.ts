/**
 * 方案 §3.1 / §3.2：禄存、擎羊、陀罗、天魁、天钺、红鸾、天喜等须与 iztro 盘面一致。
 * 真源：从 chartData（与前端 serialize 一致）各宫 major/minor/adjective 中抽取，
 * 避免占位 JSON 与 KB 表不同步导致偏差。
 */

import type { DiZhi } from '@/core/types'
import type { BaseIRExtraStar } from './types'

const AUX_NAMES = new Set(['禄存', '擎羊', '陀罗', '天魁', '天钺', '红鸾', '天喜'])

type StarRow = { name?: string }

function starsInPalace(p: Record<string, unknown>): StarRow[] {
  const major = (p.majorStars as StarRow[] | undefined) ?? []
  const minor = (p.minorStars as StarRow[] | undefined) ?? []
  const adj = (p.adjectiveStars as StarRow[] | undefined) ?? []
  return [...major, ...minor, ...adj]
}

/**
 * 从与 iztro 对齐的 chartData 提取方案所列辅星落点（用于 BaseIR.extraStars）
 */
export function extractAuxiliaryStarsFromChart(chartData: Record<string, unknown>): BaseIRExtraStar[] {
  const palaces = (chartData.palaces as Array<Record<string, unknown>> | undefined) ?? []
  const out: BaseIRExtraStar[] = []
  for (const p of palaces) {
    const pname = String(p.name ?? '')
    const zhi = String(p.earthlyBranch ?? '') as DiZhi | string
    for (const s of starsInPalace(p)) {
      const n = s.name ?? ''
      if (AUX_NAMES.has(n)) {
        out.push({
          star: n,
          label: `${pname}（${zhi}）`,
          sourceKey: 'iztro-chart-payload',
        })
      }
    }
  }
  return out
}

/** @deprecated 占位表逻辑已弃用，保留函数名避免外部引用断裂时改为抽 iztro */
export function lookupExtraStarsForTaiSui(_taiSuiZhi: DiZhi): BaseIRExtraStar[] {
  return []
}
