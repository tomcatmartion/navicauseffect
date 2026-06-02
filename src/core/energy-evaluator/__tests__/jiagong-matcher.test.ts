/**
 * 夹宫同源判定（阶段一：仅命主）单元测试
 */

import { describe, it, expect } from 'vitest'
import type { DiZhi, PalaceBrightness, MajorStar, TianGan } from '@/core/types'
import {
  getAllFlankingPairs,
  NATIVE_OWNER_SAME_SOURCE_LABEL,
} from '../jiagong-matcher'
import type { PalaceForScoring, ScoringContext } from '../scoring-flow'
import { getDunGanSihua, getShengNianSihua } from '@/core/sihua-calculator'

function buildCtx(
  mutate: (palaces: PalaceForScoring[]) => void,
  birthGan: TianGan = '壬',
  taiSuiZhi: DiZhi = '戌',
): ScoringContext {
  const palaces: PalaceForScoring[] = Array.from({ length: 12 }, (_, i) => ({
    palaceIndex: i,
    diZhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][i] as DiZhi,
    brightness: '平' as PalaceBrightness,
    majorStars: [] as Array<{ star: MajorStar; brightness: PalaceBrightness }>,
    stars: [] as Array<{ name: string }>,
    hasLuCun: false,
  }))
  mutate(palaces)
  return {
    skeletonId: 'P01',
    palaces,
    birthGan,
    taiSuiZhi,
    patterns: [],
  }
}

describe('jiagong-matcher — 命主同源夹宫', () => {
  it('昌曲分居两侧应成立昌曲夹', () => {
    const ctx = buildCtx(palaces => {
      // 本宫 index=5；左=6，右=4
      palaces[6]!.stars = [{ name: '文昌' }]
      palaces[4]!.stars = [{ name: '文曲' }]
    })
    const pairs = getAllFlankingPairs(5, ctx, '吉夹')
    expect(pairs.some(p => p.pairName === '昌曲夹')).toBe(true)
    expect(pairs.find(p => p.pairName === '昌曲夹')?.sameSourceLabel).toBe('星曜成对（无需同源）')
  })

  it('禄存+命主化禄分居两侧应成立禄夹格', () => {
    const shengNian = getShengNianSihua('壬')
    const ctx = buildCtx(palaces => {
      palaces[6]!.hasLuCun = true
      palaces[6]!.stars = [{ name: '禄存' }]
      palaces[4]!.stars = [{ name: shengNian.禄 }]
    })
    const pairs = getAllFlankingPairs(5, ctx, '吉夹')
    const luJia = pairs.find(p => p.pairName === '禄存+化禄夹')
    expect(luJia).toBeDefined()
    expect(luJia?.displayName).toBe('禄夹格')
    expect(luJia?.sameSourceLabel).toBe(NATIVE_OWNER_SAME_SOURCE_LABEL)
  })

  it('生年禄+遁干禄分居两侧应成立双禄夹（命主同源）', () => {
    const shengNian = getShengNianSihua('壬')
    const dunGan = getDunGanSihua('壬', '戌')
    const ctx = buildCtx(palaces => {
      palaces[6]!.stars = [{ name: shengNian.禄 }]
      palaces[4]!.stars = [{ name: dunGan.禄 }]
    })
    const pairs = getAllFlankingPairs(5, ctx, '吉夹')
    const doubleLu = pairs.find(p => p.pairName === '双禄夹')
    expect(doubleLu).toBeDefined()
    expect(doubleLu?.sameSourceLabel).toBe(NATIVE_OWNER_SAME_SOURCE_LABEL)
  })

  it('仅一侧有命主化禄不构成双禄夹', () => {
    const shengNian = getShengNianSihua('壬')
    const ctx = buildCtx(palaces => {
      palaces[6]!.stars = [{ name: shengNian.禄 }]
    })
    const pairs = getAllFlankingPairs(5, ctx, '吉夹')
    expect(pairs.some(p => p.pairName === '双禄夹')).toBe(false)
  })

  it('昌曲同在一侧不构成昌曲夹', () => {
    const ctx = buildCtx(palaces => {
      palaces[6]!.stars = [{ name: '文昌' }, { name: '文曲' }]
    })
    const pairs = getAllFlankingPairs(5, ctx, '吉夹')
    expect(pairs.some(p => p.pairName === '昌曲夹')).toBe(false)
  })
})
