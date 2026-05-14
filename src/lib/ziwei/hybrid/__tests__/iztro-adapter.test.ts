import { describe, it, expect } from 'vitest'
import { adaptIztroChartData } from '@/lib/ziwei/hybrid/iztro-adapter'

describe('adaptIztroChartData', () => {
  it('性别英文别名归一为中文', () => {
    const a = adaptIztroChartData({ gender: 'MALE', palaces: [] })
    expect(a.gender).toBe('男')
    const b = adaptIztroChartData({ gender: 'female', palaces: [] })
    expect(b.gender).toBe('女')
  })

  it('宫位天干地支别名与星曜列表归一', () => {
    const raw = {
      palaces: [
        {
          name: '命宫',
          tianGan: '甲',
          diZhi: '子',
          isBodyPalace: 0,
          majorStars: [{ name: '紫微', brightness: '庙', 四化: '禄' }],
          minorStars: [],
          adjectiveStars: [],
        },
      ],
    }
    const out = adaptIztroChartData(raw as Record<string, unknown>)
    const p = (out.palaces as Record<string, unknown>[])[0]!
    expect(p.heavenlyStem).toBe('甲')
    expect(p.earthlyBranch).toBe('子')
    expect(p.isBodyPalace).toBe(false)
    const majors = p.majorStars as Record<string, unknown>[]
    expect(majors[0]?.name).toBe('紫微')
    expect(majors[0]?.mutagen).toBe('禄')
  })

  it('horoscope.decadal/yearly 的 gan/zhi 对齐 heavenlyStem/earthlyBranch', () => {
    const raw = {
      palaces: [],
      horoscope: {
        decadal: { gan: '庚', zhi: '午' },
        yearly: { gan: '辛', zhi: '未' },
      },
    }
    const out = adaptIztroChartData(raw as Record<string, unknown>)
    const h = out.horoscope as Record<string, unknown>
    const dec = h.decadal as Record<string, unknown>
    const yr = h.yearly as Record<string, unknown>
    expect(dec.heavenlyStem).toBe('庚')
    expect(dec.earthlyBranch).toBe('午')
    expect(yr.heavenlyStem).toBe('辛')
    expect(yr.earthlyBranch).toBe('未')
  })
})
