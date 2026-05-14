/**
 * M1: 四化计算器单元测试
 *
 * 测试用例来源：SKILL_原局四化读取规则 V1.0 完整示例
 */

import { describe, it, expect } from 'vitest'
import {
  getShengNianSihua,
  getDunGanSihua,
  calculateOriginalSihua,
  mergeWithOverlap,
} from '../calculator'
import { getDunGan } from '../tables'

describe('M1: 四化计算器', () => {
  // ═══════════════════════════════════════════════════════════
  // 生年四化
  // ═══════════════════════════════════════════════════════════

  describe('getShengNianSihua', () => {
    it('壬年四化：天梁禄/紫微权/左辅科/武曲忌', () => {
      const result = getShengNianSihua('壬')
      expect(result).toEqual({
        禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲',
      })
    })

    it('甲年四化：廉贞禄/破军权/武曲科/太阳忌', () => {
      const result = getShengNianSihua('甲')
      expect(result).toEqual({
        禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳',
      })
    })

    it('癸年四化：破军禄/巨门权/太阳科/贪狼忌', () => {
      const result = getShengNianSihua('癸')
      expect(result).toEqual({
        禄: '破军', 权: '巨门', 科: '太阳', 忌: '贪狼',
      })
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 五虎遁 + 太岁宫宫干四化
  // ═══════════════════════════════════════════════════════════

  describe('getDunGan', () => {
    it('壬年太岁宫戌 → 遁干庚', () => {
      expect(getDunGan('壬', '戌')).toBe('庚')
    })

    it('甲年太岁宫寅 → 遁干丙', () => {
      expect(getDunGan('甲', '寅')).toBe('丙')
    })

    it('己年太岁宫午 → 遁干庚（甲己同组）', () => {
      expect(getDunGan('己', '午')).toBe('庚')
    })
  })

  describe('getDunGanSihua', () => {
    it('壬年太岁宫戌 → 遁干庚 → 庚年四化', () => {
      const result = getDunGanSihua('壬', '戌')
      expect(result).toEqual({
        禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同',
      })
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 完整计算 + 特殊叠加
  // ═══════════════════════════════════════════════════════════

  describe('calculateOriginalSihua — 文档示例：壬戌年命主', () => {
    it('完整计算结果与文档一致', () => {
      const result = calculateOriginalSihua('壬', '戌')

      // 生年四化
      expect(result.shengNian).toEqual({
        禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲',
      })

      // 太岁宫宫干四化
      expect(result.dunGan).toEqual({
        禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同',
      })

      // 特殊叠加：武曲 生年忌 + 遁干权 → 权忌交冲
      const quanJi = result.specialOverlaps.find(o => o.type === '权忌交冲')
      expect(quanJi).toBeDefined()
      expect(quanJi!.star).toBe('武曲')
    })

    it('条目总数为8条', () => {
      const result = calculateOriginalSihua('壬', '戌')
      expect(result.entries).toHaveLength(8)
      const taiSuiStemEntries = result.entries.filter(e => e.source === '太岁宫宫干四化')
      expect(taiSuiStemEntries).toHaveLength(4)
    })
  })

  describe('特殊叠加检测', () => {
    it('双忌叠压：当生年忌 === 遁干忌时触发', () => {
      // 构造一个双忌场景：生年忌=巨门，遁干忌也是巨门
      const shengNian = { 禄: '天梁' as const, 权: '紫微' as const, 科: '左辅' as const, 忌: '巨门' as const }
      const dunGan = { 禄: '太阳' as const, 权: '武曲' as const, 科: '太阴' as const, 忌: '巨门' as const }
      const result = mergeWithOverlap(shengNian, dunGan)
      const doubleJi = result.specialOverlaps.find(o => o.type === '双忌叠压')
      expect(doubleJi).toBeDefined()
      expect(doubleJi!.star).toBe('巨门')
    })

    it('双禄叠加：当生年禄 === 遁干禄时触发', () => {
      const shengNian = { 禄: '天梁' as const, 权: '紫微' as const, 科: '左辅' as const, 忌: '武曲' as const }
      const dunGan = { 禄: '天梁' as const, 权: '武曲' as const, 科: '太阴' as const, 忌: '天同' as const }
      const result = mergeWithOverlap(shengNian, dunGan)
      const doubleLu = result.specialOverlaps.find(o => o.type === '双禄叠加')
      expect(doubleLu).toBeDefined()
      expect(doubleLu!.star).toBe('天梁')
    })

    it('禄忌同星', () => {
      const shengNian = { 禄: '天同' as const, 权: '紫微' as const, 科: '左辅' as const, 忌: '武曲' as const }
      const dunGan = { 禄: '武曲' as const, 权: '太阳' as const, 科: '太阴' as const, 忌: '天同' as const }
      const result = mergeWithOverlap(shengNian, dunGan)
      // 武曲：生年忌 + 遁干禄 → 禄忌同星
      // 天同：生年禄 + 遁干忌 → 禄忌同星
      const luJi = result.specialOverlaps.filter(o => o.type === '禄忌同星')
      expect(luJi).toHaveLength(2)
    })
  })
})
