/**
 * 报告场景的 Stage3 Governor 预解析器
 *
 * 职责：对每个 matterType 调用排盘页面同源的 buildStage3Messages（纯函数），
 * 让 AI 按 STAGE3_HINT 五阶段框架（原局底盘 → 行运脉络 → 流年引动 → 综合结论 → 追问）
 * 跑一遍解析，把解析文本回填到报告主调用 prompt。
 *
 * 设计要点：
 *  - 复用排盘页面同源链路：buildStage3Messages + callAI，保证口径一致
 *  - 并行：每个 matterType 独立 Promise，互不阻塞
 *  - 容错：单条失败降级到 stage3.analysisSummary 程序生成文本，不阻塞主报告
 *  - callAI 已内置 3 次重试 + 超时，外层不再加
 */
import 'server-only'
import { buildStage3Messages } from '@/orchestration/hybrid/orchestrator'
import { callAI, type ChatMessage } from '@/lib/ai/skill-callers'
import type { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import type { executeStage2 } from '@/core/stages/stage2-personality'
import type { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import type { MatterType } from '@/core/types'

type Stage1 = ReturnType<typeof executeStage1>
type Stage2 = ReturnType<typeof executeStage2>
type Stage3 = ReturnType<typeof executeStage3>

export interface ReportGovernorInput {
  stage1: Stage1
  stage2: Stage2
  /** 每个事项类型对应的 stage3 输出 */
  stage3List: Array<{ matterType: MatterType; stage3: Stage3 }>
  chartData: Record<string, unknown>
  targetYear: number
}

export interface ReportGovernorResult {
  matterType: MatterType
  /** AI 解析文本（五阶段框架输出）；失败时为程序降级文本 */
  analysisText: string
  /** 是否降级（true 表示 governor 调用失败，用了 stage3.analysisSummary） */
  degraded: boolean
}

/**
 * 从 stage3.analysisSummary 拼装降级文本（governor 调用失败时用）
 */
function buildDegradedText(matterType: MatterType, stage3: Stage3): string {
  const s = stage3.analysisSummary
  const lines: string[] = [`【${matterType} · 程序生成摘要（governor 降级）】`]
  if (s?.innateBase) lines.push(`原局底盘：${s.innateBase}`)
  if (s?.fortuneTrend) lines.push(`大限走向：${s.fortuneTrend}`)
  if (s?.yearlyTrigger) lines.push(`流年引动：${s.yearlyTrigger}`)
  if (s?.compositeConclusion) lines.push(`综合结论：${s.compositeConclusion}`)
  if (s?.riskAdvice) lines.push(`风险建议：${s.riskAdvice}`)
  if (typeof stage3.compositeScore === 'number') {
    lines.push(`综合评分：${stage3.compositeScore.toFixed(1)}/10（${stage3.scoreLabel ?? ''}）`)
  }
  return lines.join('\n')
}

/**
 * 对单个 matterType 执行 stage3 governor 调用
 */
async function runSingleGovernor(
  item: { matterType: MatterType; stage3: Stage3 },
  params: { stage1: Stage1; stage2: Stage2; chartData: Record<string, unknown>; targetYear: number },
): Promise<ReportGovernorResult> {
  const { matterType, stage3 } = item
  const { stage1, stage2, chartData, targetYear } = params

  try {
    const { messages } = buildStage3Messages(
      stage1,
      stage2,
      stage3,
      matterType,
      targetYear,
      chartData,
      '', // 报告场景无用户问题
    )
    const result = await callAI({
      messages: messages as ChatMessage[],
      temperature: 0.5,
      max_tokens: 4096,
    })
    const text = (result.content ?? '').trim()
    if (!text) {
      return { matterType, analysisText: buildDegradedText(matterType, stage3), degraded: true }
    }
    return { matterType, analysisText: text, degraded: false }
  } catch (err) {
    console.error(`[report-governor] ${matterType} 调用失败，降级到 analysisSummary:`,
      err instanceof Error ? err.message : err)
    return { matterType, analysisText: buildDegradedText(matterType, stage3), degraded: true }
  }
}

/**
 * 并行执行所有 matterType 的 stage3 governor 调用
 *
 * - 用 Promise.all 并发，所有 matterType 同时跑
 * - 任一失败不影响其他，单条降级到 stage3.analysisSummary
 * - 空列表直接返回空数组（如 past-life 模板无 matterType）
 */
export async function runReportGovernors(
  input: ReportGovernorInput,
): Promise<ReportGovernorResult[]> {
  if (input.stage3List.length === 0) return []

  const shared = {
    stage1: input.stage1,
    stage2: input.stage2,
    chartData: input.chartData,
    targetYear: input.targetYear,
  }

  const results = await Promise.all(
    input.stage3List.map(item => runSingleGovernor(item, shared)),
  )

  const degraded = results.filter(r => r.degraded).map(r => r.matterType)
  if (degraded.length > 0) {
    console.warn(`[report-governor] 以下事项降级到 analysisSummary: ${degraded.join('、')}`)
  }

  return results
}
