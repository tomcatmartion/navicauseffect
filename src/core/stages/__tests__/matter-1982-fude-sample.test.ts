/**
 * 1982-05-05 18:00 男 / 求财→福德 管线样例（文档 §16 数据来源）
 */
import { describe, it, expect } from 'vitest'
import { astro } from 'iztro'
import {
  serializeAstrolabeForReading,
  serializeHoroscopeForReading,
} from '@/lib/ziwei/serialize-chart-for-reading'
import { runCoreChartStages } from '@/core/pipeline/run-chart-stages'
import { resolveMatterRoute } from '@/core/router/matter-route-resolver'

describe('1982-05-05 男 / 求财路由福德 — 管线样例', () => {
  const timeIndex = 9 // 酉时 17–19
  const targetYear = 2026
  const question = '我想做股票期货投资赚钱'

  const astrolabe = astro.bySolar('1982-05-05', timeIndex, '男', true)
  const horoscope = astrolabe.horoscope(new Date(targetYear, 4, 5), timeIndex)
  const chartData = serializeAstrolabeForReading(
    astrolabe as unknown as Record<string, unknown>,
    { year: 1982, month: 5, day: 5, hour: 18, gender: '男', solar: true },
    {
      horoscope: serializeHoroscopeForReading(horoscope, targetYear),
      referenceYear: targetYear,
    },
  )

  const route = resolveMatterRoute('求财', question)
  const result = runCoreChartStages(chartData as unknown as Record<string, unknown>, {
    matterType: '求财',
    question,
    targetYear,
    routingAnswers: route.routingAnswers,
  })

  const { stage1, stage2, stage3 } = result
  const currentDx = stage3.daXianTimeline?.find((d) => d.isCurrent)

  it('路由到福德 + wealth_1=invest', () => {
    expect(route.primaryPalace).toBe('福德')
    expect(route.routingAnswers.wealth_1).toBe('invest')
    expect(route.secondaryPalaces.length).toBeGreaterThan(0)
  })

  it('2026 年落第 5 限（官禄壬）', () => {
    expect(currentDx?.index).toBe(5)
    expect(currentDx?.mingPalaceName).toBe('官禄')
    expect(currentDx?.daXianGan).toBe('壬')
    expect(stage3.currentDaXianDetail?.mingPalaceName).toBe('官禄')
  })

  it('Stage3 主宫=福德，四维本宫指向福德', () => {
    expect(stage3.primaryAnalysis.palace).toBe('福德')
    expect(stage3.fourDimensionFocus?.some((s) => s.includes('福德'))).toBe(true)
    expect(stage3.analysisSummary.innateBase).toContain('福德')
  })

  it('0530 扩展：引动与运限独立评分', () => {
    expect(stage3.sihuaTriggers?.length).toBeGreaterThan(0)
    expect(stage3.daXianPalaceScores).toHaveLength(12)
    expect(stage3.liuNianPalaceScores).toHaveLength(12)
    expect(stage3.lifeTrend).toBeTruthy()
    expect(stage3.capabilityMatch).toBeTruthy()
  })

  it('dump 文档样例 JSON', () => {
    const sample = {
      input: {
        solarDate: '1982-05-05',
        hour: 18,
        timeIndex,
        gender: '男',
        targetYear,
        matterType: '求财',
        question,
      },
      route: {
        primaryPalace: route.primaryPalace,
        secondaryPalaces: route.secondaryPalaces,
        routingAnswers: route.routingAnswers,
        specialConditions: route.specialConditions,
      },
      stage1: {
        birthGan: stage1.scoringCtx.birthGan,
        taiSuiZhi: stage1.scoringCtx.taiSuiZhi,
        mingPalaceScore: stage1.palaceScores.find(p => p.palace === '命宫')?.finalScore,
        palaceFinalScores: Object.fromEntries(
          ['命宫', '福德', '财帛', '官禄', '迁移'].map((name) => [
            name,
            stage1.palaceScores.find((p) => p.palace === name)?.finalScore,
          ]),
        ),
      },
      stage2: {
        overallTone: stage2.overallTone,
        personalityTriadSynthesis: stage2.personalityTriad?.synthesis,
      },
      horoscopeDecadal: (chartData.horoscope as Record<string, unknown>)?.decadal,
      stage3: {
        primaryPalace: stage3.primaryAnalysis.palace,
        compositeScore: stage3.compositeScore,
        scoreLabel: stage3.scoreLabel,
        scoreAction: stage3.scoreAction,
        directionWindow: stage3.directionWindow,
        directionMatrix: stage3.directionMatrix,
        fourDimension: stage3.fourDimension,
        fourDimensionFocus: stage3.fourDimensionFocus,
        analysisSummary: stage3.analysisSummary,
        currentDaXianDetail: stage3.currentDaXianDetail,
        timeDimensions: stage3.timeDimensions,
        personalityInfluence: stage3.personalityInfluence,
        secondaryPalaceSnapshots: stage3.secondaryPalaceSnapshots,
        scoreBreakdown: stage3.scoreBreakdown,
        primaryAnalysis: stage3.primaryAnalysis,
        currentDaXianQualitative: stage3.currentDaXianQualitative,
        liuYueDataAvailable: stage3.liuYueDataAvailable,
        sihuaTriggers: stage3.sihuaTriggers,
        daXianPalaceScores: stage3.daXianPalaceScores,
        liuNianPalaceScores: stage3.liuNianPalaceScores,
        lifeTrend: stage3.lifeTrend,
        capabilityMatch: stage3.capabilityMatch,
      },
    }
    console.log('\n=== MATTER_1982_SAMPLE ===\n' + JSON.stringify(sample, null, 2))
    expect(stage3.compositeScore).toBeGreaterThan(0)
  })
})
