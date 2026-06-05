/**
 * 1982年9月24日4点男性命盘 - 半空折翅格局调试
 */

import { describe, test, expect } from 'vitest'
import { bySolar } from 'iztro/lib/astro/astro'
import { executeStage1 } from '../stage1-palace-scoring'
import { getSanFangSiZheng, isLuoXian, isJiGeYinDong } from '@/core/energy-evaluator/patterns/types'

function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  return {
    solarDate,
    gender,
    earthlyBranchOfSoulPalace: iztroChart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: iztroChart.earthlyBranchOfBodyPalace,
    palaces: iztroChart.palaces.map((p: any) => ({
      name: p.name,
      earthlyBranch: p.earthlyBranch,
      heavenlyStem: p.heavenlyStem,
      majorStars: p.majorStars.map((s: any) => ({
        name: s.name,
        brightness: s.brightness,
        mutagen: s.mutagen,
        type: 'major',
      })),
      minorStars: p.minorStars.map((s: any) => ({
        name: s.name,
        mutagen: s.mutagen,
        type: 'soft',
      })),
      adjectiveStars: p.adjectiveStars?.map((s: any) => ({
        name: s.name,
        type: 'adjective',
      })) ?? [],
      isBodyPalace: p.isBodyPalace,
      decadal: null,
    })),
  }
}

describe('1982年9月24日4点男性 - 半空折翅格局调试', () => {
  test('分析半空折翅触发条件', () => {
    const chartData = buildChartData('1982-09-24', 2, '男')

    console.log('\n========================================')
    console.log('半空折翅格局触发分析')
    console.log('========================================')

    // 模拟半空折翅的判定逻辑
    for (let i = 0; i < 12; i++) {
      const p = (chartData.palaces as any[])[i]
      const stars = p.majorStars.map((s: any) => ({ star: s.name, brightness: s.brightness }))

      // 条件1: 主星落陷
      if (stars.length === 0) continue
      const mainStarLuoXian = stars.some((s: any) => isLuoXian(s.brightness))
      if (!mainStarLuoXian) continue

      // 获取三方四正
      const palaceIndices = [i, (i + 6) % 12, (i + 4) % 12, (i + 8) % 12]

      // 条件2: 同时见地空和地劫
      const allPalaces = palaceIndices.map(idx => (chartData.palaces as any[])[idx])
      const hasKong = allPalaces.some(palace =>
        palace.minorStars.some((s: any) => s.name === '地空') ||
        palace.adjectiveStars.some((s: any) => s.name === '地空')
      )
      const hasJie = allPalaces.some(palace =>
        palace.minorStars.some((s: any) => s.name === '地劫') ||
        palace.adjectiveStars.some((s: any) => s.name === '地劫')
      )

      console.log(`\n宫位 ${i} (${p.name} - ${p.earthlyBranch}):`)
      console.log(`  主星: ${stars.map((s: any) => `${s.star}(${s.brightness})`).join(', ')}`)
      console.log(`  主星落陷: ${mainStarLuoXian ? '是' : '否'}`)
      console.log(`  三方四正宫位: ${palaceIndices.map(idx => `${idx}(${(chartData.palaces as any[])[idx].name})`).join(', ')}`)
      console.log(`  地空: ${hasKong ? '有' : '无'}`)
      console.log(`  地劫: ${hasJie ? '有' : '无'}`)

      if (hasKong && hasJie) {
        // 统计三方四正吉凶
        let jiCount = 0
        let shaCount = 0
        const jiXing = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存']
        const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']

        for (const idx of palaceIndices) {
          const palace = (chartData.palaces as any[])[idx]
          for (const s of palace.minorStars) {
            if (jiXing.includes(s.name)) jiCount++
            if (shaXing.includes(s.name)) shaCount++
          }
        }

        console.log(`  ⚠️ 满足地空+地劫条件！`)
        console.log(`  吉星数: ${jiCount}, 煞星数: ${shaCount}`)
        console.log(`  凶格引动(煞>吉): ${shaCount > jiCount ? '是 ✓ 触发半空折翅' : '否'}`)
      }
    }

    // 运行实际格局识别
    const result = executeStage1({ chartData: chartData as Record<string, unknown>, parentBirthYears: {} })
    const banKong = result.allPatterns.find(p => p.name === '半空折翅')

    console.log('\n=== 实际识别结果 ===')
    console.log('半空折翅:', banKong ? '识别到' : '未识别到')
    console.log('所有格局:', result.allPatterns.map(p => p.name).join(', '))

    expect(true).toBe(true)
  })
})
