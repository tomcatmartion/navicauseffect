import { describe, it, expect } from 'vitest'
import { findCurrentDaXianFromChart } from '../fortune-engine'
import type { DaXianPalaceMapping, PalaceName, TianGan } from '@/core/types'

function mockMappings(): DaXianPalaceMapping[] {
  const specs: Array<[number, [number, number], TianGan, PalaceName]> = [
    [1, [5, 14], '甲', '命宫'],
    [2, [15, 24], '乙', '父母'],
    [3, [25, 34], '丙', '福德'],
    [4, [35, 44], '丁', '田宅'],
    [5, [45, 54], '壬', '官禄'],
  ]
  return specs.map(([index, ageRange, daXianGan, mingPalaceName]) => ({
    index,
    ageRange,
    daXianGan,
    mingPalaceName,
    palaceIndex: 0,
    mutagen: [],
  }))
}

describe('findCurrentDaXianFromChart', () => {
  const mappings = mockMappings()

  it('无 horoscope 时用虚岁匹配（非实岁）', () => {
    const hit = findCurrentDaXianFromChart(mappings, 2026, 1982)
    expect(hit?.index).toBe(5)
    expect(hit?.ageRange).toEqual([45, 54])
  })

  it('实岁 44 不应命中第 4 限', () => {
    const hit = findCurrentDaXianFromChart(mappings, 2026, 1982)
    expect(hit?.index).not.toBe(4)
  })

  it('horoscope 对齐时用 decadal.index 作为大限命宫', () => {
    const hit = findCurrentDaXianFromChart(mappings, 2026, 1982, {
      horoscope: {
        referenceYear: 2026,
        age: { nominalAge: 45 },
        decadal: {
          heavenlyStem: '壬',
          index: 4,
          mutagen: ['武曲', '天梁', '紫微', '破军'],
        },
      },
    })
    expect(hit?.index).toBe(5)
    expect(hit?.mingPalaceName).toBe('官禄')
    expect(hit?.daXianGan).toBe('壬')
  })

  it('referenceYear 不对齐时回退虚岁匹配', () => {
    const hit = findCurrentDaXianFromChart(mappings, 2026, 1982, {
      horoscope: {
        referenceYear: 2025,
        decadal: { heavenlyStem: '丁', index: 3, mutagen: [] },
      },
    })
    expect(hit?.index).toBe(5)
  })
})
