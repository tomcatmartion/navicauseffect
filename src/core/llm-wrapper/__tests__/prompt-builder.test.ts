import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@/core/llm-wrapper/prompt-builder'
import type { IRStage1, IRStage3or4 } from '@/core/types'

function makeStage1IR(): IRStage1 {
  return {
    stage: 1,
    palaceScores: [
      { palace: '兄弟', diZhi: '丑', finalScore: 5, tone: '磨炼' },
      { palace: '命宫', diZhi: '子', finalScore: 8, tone: '实旺' },
    ],
    allPatterns: [{ name: '测试格', level: '中吉', multiplier: 1, category: 'test' }],
    mergedSihua: {
      entries: [{ type: '化禄', star: '廉贞', source: '生年' }],
      specialOverlaps: [],
    },
    hasParentInfo: false,
  } as unknown as IRStage1
}

function makeStage3IR(): IRStage3or4 {
  return {
    stage: 3,
    matterType: '求财',
    primaryAnalysis: {
      palace: '财帛',
      fourDimensionResult: '四维摘要',
      mingGongRegulation: '命宫调节',
      protectionStatus: '有保护',
      innateLevel: '中上',
    },
    daXianAnalysis: [
      {
        index: 3,
        ageRange: '32–41',
        daXianGan: '戊',
        sihuaPositions: ['化禄入迁移'],
        tone: '转机期',
        isCurrent: true,
      },
    ],
    liuNianAnalysis: {
      liuNianGan: '甲',
      sihuaPositions: ['化忌入夫妻'],
      direction: '凶',
      daXianRelation: '凶吉',
      window: '风险期',
    },
  } as unknown as IRStage3or4
}

describe('prompt-builder', () => {
  it('阶段一 IR 文本命宫评分优先、且不含错误并入的代码注释', () => {
    const msgs = buildPrompt(makeStage1IR(), [], '你好')
    const irBlock = msgs.find(m => m.role === 'system' && m.content.startsWith('【计算结果 IR】'))?.content ?? ''
    expect(irBlock).toContain('十二宫评分：')
    expect(irBlock.indexOf('命宫')).toBeLessThan(irBlock.indexOf('兄弟'))
    expect(irBlock).not.toMatch(/\/\/ ══/)
  })

  it('阶段三 IR 为结构化摘要而非整段 JSON.stringify', () => {
    const msgs = buildPrompt(makeStage3IR(), [], '看财运')
    const irBlock = msgs.find(m => m.role === 'system' && m.content.startsWith('【计算结果 IR】'))?.content ?? ''
    expect(irBlock).toContain('摘要，非全量 JSON')
    expect(irBlock).toContain('主看宫：财帛')
    expect(irBlock).toContain('第3大限')
    expect(irBlock).toContain('流年干甲')
    expect(irBlock).not.toContain('"primaryAnalysis"')
  })
})
