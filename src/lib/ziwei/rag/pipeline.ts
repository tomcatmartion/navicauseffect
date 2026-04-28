/**
 * 四步精准召回流水线编排
 *
 * Step 1: 意图路由 + 硬加载（毫秒级，零 LLM）
 * Step 2: 命盘要素提取（单次 LLM 调用，含 JSON 容错）
 * Step 3: 知识库精准召回（精确优先，向量降级）
 * Step 4: 上下文组装 + 生成（强推理模型，支持 SSE 流式）
 *
 * SSE 流式时序：Step 1-3 同步完成后，仅 Step 4 做流式输出
 */

import 'server-only'

import { detectDomain, loadRules, loadTechs, isFollowUp, resolveTargetYear } from './step1-router'
export type { YearResolution } from './step1-router'
import { extractElements } from './step2-extractor'
import { retrieveKnowledge } from './step3-retriever'
import { assembleContext, generateReading, generateReadingStream } from './step4-generator'
import { SessionManager } from './session-manager'
import { computeHoroscopeSummary } from './horoscope-computer'
import type { PipelineParams, PipelineResult, ReadingElements, ReadingDomain, ZiweiSessionData, PipelineDebugInfo } from './types'

const sessionManager = new SessionManager()

/**
 * 流水线参数（扩展）
 */
export interface RunPipelineOptions extends PipelineParams {
  /** 是否使用流式输出（默认 false） */
  stream?: boolean
}

/**
 * 流水线结果（扩展）
 */
export interface RunPipelineResult extends PipelineResult {
  /** 流式 ReadableStream（仅 stream=true 时有值） */
  stream?: ReadableStream<Uint8Array>
  /** 组装好的上下文（用于调试） */
  context?: string
  /** 流式模式下的领域信息（供 route.ts 保存会话） */
  domain?: ReadingDomain
  /** 流式模式下的会话对象（供 route.ts 保存会话） */
  session?: ZiweiSessionData
  /** 年份解析结果 */
  yearResolution?: { targetYear: number | null; clarifiedQuestion: string }
  /** 运限摘要（当检测到目标年份时生成） */
  horoscopeSummary?: string
  /** 调试信息 */
  debugInfo?: PipelineDebugInfo
}

/**
 * 运行完整的四步精准召回流水线
 */
export async function runReadingPipeline(params: RunPipelineOptions): Promise<RunPipelineResult> {
  const { sessionId, userId, question, chartData, stream: useStream } = params
  const T0 = Date.now()
  const timing: Record<string, number> = {}
  const tick = (label: string) => {
    const elapsed = Date.now() - T0
    timing[label] = elapsed
    console.log(`[Pipeline⏱] +${elapsed}ms  ${label}`)
  }

  // ── 会话管理 ────────────────────────────────────────────
  tick('会话管理')
  const session = await sessionManager.getOrCreate(sessionId, userId, chartData)
  const followUp = sessionManager.isFollowUp(question, session)
  const lastElements = session.turns.at(-1)?.elements
  const sessionHistory = sessionManager.getRecentSummary(session)

  // ── 年份解析（Step 0）────────────────────────────────────
  tick('年份解析')
  const yearResult = resolveTargetYear(question)
  // 使用澄清后的问题传入后续步骤，消除年份歧义
  const effectiveQuestion = yearResult.clarifiedQuestion

  // ── Step 1：意图路由 + 硬加载 ───────────────────────────
  tick('Step1 意图路由')
  const domain = detectDomain(effectiveQuestion, session.currentDomain)
  const rules = loadRules(domain.domains)
  const techs = loadTechs(domain.domains)

  // ── Step 2：要素提取 ────────────────────────────────────
  tick('Step2 要素提取')
  const elements = await extractElements({
    question: effectiveQuestion,
    chartSummary: session.chartSummary,
    rules,
    sessionHistory,
    isFollowUp: followUp,
    lastElements,
  })
  tick(`Step2 完成 (palaces=${elements.palaces.length}, stars=${elements.stars.length}, sihua=${elements.sihua.length})`)

  // ── Step 3：知识召回 ────────────────────────────────────
  tick('Step3 知识召回')
  const knowledge = await retrieveKnowledge(elements)
  tick(`Step3 完成 (${knowledge.length} 条知识)`)

  // ── 运限计算（当检测到目标年份时）─────────────────────────
  let horoscopeSummary: string | undefined
  if (yearResult.targetYear) {
    tick('运限计算')
    horoscopeSummary = await computeHoroscopeSummary(session.chartData, yearResult.targetYear) ?? undefined
    tick(`运限计算完成 (${horoscopeSummary ? '成功' : '失败'})`)
  }

  // ── Step 4：上下文组装 + 生成 ───────────────────────────
  tick('Step4 上下文组装')
  const context = assembleContext({
    chartSummary: session.chartSummary,
    rules,
    techs,
    knowledge,
    elements,
    sessionHistory,
    question: effectiveQuestion,
    horoscopeSummary,
  })

  let reply: string
  let resultStream: ReadableStream<Uint8Array> | undefined

  if (useStream) {
    // 流式：返回 stream 给调用方处理，由 route.ts 在流结束后保存会话
    tick('Step4 流式生成')
    resultStream = await generateReadingStream(context)
    reply = ''  // 流式模式下 reply 为空，由 route.ts 从 stream 拼接全文
  } else {
    // 同步：直接返回完整结果
    tick('Step4 同步生成')
    reply = await generateReading(context)

    // 同步模式下立即保存会话
    sessionManager.addTurn(session, {
      userQuestion: question,
      domain,
      elements,
      assistantReply: reply,
      timestamp: Date.now(),
    }).catch(err => console.error('[Pipeline] 会话保存失败:', err))
  }

  tick(`Pipeline 完成`)

  return {
    reply,
    elements,
    sessionId: session.sessionId,
    stream: resultStream,
    // 流式模式需要 domain 和 session 供 route.ts 保存会话
    domain: useStream ? domain : undefined,
    session: useStream ? session : undefined,
    context: process.env.NODE_ENV === 'development' ? context : undefined,
    yearResolution: { targetYear: yearResult.targetYear, clarifiedQuestion: yearResult.clarifiedQuestion },
    horoscopeSummary,
    debugInfo: {
      step1: { domain, rulesLength: rules.length, techsLength: techs.length },
      step2: { elements, isFollowUp: followUp },
      step3: {
        knowledgeCount: knowledge.length,
        // 截断知识片段内容，避免 SSE 传输超大 JSON
        knowledge: knowledge.map(k => ({
          ...k,
          content: k.content.length > 500 ? k.content.slice(0, 500) + '...[已截断]' : k.content,
        })),
      },
      step4: { context, horoscopeSummary },
      yearResolution: { originalQuestion: question, targetYear: yearResult.targetYear, clarifiedQuestion: yearResult.clarifiedQuestion },
      timing,
    },
  }
}
