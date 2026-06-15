/**
 * 1982年9月24日4点男性命盘 — 官禄宫得分及禄存计分验证
 */

import { describe, test, expect } from 'vitest'
import { executeStage1 } from '../stage1-palace-scoring'
import { bySolar } from 'iztro/lib/astro/astro'
import { evaluateSinglePalace } from '@/core/energy-evaluator/scoring-flow'
import { readChartFromData, normalizedChartToScoringContext } from '@/core/data-reader/iztro-reader'
import { calculateOriginalSihua } from '@/core/sihua-calculator'
import { applySihuaAndAnnotate } from '../helpers/sihua-applier'

function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  return {
    solarDate,
    gender,
    heavenlyStem: (iztroChart as any).heavenlyStem,
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

describe('1982年9月24日4点男性 — 官禄宫得分及禄存验证', () => {
  const chartData = buildChartData('1982-09-24', 2, '男')
  const input = {
    chartData: chartData as Record<string, unknown>,
    parentBirthYears: {},
  }

  test('应输出完整命盘十二宫信息', () => {
    console.log('\n========================================')
    console.log('1982年9月24日4点男性命盘')
    console.log('========================================')
    console.log(`天干: ${(chartData as any).heavenlyStem}`)
    console.log(`命宫地支: ${(chartData as any).earthlyBranchOfSoulPalace}`)
    console.log(`身宫地支: ${(chartData as any).earthlyBranchOfBodyPalace}`)

    console.log('\n=== 十二宫星曜分布 ===')
    for (const p of chartData.palaces as any[]) {
      const major = p.majorStars.map((s: any) => `${s.name}(${s.brightness})${s.mutagen ? '[' + s.mutagen + ']' : ''}`).join(', ')
      const minor = p.minorStars.map((s: any) => `${s.name}(${s.brightness})${s.mutagen ? '[' + s.mutagen + ']' : ''}`).join(', ')
      const adj = (p.adjectiveStars as any[]).map((s: any) => s.name).join(', ')
      const bodyMark = p.isBodyPalace ? ' [身宫]' : ''
      console.log(`${p.name}(${p.earthlyBranch}): 主星[${major}] 辅星[${minor}] 丙丁[${adj}]${bodyMark}`)
    }

    expect(chartData.palaces.length).toBe(12)
  })

  test('应计算并输出官禄宫详细得分', () => {
    // 手动构建评分上下文并计算官禄宫得分
    const chart = readChartFromData(chartData as Record<string, unknown>)
    const scoringCtx = normalizedChartToScoringContext(chart)
    const rawSihua = calculateOriginalSihua(scoringCtx.birthGan, scoringCtx.taiSuiZhi)
    const mergedSihua = applySihuaAndAnnotate(scoringCtx, rawSihua)

    // 找到官禄宫索引
    const palaceNames = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟']
    const gongLuIdx = palaceNames.indexOf('官禄')

    console.log('\n=== 官禄宫详细得分 ===')
    console.log(`官禄宫索引: ${gongLuIdx}`)
    console.log(`官禄宫地支: ${scoringCtx.palaces[gongLuIdx]?.diZhi}`)
    console.log(`官禄宫天干: ${scoringCtx.palaces[gongLuIdx]?.tianGan}`)
    console.log(`官禄宫主星: ${scoringCtx.palaces[gongLuIdx]?.majorStars.map(ms => `${ms.star}(${ms.brightness})`).join(', ')}`)
    console.log(`官禄宫所有星: ${scoringCtx.palaces[gongLuIdx]?.stars.map(s => s.name + (s.sihua ? `(${s.sihua})` : '')).join(', ')}`)
    console.log(`官禄宫 hasLuCun: ${scoringCtx.palaces[gongLuIdx]?.hasLuCun}`)

    // 计算官禄宫得分
    const score = evaluateSinglePalace(gongLuIdx, scoringCtx)

    console.log(`\n--- 官禄宫评分详情 ---`)
    console.log(`骨架基础分: ${score.skeletonScore}`)
    console.log(`天花板: ${score.ceiling}`)
    console.log(`加分总计: ${score.bonusTotal}`)
    console.log(`减分总计: ${score.penaltyTotal}`)
    console.log(`禄存调整: ${score.luCunDelta}`)
    console.log(`加分后分数: ${score.scoreAfterBonus}`)
    console.log(`减分后分数: ${score.scoreAfterPenalty}`)
    console.log(`禄存后分数: ${score.scoreAfterLuCun}`)
    console.log(`最终分数: ${score.finalScore}`)
    console.log(`基调: ${score.tone}`)
    console.log(`旺弱标签: ${score.warmCoolLabel}`)

    console.log(`\n--- 加分详情 ---`)
    for (const [k, v] of Object.entries(score.bonusDetails)) {
      if (v !== 0 && v !== 1.0) console.log(`  ${k}: ${v}`)
    }

    console.log(`\n--- 减分详情 ---`)
    for (const [k, v] of Object.entries(score.penaltyDetails)) {
      if (v !== 0 && v !== 1.0) console.log(`  ${k}: ${v}`)
    }

    expect(score.palace).toBe('官禄')
  })

  test('应验证禄存是否在三方四正及本宫分布', () => {
    const chart = readChartFromData(chartData as Record<string, unknown>)
    const scoringCtx = normalizedChartToScoringContext(chart)
    const palaceNames = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟']
    const gongLuIdx = palaceNames.indexOf('官禄')

    // 官禄宫三方四正
    const sf = [
      gongLuIdx,
      (gongLuIdx + 6) % 12,
      (gongLuIdx + 4) % 12,
      (gongLuIdx + 8) % 12,
    ]

    console.log('\n=== 禄存分布验证 ===')
    console.log('官禄宫三方四正宫位:')
    for (const idx of sf) {
      const p = scoringCtx.palaces[idx]
      const hasLuCun = p.hasLuCun
      const stars = p.stars.map(s => s.name).join(', ')
      const isGongLu = idx === gongLuIdx ? ' <-- 官禄宫(本宫)' : ''
      console.log(`  ${palaceNames[idx]}(${p.diZhi}): hasLuCun=${hasLuCun}, 星曜=[${stars}]${isGongLu}`)
    }

    // 检查所有宫位禄存情况
    console.log('\n全盘禄存分布:')
    for (let i = 0; i < 12; i++) {
      const p = scoringCtx.palaces[i]
      if (p.hasLuCun || p.stars.some(s => s.name === '禄存')) {
        console.log(`  ${palaceNames[i]}(${p.diZhi}): 有禄存`)
      }
    }

    expect(scoringCtx.palaces.length).toBe(12)
  })
})
