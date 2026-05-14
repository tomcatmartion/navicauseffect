/**
 * M6: 知识字典单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  getStarAttr,
  getStarTraitByBrightness,
  getPalaceMeaning,
  isAuspicious,
  isInauspicious,
  getSubdueLevel,
  getFlankingDecay,
  getLuCunDelta,
} from '../query'

describe('M6: 知识字典', () => {
  describe('getStarAttr', () => {
    it('紫微赋性完整', () => {
      const attr = getStarAttr('紫微')
      expect(attr).not.toBeNull()
      expect(attr!.element).toBe('阴土')
      expect(attr!.coreTrait).toContain('帝座')
    })

    it('所有十四主星均可查询', () => {
      const stars = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'] as const
      for (const star of stars) {
        expect(getStarAttr(star)).not.toBeNull()
      }
    })

    it('不存在的主星返回 null', () => {
      // @ts-expect-error 测试非法输入
      expect(getStarAttr('不存在的星')).toBeNull()
    })
  })

  describe('getStarTraitByBrightness', () => {
    it('旺宫返回正面特质', () => {
      const result = getStarTraitByBrightness('紫微', '旺')
      expect(result).toContain('领袖')
    })

    it('陷宫返回负面特质', () => {
      const result = getStarTraitByBrightness('紫微', '陷')
      expect(result).toContain('孤君')
    })

    it('平宫返回核心赋性', () => {
      const result = getStarTraitByBrightness('紫微', '平')
      expect(result).toContain('帝座')
    })
  })

  describe('getPalaceMeaning', () => {
    it('命宫含义', () => {
      const meaning = getPalaceMeaning('命宫')
      expect(meaning).not.toBeNull()
      expect(meaning!.domains).toContain('外在表现')
    })

    it('财帛宫含义', () => {
      const meaning = getPalaceMeaning('财帛')
      expect(meaning).not.toBeNull()
      expect(meaning!.domains).toContain('收入方式')
    })
  })

  describe('星曜分类', () => {
    it('左辅是吉星', () => expect(isAuspicious('左辅')).toBe(true))
    it('擎羊是煞星', () => expect(isInauspicious('擎羊')).toBe(true))
    it('紫微不是吉星也不是煞星', () => {
      expect(isAuspicious('紫微')).toBe(false)
      expect(isInauspicious('紫微')).toBe(false)
    })
  })

  describe('getSubdueLevel', () => {
    it('紫微强制煞', () => expect(getSubdueLevel('紫微', '旺')).toBe('强制煞'))
    it('太阳旺宫中制煞', () => expect(getSubdueLevel('太阳', '旺')).toBe('中制煞'))
    it('太阳陷宫无制煞', () => expect(getSubdueLevel('太阳', '陷')).toBe('无'))
    it('天机弱制煞', () => expect(getSubdueLevel('天机', '旺')).toBe('弱制煞'))
  })

  describe('getFlankingDecay', () => {
    it('旺×旺 = 0.9', () => expect(getFlankingDecay('旺', '旺')).toBeCloseTo(0.9))
    it('弱×弱 = 0', () => expect(getFlankingDecay('陷', '极弱')).toBe(0))
    it('旺×弱 = 0.2', () => expect(getFlankingDecay('旺', '陷')).toBeCloseTo(0.2))
  })

  describe('getLuCunDelta', () => {
    it('旺宫 +0.3', () => expect(getLuCunDelta('旺')).toBe(0.3))
    it('平宫 0', () => expect(getLuCunDelta('平')).toBe(0))
    it('陷宫 -0.3', () => expect(getLuCunDelta('陷')).toBe(-0.3))
    it('空宫 -0.3', () => expect(getLuCunDelta('空')).toBe(-0.3))
  })
})
