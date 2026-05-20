/**
 * 性格分析调试测试
 * 输出三宫四维标签详情
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { CHART_FIXTURE } from './chart-fixture'

let stage1Output: ReturnType<typeof executeStage1>
let stage2Output: ReturnType<typeof executeStage2>

beforeAll(() => {
  stage1Output = executeStage1({ chartData: CHART_FIXTURE })
  stage2Output = executeStage2({ stage1: stage1Output, question: '性格分析' })
})

describe('性格分析调试: 三宫四维标签', () => {
  it('应输出命宫四维标签', () => {
    const tags = stage2Output.mingGongTags
    console.log('\n=== 命宫四维标签 ===')
    console.log('宫位:', tags.palace, tags.diZhi)
    console.log('本宫标签:', tags.selfTags)
    console.log('对宫标签:', tags.oppositeTags)
    console.log('三合标签:', tags.trineTags)
    console.log('夹宫标签:', tags.flankingTags)
    console.log('综合:', tags.summary)

    expect(tags.selfTags.length).toBeGreaterThan(0)
  })

  it('应输出身宫四维标签', () => {
    const tags = stage2Output.shenGongTags
    console.log('\n=== 身宫四维标签 ===')
    console.log('宫位:', tags.palace, tags.diZhi)
    console.log('本宫标签:', tags.selfTags)
    console.log('对宫标签:', tags.oppositeTags)
    console.log('三合标签:', tags.trineTags)
    console.log('夹宫标签:', tags.flankingTags)
    console.log('综合:', tags.summary)

    expect(tags.selfTags.length).toBeGreaterThan(0)
  })

  it('应输出太岁宫四维标签', () => {
    const tags = stage2Output.taiSuiTags
    console.log('\n=== 太岁宫四维标签 ===')
    console.log('宫位:', tags.palace, tags.diZhi)
    console.log('本宫标签:', tags.selfTags)
    console.log('对宫标签:', tags.oppositeTags)
    console.log('三合标签:', tags.trineTags)
    console.log('夹宫标签:', tags.flankingTags)
    console.log('综合:', tags.summary)

    expect(tags.selfTags.length).toBeGreaterThan(0)
  })

  it('应输出全息底色', () => {
    const base = stage2Output.mingGongHolographic
    console.log('\n=== 命宫全息底色 ===')
    console.log('四化方向:', base.sihuaDirection)
    console.log('吉星影响:', base.auspiciousEffect)
    console.log('煞星影响:', base.inauspiciousEffect)
    console.log('丙丁级星:', base.minorEffect)
    console.log('综合底色:', base.summary)

    expect(base.summary).toBeTruthy()
  })

  it('应输出整体基调', () => {
    console.log('\n=== 整体基调 ===')
    console.log(stage2Output.overallTone)

    expect(stage2Output.overallTone).toBeTruthy()
  })
})
