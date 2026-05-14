/**
 * 与 iztro 排盘结果对齐：1982-09-24 凌晨 4 点（iztro timeIndex=2，寅时 03:00–05:00）男命
 */

import { describe, it, expect } from 'vitest'
import { astro } from 'iztro'
import { readChartFromData } from '@/core/data-reader/iztro-reader'
import { buildBaseIR } from '@/lib/ziwei/hybrid/chart-bridge'
import { extractAuxiliaryStarsFromChart } from '@/lib/ziwei/hybrid/extra-stars'
import { serializeAstrolabeForReading } from '@/lib/ziwei/serialize-chart-for-reading'

describe('Hybrid vs iztro 数据一致', () => {
  /** 凌晨 4 点属寅时，对应 iztro CHINESE_TIME[2]（03:00~05:00） */
  const TIME_INDEX_4AM = 2

  it('1982-09-24 4am 男：命宫地支与主星与 iztro 一致', () => {
    const a = astro.bySolar('1982-9-24', TIME_INDEX_4AM, '男', true, 'zh-CN')
    const chart = serializeAstrolabeForReading(a, {
      year: 1982,
      month: 9,
      day: 24,
      hour: TIME_INDEX_4AM,
      gender: 'MALE',
      solar: true,
    })
    const norm = readChartFromData(chart)
    expect(norm.mingGongZhi).toBe(a.earthlyBranchOfSoulPalace)
    expect(norm.birthGan).toBe('壬')
    expect(norm.birthZhi).toBe('戌')
    expect(norm.taiSuiZhi).toBe('戌')

    const mingI = a.palaces.find((p: { name: string }) => p.name === '命宫')
    const mingN = norm.palaces.find(p => p.name === '命宫')
    const namesI = (mingI?.majorStars ?? []).map((s: { name: string }) => s.name).join(',')
    const namesN = mingN?.majorStars.map(s => s.star).join(',') ?? ''
    expect(namesN).toBe(namesI)
  })

  it('1982-09-24 4am 男：BaseIR.extraStars 与 iztro 禄存/羊/陀/魁/钺/鸾/喜落宫一致', () => {
    const a = astro.bySolar('1982-9-24', TIME_INDEX_4AM, '男', true, 'zh-CN')
    const chart = serializeAstrolabeForReading(a, {
      year: 1982,
      month: 9,
      day: 24,
      hour: TIME_INDEX_4AM,
      gender: 'MALE',
      solar: true,
    })
    const base = buildBaseIR(chart)
    const fromPayload = extractAuxiliaryStarsFromChart(chart)
    expect(fromPayload.map(e => e.star).sort().join(',')).toBe(base.extraStars.map(e => e.star).sort().join(','))

    const expected = new Map<string, string>()
    for (const p of a.palaces as Array<{ name: string; earthlyBranch: string; majorStars?: { name: string }[]; minorStars?: { name: string }[]; adjectiveStars?: { name: string }[] }>) {
      for (const s of [...(p.majorStars ?? []), ...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
        if (['禄存', '擎羊', '陀罗', '天魁', '天钺', '红鸾', '天喜'].includes(s.name)) {
          expected.set(s.name, `${p.name}:${p.earthlyBranch}`)
        }
      }
    }
    for (const [star, loc] of expected) {
      const pname = loc.split(':')[0]
      const hit = base.extraStars.find(e => e.star === star)
      expect(hit).toBeDefined()
      expect(hit!.label).toContain(pname)
    }
    expect(base.extraStars.length).toBe(expected.size)
  })
})
