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

import { detectDomain, loadRules, loadTechs, isFollowUp } from './step1-router'
import { extractElements } from './step2-extractor'
import { retrieveKnowledge } from './step3-retriever'
import { assembleContext, generateReading, generateReadingStream } from './step4-generator'
import { SessionManager } from './session-manager'
import type { PipelineParams, PipelineResult, ReadingElements, ReadingDomain, ZiweiSessionData } from './types'

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
}

/**
 * 运行完整的四步精准召回流水线
 */
export async function runReadingPipeline(params: RunPipelineOptions): Promise<RunPipelineResult> {
  const { sessionId, userId, question, chartData, stream: useStream } = params
  const T0 = Date.now()
  const tick = (label: string) => {
    console.log(`[Pipeline⏱] +${Date.now() - T0}ms  ${label}`)
  }

  // ── 会话管理 ────────────────────────────────────────────
  tick('会话管理')
  const session = await sessionManager.getOrCreate(sessionId, userId, chartData)
  const followUp = sessionManager.isFollowUp(question, session)
  const lastElements = session.turns.at(-1)?.elements
  const sessionHistory = sessionManager.getRecentSummary(session)

  // ── Step 1：意图路由 + 硬加载 ───────────────────────────
  tick('Step1 意图路由')
  const domain = detectDomain(question, session.currentDomain)
  const rules = loadRules(domain.domains)
  const techs = loadTechs(domain.domains)

  // ── Step 2：要素提取 ────────────────────────────────────
  tick('Step2 要素提取')
  const elements = await extractElements({
    question,
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

  // ── Step 4：上下文组装 + 生成 ───────────────────────────
  tick('Step4 上下文组装')
  const context = assembleContext({
    chartSummary: session.chartSummary,
    rules,
    techs,
    knowledge,
    elements,
    sessionHistory,
    question,
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
  }
}
