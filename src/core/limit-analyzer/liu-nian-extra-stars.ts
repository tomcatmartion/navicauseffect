/**
 * 流年禄存、羊陀、魁钺落宫（查 tai_sui_rua_gua_tables.json）
 */

import type { DiZhi, TianGan } from '@/core/types'
import { getTaiSuiTables } from '@/core/knowledge-dict/loader'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'

export interface LiuNianExtraStar {
  starName: string
  palaceIndex: number
  value: number
}

const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function earthlyBranchToIndex(branch: string): number {
  const idx = DI_ZHI_ORDER.indexOf(branch as DiZhi)
  return idx >= 0 ? idx : 0
}

/** 按 ctx 地支序列将流年地支映射到宫位索引 */
export function diZhiToPalaceIndex(ctx: ScoringContext, zhi: DiZhi): number {
  const idx = ctx.palaces.findIndex(p => p.diZhi === zhi)
  return idx >= 0 ? idx : earthlyBranchToIndex(zhi)
}

/** 根据流年天干获取流年禄存、羊陀、魁钺落宫 */
export function getLiuNianExtraStars(
  liuNianGan: TianGan,
  ctx: ScoringContext,
): LiuNianExtraStar[] {
  const tables = getTaiSuiTables()
  const result: LiuNianExtraStar[] = []

  const luInfo = tables.luCunYangTuo?.[liuNianGan] as
    | { luCun?: string; qingYang?: string; tuoLuo?: string }
    | undefined
  if (luInfo) {
    if (luInfo.luCun) {
      result.push({
        starName: '禄存',
        palaceIndex: diZhiToPalaceIndex(ctx, luInfo.luCun as DiZhi),
        value: 0.5,
      })
    }
    if (luInfo.qingYang) {
      result.push({
        starName: '擎羊',
        palaceIndex: diZhiToPalaceIndex(ctx, luInfo.qingYang as DiZhi),
        value: -0.5,
      })
    }
    if (luInfo.tuoLuo) {
      result.push({
        starName: '陀罗',
        palaceIndex: diZhiToPalaceIndex(ctx, luInfo.tuoLuo as DiZhi),
        value: -0.5,
      })
    }
  }

  const kuiYueInfo = tables.tianKuiYue?.[liuNianGan] as
    | { tianKui?: string; tianYue?: string }
    | undefined
  if (kuiYueInfo) {
    if (kuiYueInfo.tianKui) {
      result.push({
        starName: '天魁',
        palaceIndex: diZhiToPalaceIndex(ctx, kuiYueInfo.tianKui as DiZhi),
        value: 0.5,
      })
    }
    if (kuiYueInfo.tianYue) {
      result.push({
        starName: '天钺',
        palaceIndex: diZhiToPalaceIndex(ctx, kuiYueInfo.tianYue as DiZhi),
        value: 0.5,
      })
    }
  }

  return result
}
