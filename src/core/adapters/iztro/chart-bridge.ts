/**
 * ChartBridge：iztro JSON → BaseIR
 *
 * 使用 data-reader 归一化命盘，合并太岁入卦等查表星曜，生成三层表（至少原局层完整）。
 */

import type { DiZhi, MajorStar, PalaceBrightness, PalaceLayer, PalaceLayerEntry, PalaceName, TianGan, ThreeLayerPalaceTable } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import { readChartFromData } from '@/core/data-reader/iztro-reader'
import type { NormalizedChart, NormalizedPalace } from '@/core/data-reader/types-iztro'
import type { BaseIR, BaseIRPalace, BaseIRExtraStar } from './types'
import { extractAuxiliaryStarsFromChart } from './extra-stars'
import { adaptIztroChartData } from './iztro-adapter'

export interface ChartBridgeOptions {
  /** 对方命盘（互动分析注入） */
  partnerChartData?: Record<string, unknown>
}

function normalizedPalaceToBaseIR(p: NormalizedPalace, index: number): BaseIRPalace {
  const minor: Array<{ name: string; mutagen?: string }> = [
    ...p.auspiciousStars.map(s => ({ name: s })),
    ...p.inauspiciousStars.map(s => ({ name: s })),
    ...p.minorStars.map(s => ({ name: s })),
  ]
  if (p.hasLuCun) minor.unshift({ name: '禄存' })

  return {
    name: p.name,
    index,
    diZhi: p.diZhi,
    tianGan: p.tianGan,
    majorStars: p.majorStars.map(s => ({
      name: s.star,
      brightness: s.brightness,
      mutagen: s.mutagen,
    })),
    minorStars: minor,
    adjectiveStars: [],
  }
}

function palaceLayerFromNormalized(chart: NormalizedChart, layer: '原局' | '大限' | '流年'): PalaceLayer {
  const palaces: PalaceLayerEntry[] = chart.palaces.map((p, i) => {
    const majorStars = p.majorStars.map(s => ({
      star: s.star as MajorStar,
      brightness: s.brightness as PalaceBrightness,
    }))
    return {
      name: p.name as PalaceName,
      diZhi: p.diZhi,
      tianGan: p.tianGan,
      majorStars,
      sihua: [],
    }
  })
  return { layer, palaces }
}

/** 无 horoscope 时三层表以大限/流年占位复制原局结构（后续 Stage3 会替换为真值） */
export function buildThreeLayerShell(chart: NormalizedChart): ThreeLayerPalaceTable {
  return {
    natal: palaceLayerFromNormalized(chart, '原局'),
    decadal: palaceLayerFromNormalized(chart, '大限'),
    yearly: palaceLayerFromNormalized(chart, '流年'),
  }
}

function extractHoroscopeShell(chartData: Record<string, unknown>): BaseIR['horoscope'] {
  const h = chartData.horoscope as Record<string, unknown> | undefined
  if (!h) return undefined
  const decadal = h.decadal as Record<string, unknown> | undefined
  const yearly = h.yearly as Record<string, unknown> | undefined
  return {
    decadal: decadal
      ? {
          gan: (decadal.heavenlyStem ?? decadal.gan) as TianGan | undefined,
          zhi: (decadal.earthlyBranch ?? decadal.zhi) as DiZhi | undefined,
          label: typeof decadal.name === 'string' ? decadal.name : undefined,
        }
      : undefined,
    yearly: yearly
      ? {
          gan: (yearly.heavenlyStem ?? yearly.gan) as TianGan | undefined,
          zhi: (yearly.earthlyBranch ?? yearly.zhi) as DiZhi | undefined,
          year: typeof yearly.year === 'number' ? yearly.year : undefined,
        }
      : undefined,
  }
}

/**
 * 从 iztro chartData 构建 BaseIR
 */
export function buildBaseIR(chartData: Record<string, unknown>, options?: ChartBridgeOptions): BaseIR {
  const chart = readChartFromData(adaptIztroChartData(chartData))
  const palaces = chart.palaces.map((p, i) => normalizedPalaceToBaseIR(p, i))
  const extraStars = extractAuxiliaryStarsFromChart(adaptIztroChartData(chartData))
  const threeLayer = buildThreeLayerShell(chart)
  const horoscope = extractHoroscopeShell(chartData)

  const base: BaseIR = {
    version: 1,
    solarDate: chart.solarDate,
    gender: chart.gender,
    birthGan: chart.birthGan,
    birthZhi: chart.birthZhi,
    mingGongZhi: chart.mingGongZhi,
    shenGongZhi: chart.shenGongZhi,
    taiSuiZhi: chart.taiSuiZhi,
    fiveElementsClass: chart.fiveElementsClass,
    skeletonId: chart.skeletonId,
    soulStar: chart.soulStar,
    bodyStar: chart.bodyStar,
    palaces,
    horoscope,
    extraStars,
    threeLayer,
  }

  if (options?.partnerChartData) {
    base.partnerBaseIR = buildBaseIR(options.partnerChartData)
  }

  return base
}
