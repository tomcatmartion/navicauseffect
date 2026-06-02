/**
 * 报告编译器 — 从 Stage3 数据编译结构化命理解读报告
 *
 * 两阶段：
 * 1. 程序编译骨架（确定性数据填充）
 * 2. LLM 润色（可选，使语言更温暖自然）
 *
 * 报告格式对齐 data/User Prompt.md
 */

import type { CompiledReport, ReportCompilerInput } from './types'

/**
 * 编译报告骨架（程序确定性输出）
 *
 * 从 Stage3 的分析摘要、评分数据等直接填充报告结构，
 * 不调用 LLM，避免幻觉。
 */
export function compileReportSkeleton(input: ReportCompilerInput): CompiledReport {
  const { matterType, queryYear, compositeScore, scoreLabel, directionMatrix, directionWindow } = input
  const summary = input.analysisSummary

  // ── 原局气场 ──
  const innateAura = buildInnateAura(input)

  // ── 大限十年走势 ──
  const decadalTrend = buildDecadalTrend(input)

  // ── 流年分析 ──
  const yearlyAnalysis = buildYearlyAnalysis(input)

  // ── 综合结论 ──
  const compositeConclusion = buildCompositeConclusion(input)

  return {
    matterType,
    queryYear,
    mode: '未发生',
    sections: {
      innateAura,
      decadalTrend,
      yearlyAnalysis,
      compositeConclusion,
    },
    metadata: {
      compositeScore,
      scoreLabel,
      directionMatrix,
      directionWindow,
    },
  }
}

/**
 * 将编译后的报告转换为 Markdown 文本
 */
export function reportToMarkdown(report: CompiledReport): string {
  const { matterType, queryYear, sections, metadata } = report
  const lines: string[] = []

  lines.push(`# ${matterType}分析报告`)
  lines.push('')
  lines.push(`## 事件时间判断`)
  lines.push(`- 分析模式：${report.mode}`)
  lines.push(`- 以当前年份 ${queryYear} 为分析重点`)
  lines.push('')

  lines.push(`## 一、原局气场`)
  lines.push(sections.innateAura)
  lines.push('')

  lines.push(`## 二、大限十年走势`)
  lines.push(sections.decadalTrend)
  lines.push('')

  lines.push(`## 三、${queryYear}年流年分析（${report.mode}模式）`)
  lines.push(sections.yearlyAnalysis)
  lines.push('')

  lines.push(`## 四、综合结论与建议`)
  lines.push(sections.compositeConclusion)
  lines.push('')

  lines.push(`### 综合评分`)
  lines.push(`- 得分：${metadata.compositeScore.toFixed(1)} / 10`)
  lines.push(`- 档位：${metadata.scoreLabel}`)
  lines.push(`- 方向：${metadata.directionMatrix[0]}${metadata.directionMatrix[1]}（${metadata.directionWindow}）`)

  return lines.join('\n')
}

// ── 章节构建函数 ──────────────────────────────────────────

function buildInnateAura(input: ReportCompilerInput): string {
  const lines: string[] = []

  lines.push(`### 事项核心宫位：${input.primaryPalace}`)
  lines.push(`- 评分：${input.primaryScore.toFixed(1)}，等级：${mapLevel(input.primaryBrightness)}`)
  if (input.analysisSummary) {
    lines.push(`- 先天底盘：${input.analysisSummary.innateBase}`)
  }
  lines.push('')

  if (input.personalityAnchor) {
    lines.push(`### 性格底色`)
    lines.push(input.personalityAnchor)
    lines.push('')
  }

  if (input.analysisSummary) {
    lines.push(`### 原局总结`)
    lines.push(`- 先天事项气场：${input.analysisSummary.innateBase}`)
    lines.push(`- 关键特征：${input.analysisSummary.innateBase}`)
  }

  return lines.join('\n')
}

function buildDecadalTrend(input: ReportCompilerInput): string {
  const lines: string[] = []

  if (input.analysisSummary) {
    lines.push(`### 十年走势`)
    lines.push(input.analysisSummary.fortuneTrend)
  }

  if (input.sihuaLandingText) {
    lines.push('')
    lines.push(`### 四化引动`)
    lines.push(input.sihuaLandingText)
  }

  if (input.causalChain) {
    lines.push('')
    lines.push(`### 因果链`)
    lines.push(input.causalChain)
  }

  if (lines.length === 0) {
    lines.push('（暂无大限分析数据）')
  }

  return lines.join('\n')
}

function buildYearlyAnalysis(input: ReportCompilerInput): string {
  const lines: string[] = []
  const [dx, ln] = input.directionMatrix
  const direction = dx === '吉' && ln === '吉' ? '最佳推进窗口'
    : dx === '吉' && ln === '凶' ? '部分化解（谨慎推进）'
    : dx === '凶' && ln === '吉' ? '有波折干扰（维持为主）'
    : '风险最高（预警规避）'

  lines.push(`### 方向判断`)
  lines.push(`- 大限方向：${dx}，流年方向：${ln}`)
  lines.push(`- 窗口定性：${input.directionWindow}`)
  lines.push(`- 综合判断：${direction}`)
  lines.push('')

  if (input.analysisSummary) {
    lines.push(`### 流年引动`)
    lines.push(input.analysisSummary.yearlyTrigger)
  }

  return lines.join('\n')
}

function buildCompositeConclusion(input: ReportCompilerInput): string {
  const lines: string[] = []

  if (input.analysisSummary) {
    lines.push(`### 核心结论`)
    lines.push(input.analysisSummary.compositeConclusion)
    lines.push('')

    lines.push(`### 风险提示`)
    lines.push(input.analysisSummary.riskAdvice)
    lines.push('')
  }

  lines.push(`### AI 解读摘要`)
  lines.push(input.aiSummary || '（暂无 AI 解读）')

  return lines.join('\n')
}

// ── 辅助函数 ──────────────────────────────────────────────

function mapLevel(brightness: string): string {
  switch (brightness) {
    case '吉旺': return '强旺'
    case '凶弱': return '偏弱'
    default: return '一般'
  }
}
