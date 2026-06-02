/**
 * 运限 ScoringContext 构建 — 大限/流年/小限共用
 */

import type { TianGan, SihuaType } from '@/core/types'
import type { ScoringContext, PalaceForScoring } from '@/core/energy-evaluator/scoring-flow'
import type { DaXianPalaceMapping } from '@/core/types'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import { getLiuNianExtraStars } from './liu-nian-extra-stars'

/** 流月 horoscope 快照（与 serializeHoroscopeForReading 输出对齐） */
export interface LiuYueHoroscopeSnapshot {
  heavenlyStem: TianGan
  mutagen: [string, string, string, string]
}

/** 从 chartData.horoscope.monthly 读取流月四化（缺失或字段不全时返回 null） */
export function extractMonthlyHoroscope(
  chartData: Record<string, unknown>,
): LiuYueHoroscopeSnapshot | null {
  const horoscope = chartData.horoscope as Record<string, unknown> | undefined
  const monthly = horoscope?.monthly as Record<string, unknown> | undefined
  if (!monthly) return null

  const stemRaw = monthly.heavenlyStem ?? monthly.gan
  const heavenlyStem = typeof stemRaw === 'string' ? stemRaw : ''
  const mutagenRaw = monthly.mutagen
  if (!heavenlyStem || !Array.isArray(mutagenRaw) || mutagenRaw.length < 4) return null

  const mutagen = mutagenRaw.slice(0, 4).map(s => String(s ?? '')) as [string, string, string, string]
  if (mutagen.every(s => !s)) return null

  return { heavenlyStem: heavenlyStem as TianGan, mutagen }
}

export function buildDaXianScoringContext(
  mapping: Pick<DaXianPalaceMapping, 'daXianGan' | 'mutagen' | 'palaceIndex'>,
  natalCtx: ScoringContext,
): ScoringContext | null {
  if (!mapping.mutagen || mapping.mutagen.length < 4) return null

  const daXianPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < mapping.mutagen.length && i < 4; i++) {
    const starName = mapping.mutagen[i]
    const sihuaType = sihuaTypes[i]
    for (const palace of daXianPalaces) {
      for (const star of palace.stars) {
        if (star.name === starName && !star.sihua) {
          star.sihua = sihuaType
          star.sihuaSource = '大限'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: daXianPalaces,
    birthGan: mapping.daXianGan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

/** 叠流月宫干四化到原局星曜，供 evaluateAllPalaces 使用 */
export function buildLiuYueScoringContext(
  monthly: LiuYueHoroscopeSnapshot,
  natalCtx: ScoringContext,
): ScoringContext | null {
  const monthlyPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < monthly.mutagen.length && i < 4; i++) {
    const starName = monthly.mutagen[i]
    const sihuaType = sihuaTypes[i]
    if (!starName) continue
    for (const palace of monthlyPalaces) {
      for (const star of palace.stars) {
        if (star.name === starName && !star.sihua) {
          star.sihua = sihuaType
          star.sihuaSource = '流月'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: monthlyPalaces,
    birthGan: monthly.heavenlyStem,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

export function buildYearlyScoringContext(
  year: number,
  natalCtx: ScoringContext,
): ScoringContext | null {
  const gan = getYearStem(year)
  const sihuaMap = getSihuaTable()[gan]
  if (!sihuaMap) return null

  const yearlyPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const entries: { star: string; type: SihuaType }[] = [
    { star: sihuaMap.禄, type: '化禄' },
    { star: sihuaMap.权, type: '化权' },
    { star: sihuaMap.科, type: '化科' },
    { star: sihuaMap.忌, type: '化忌' },
  ]

  for (const { star, type } of entries) {
    for (const palace of yearlyPalaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '流年'
        }
      }
    }
  }

  // 流年禄存替换原局禄存，并叠流年羊陀魁钺
  for (const palace of yearlyPalaces) {
    palace.hasLuCun = false
    palace.stars = palace.stars.filter(s => s.name !== '禄存')
  }
  const extraStars = getLiuNianExtraStars(gan, { ...natalCtx, palaces: yearlyPalaces })
  for (const extra of extraStars) {
    const palace = yearlyPalaces[extra.palaceIndex]
    if (!palace) continue
    if (extra.starName === '禄存') {
      palace.hasLuCun = true
      if (!palace.stars.some(s => s.name === '禄存')) {
        palace.stars.push({ name: '禄存' })
      }
    } else if (!palace.stars.some(s => s.name === extra.starName)) {
      palace.stars.push({ name: extra.starName })
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: yearlyPalaces,
    birthGan: gan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

export function buildMinorScoringContext(
  age: number,
  gender: '男' | '女',
  natalCtx: ScoringContext,
): ScoringContext | null {
  const mingIdx = getMinorMingPalaceIndex(age, gender, natalCtx)
  const mingPalace = natalCtx.palaces[mingIdx]
  if (!mingPalace) return null

  const minorGan = mingPalace.tianGan ?? natalCtx.birthGan
  const sihuaMap = getSihuaTable()[minorGan as TianGan]
  if (!sihuaMap) return null

  const minorPalaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p,
    stars: p.stars.map(s => ({ ...s })),
    majorStars: [...p.majorStars],
  }))

  const entries: { star: string; type: SihuaType }[] = [
    { star: sihuaMap.禄, type: '化禄' },
    { star: sihuaMap.权, type: '化权' },
    { star: sihuaMap.科, type: '化科' },
    { star: sihuaMap.忌, type: '化忌' },
  ]

  for (const { star, type } of entries) {
    for (const palace of minorPalaces) {
      for (const s of palace.stars) {
        if (s.name === star && !s.sihua) {
          s.sihua = type
          s.sihuaSource = '小限'
        }
      }
    }
  }

  return {
    skeletonId: natalCtx.skeletonId,
    palaces: minorPalaces,
    birthGan: minorGan,
    taiSuiZhi: natalCtx.taiSuiZhi,
    shenGongIndex: natalCtx.shenGongIndex,
    patterns: [],
  }
}

export function getMinorMingPalaceIndex(
  age: number,
  gender: '男' | '女',
  natalCtx: ScoringContext,
): number {
  const yinIdx = natalCtx.palaces.findIndex(p => p.diZhi === '寅')
  const baseIdx = yinIdx >= 0 ? yinIdx : 2

  if (gender === '男') {
    return (baseIdx + age - 1) % 12
  }
  return (baseIdx - age + 1 + 12) % 12
}

export function getYearStem(year: number): TianGan {
  const stems: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  return stems[((year - 4) % 10 + 10) % 10]
}

export function getYearBranch(year: number) {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
  return branches[((year - 4) % 12 + 12) % 12]
}
