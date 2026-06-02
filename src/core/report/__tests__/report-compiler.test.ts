/**
 * 报告编译器单元测试
 */

import { describe, it, expect } from 'vitest'
import { compileReportSkeleton, reportToMarkdown } from '../report-compiler'
import type { ReportCompilerInput } from '../types'

function makeInput(overrides?: Partial<ReportCompilerInput>): ReportCompilerInput {
  return {
    matterType: '求财',
    queryYear: 2026,
    compositeScore: 6.8,
    scoreLabel: '顺畅推进',
    directionMatrix: ['吉', '吉'],
    directionWindow: '最佳推进窗口',
    aiSummary: '你今年的财运整体偏向顺利，可以积极把握投资机会。',
    analysisSummary: {
      innateBase: '财帛宫天相吉旺，先天财运底子不错',
      fortuneTrend: '大限命宫迁移宫天梁吉旺，十年内贵人运增强',
      yearlyTrigger: '流年命宫夫妻宫天相关键，合作求财有利',
      compositeConclusion: '综合评分 6.8，属于顺畅推进档次，建议积极把握',
      riskAdvice: '注意化忌星对子女宫的冲击，避免冲动投资',
    },
    personalityAnchor: '天同+太阴的性格底色，温和细腻，善于察言观色',
    primaryPalace: '财帛宫',
    primaryScore: 7.8,
    primaryBrightness: '吉旺',
    causalChain: '天同化禄→命宫→增强求财底气',
    sihuaLandingText: '生年化禄廉贞→命宫，太岁化禄贪狼→迁移宫',
    ...overrides,
  }
}

describe('report-compiler', () => {
  describe('compileReportSkeleton', () => {
    it('生成完整的报告骨架', () => {
      const input = makeInput()
      const report = compileReportSkeleton(input)

      expect(report.matterType).toBe('求财')
      expect(report.queryYear).toBe(2026)
      expect(report.metadata.compositeScore).toBe(6.8)
      expect(report.metadata.scoreLabel).toBe('顺畅推进')
    })

    it('包含所有章节', () => {
      const input = makeInput()
      const report = compileReportSkeleton(input)

      expect(report.sections.innateAura).toBeTruthy()
      expect(report.sections.decadalTrend).toBeTruthy()
      expect(report.sections.yearlyAnalysis).toBeTruthy()
      expect(report.sections.compositeConclusion).toBeTruthy()
    })

    it('无 analysisSummary 时不崩溃', () => {
      const input = makeInput({ analysisSummary: undefined })
      const report = compileReportSkeleton(input)
      expect(report.sections.innateAura).toBeTruthy()
    })

    it('方向矩阵正确映射', () => {
      const input = makeInput({ directionMatrix: ['凶', '凶'] })
      const report = compileReportSkeleton(input)
      expect(report.sections.yearlyAnalysis).toContain('风险最高')
    })
  })

  describe('reportToMarkdown', () => {
    it('生成有效 Markdown', () => {
      const input = makeInput()
      const report = compileReportSkeleton(input)
      const md = reportToMarkdown(report)

      expect(md).toContain('# 求财分析报告')
      expect(md).toContain('## 一、原局气场')
      expect(md).toContain('## 二、大限十年走势')
      expect(md).toContain('## 三、2026年流年分析')
      expect(md).toContain('## 四、综合结论与建议')
      expect(md).toContain('6.8 / 10')
    })
  })
})
