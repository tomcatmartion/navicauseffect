/**
 * 混合架构解盘流水线
 *
 * 核心设计：后台 95% 知识直灌 + 前台 5% 兜底工具调用
 *
 * Step 0: 领域识别（代码，毫秒级）
 * Step 1: 加载规则+技法（Node.js 直接读文件）
 * Step 2: 命盘特征提取（代码，确定性）
 * Step 3: 批量执行知识查询（Node.js 直接读 JSON）
 * Step 4: 组装完整 Prompt
 * Step 5: 唯一一次 AI 调用（流式）
 *   - LLM 优先直接输出结论
 *   - 只有在极端情况下才调用兜底工具
 */
import 'server-only'

import { loadDomainContext, executeQueryTasks } from '@/skills'
import { queryKnowledgeSkill } from '@/skills/queryKnowledge.skill'
import { SessionManager } from './session-manager'
import { extractQueryTasks, formatTaskListForLog, detectDomain } from '../chart-feature-extractor'
import { callAI, callAIStream } from '@/lib/ai/skill-callers'
import type { Tool, ChatMessage as AICallMessage } from '@/lib/ai/skill-callers'
import type { ZiweiSessionData } from './types'
import type { Domain } from '@/skills/types'
import { buildTools, executeSkillAsync } from '@/skills'
import { computeHoroscopeSummary, computeHoroscopeData, type ScopeData } from './horoscope-computer'
import { resolveTargetYear } from './step1-router'
import { slimAstrolabeData } from '@/lib/ai/slim-astrolabe'
import { formatChartCnJson, formatHoroscopeCnJson } from '@/lib/ai/format-chart-cn'

const sessionManager = new SessionManager()
const MAX_TOOL_ROUNDS = 3  // 最多3轮兜底调用

// ═══════════════════════════════════════════════════════════════════
// 调试信息接口
// ═══════════════════════════════════════════════════════════════════

export interface SkillDebugInfo {
  /** 架构类型 */
  architecture: 'skill'
  /** 用户问题 */
  question: string
  /** 领域 */
  domain: string
  /** 查询任务清单 */
  queryTasks: Array<{
    category: string
    name: string
    subKey?: string
  }>
  /** 规则库内容 */
  rulesContext: string
  /** 技法库内容 */
  techContext: string
  /** 知识库查询结果 */
  knowledgeResults: Array<{
    category: string
    name: string
    subKey?: string
    result: string
  }>
  /** 组装后的完整 Prompt */
  fullPrompt: string
  /** 兜底调用次数 */
  fallbackCallCount: number
  /** 兜底调用详情 */
  fallbackCalls: Array<{
    round: number
    tool: string
    args: Record<string, unknown>
    result: string
  }>
}

// ═══════════════════════════════════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `你是一位精通紫微斗数的专业命理师，思考过程和分析全部用中文输出。

## 输出要求（严格遵守）
1. **只用中文输出**，所有星曜、宫位、术语、四化、分析理由全部用中文，不得出现英文或缩写
2. **结构化输出**，按照命盘→大限→流年的层次，逐层分析，每个层次单独成段
3. **有据可查**，每项判断必须说明依据（星曜名+四化+落宫），不可仅给结论
4. **具体而非笼统**，必须引用命盘中实际存在的星曜和宫位，不虚构
5. **风格亲切自然**，像与朋友深度交流，有温度、有深度，避免干巴巴的列表

## 解盘原则
- 结合命盘实际情况具体分析，避免套话和模板式表达
- 吉凶判断要有理有据，说明是哪颗星、哪个四化、哪个格局导致的结论
- 不做具体金额/时间预测，不做感情/事业最终结果的绝对判决`


// ═══════════════════════════════════════════════════════════════════
// Pipeline 接口
// ═══════════════════════════════════════════════════════════════════

export interface RunPipelineParams {
  sessionId: string
  userId: string
  question: string
  chartData?: Record<string, unknown>
}

export interface RunPipelineResult {
  stream: ReadableStream
  sessionId: string
  debugInfo?: SkillDebugInfo
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline 主函数
// ═══════════════════════════════════════════════════════════════════

export async function runReadingPipeline(params: RunPipelineParams): Promise<RunPipelineResult> {
  const { sessionId, userId, question, chartData } = params

  // ── 调试信息收集 ─────────────────────────────────
  const debugInfo: SkillDebugInfo = {
    architecture: 'skill',
    question,
    domain: '',
    queryTasks: [],
    rulesContext: '',
    techContext: '',
    knowledgeResults: [],
    fullPrompt: '',
    fallbackCallCount: 0,
    fallbackCalls: [],
  }

  // ── 会话管理 ────────────────────────────────────────────
  const session = await sessionManager.getOrCreate(sessionId, userId, chartData)
  const sessionHistory = sessionManager.getRecentSummary(session)

  // ── Step 0: 领域识别（代码，毫秒级）───────────────────
  const domain = detectDomain(question, session.currentDomain)
  debugInfo.domain = domain

  // ── Step 1: 直接加载规则+技法（Node.js，无网络）────────
  const domainContext = loadDomainContext(domain as Domain)
  debugInfo.rulesContext = domainContext

  // ── Step 2: 命盘特征提取（代码，确定性）──────────────────
  const queryTasks = session.chartData
    ? extractQueryTasks(session.chartData as Record<string, unknown>, domain)
    : []

  debugInfo.queryTasks = queryTasks.map(t => ({
    category: t.category,
    name: t.name,
    subKey: t.subKey,
  }))

  if (process.env.NODE_ENV === 'development') {
    console.log(`[pipeline] 查询任务清单（${domain}）:\n${formatTaskListForLog(queryTasks)}`)
    console.log(`[pipeline] 共 ${queryTasks.length} 个查询任务`)
  }

  // ── Step 3: 批量执行知识查询（Node.js，无网络）──────────
  // 这是"95% 知识直灌"的核心：后台直接查好所有知识
  const knowledgeResults: Array<{ category: string; name: string; subKey?: string; result: string }> = []

  for (const task of queryTasks) {
    try {
      const result = await queryKnowledgeSkill.execute({
        category: task.category,
        name: task.name,
        subKey: task.subKey,
      })
      if (result && typeof result === 'string' && !result.startsWith('暂无') && !result.startsWith('未知')) {
        knowledgeResults.push({
          category: task.category,
          name: task.name,
          subKey: task.subKey,
          result,
        })
      }
    } catch (err) {
      console.warn(`[pipeline] 知识查询失败: ${task.category}/${task.name}`, err)
    }
  }

  debugInfo.knowledgeResults = knowledgeResults

  const knowledgeContext = knowledgeResults.map(r => r.result).join('\n\n---\n\n')

  if (process.env.NODE_ENV === 'development') {
    console.log(`[pipeline] 知识上下文：${knowledgeContext.split('\n').length} 行，约 ${knowledgeContext.length} 字符`)
  }

  // ── Step 4: 组装完整 Prompt ────────────────────────────────
  const yearResult = resolveTargetYear(question)
  let horoscopeSummary: string | undefined
  let horoscopeData: { decadal: ScopeData; yearly: ScopeData; age: ScopeData } | undefined
  if (yearResult.targetYear) {
    horoscopeSummary = await computeHoroscopeSummary(session.chartData, yearResult.targetYear) ?? undefined
    horoscopeData = await computeHoroscopeData(session.chartData, yearResult.targetYear) ?? undefined
  }
  const userMessage = buildUserMessage(session, domainContext, knowledgeContext, sessionHistory, question, horoscopeSummary, horoscopeData)
  debugInfo.fullPrompt = userMessage

  // ── Step 5: 唯一一次 AI 调用（流式）──────────────────────
  const tools = buildTools()

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]

  // 工具调用循环（最多3轮兜底）
  await runToolLoop(messages, tools, debugInfo)

  // 最终流式生成
  const stream = await callAIStream({ messages })

  // 异步保存会话
  sessionManager.addTurn(session, {
    userQuestion: question,
    domain: { domains: [domain], timeScope: '本命' as const },
    elements: { palaces: [], stars: [], sihua: [], patterns: [], timeScope: '', analysisPoints: [] },
    assistantReply: '（流式输出）',
    timestamp: Date.now(),
  }).catch(err => console.error('[pipeline] 会话保存失败:', err))

  return { stream, sessionId: session.sessionId, debugInfo }
}

// ═══════════════════════════════════════════════════════════════════
// 工具调用循环（兜底机制）
// ═══════════════════════════════════════════════════════════════════

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

async function runToolLoop(
  messages: ChatMessage[],
  tools: Tool[],
  debugInfo: SkillDebugInfo
): Promise<void> {
  const calledSignatures = new Set<string>()

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callAI({ messages, tools })

    // 没有工具调用 → LLM 直接输出结论，停止循环
    if (!response.tool_calls || response.tool_calls.length === 0) {
      if (response.content) {
        messages.push({ role: 'assistant', content: response.content })
      }
      console.log('[pipeline] LLM 直接输出结论，停止工具调用')
      return
    }

    // 记录响应
    messages.push({
      role: 'assistant',
      content: response.content ?? null,
      tool_calls: response.tool_calls,
    })

    // 去重拦截
    const newCalls = response.tool_calls.filter(tc => {
      const sig = `${tc.function.name}:${tc.function.arguments}`
      if (calledSignatures.has(sig)) {
        console.warn(`[pipeline] 拦截重复调用: ${tc.function.name}`)
        return false
      }
      calledSignatures.add(sig)
      return true
    })

    // 没有新调用 → 直接输出结论
    if (newCalls.length === 0) {
      messages.push({
        role: 'user',
        content: '材料已足够，请直接输出解盘结论。',
      })
      return
    }

    console.log(`[pipeline] 第 ${round + 1} 轮兜底工具调用: ${newCalls.map(tc => tc.function.name).join(', ')}`)

    // 执行工具并记录到调试信息
    const results = await Promise.all(
      newCalls.map(async tc => {
        const args = JSON.parse(tc.function.arguments)
        const result = await executeSkillAsync(tc.function.name, args)

        // 记录兜底调用
        debugInfo.fallbackCalls.push({
          round: round + 1,
          tool: tc.function.name,
          args,
          result,
        })

        return { id: tc.id, result }
      })
    )

    debugInfo.fallbackCallCount++

    // 添加工具结果
    for (const { id, result } of results) {
      messages.push({ role: 'tool', tool_call_id: id, content: result })
    }

    // 标记被拦截的调用
    const skipped = response.tool_calls.filter(
      tc => !newCalls.find(n => n.id === tc.id)
    )
    for (const tc of skipped) {
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: '（该工具已调用过，结果见上文）',
      })
    }
  }

  // 达到最大轮次
  console.log('[pipeline] 达到最大兜底轮次，强制生成结论')
  messages.push({
    role: 'user',
    content: '请根据以上所有材料，输出最终的解盘结论。',
  })
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

function buildUserMessage(
  session: ZiweiSessionData,
  domainContext: string,
  knowledgeContext: string,
  sessionHistory: string,
  question: string,
  horoscopeSummary?: string,
  horoscopeData?: { decadal: ScopeData; yearly: ScopeData; age: ScopeData }
): string {
  const parts: string[] = []

  // 命盘数据（完整 JSON，含天干地支+大限列表）
  const slimmed = slimAstrolabeData(session.chartData)
  parts.push('## 用户命盘')
  parts.push(formatChartCnJson(slimmed))

  // 运限数据（当有目标年份时）
  if (horoscopeSummary) {
    parts.push('\n## 运限分析数据')
    parts.push(horoscopeSummary)
  }

  // 解盘规则与实战技法
  parts.push('\n## 解盘规则（请严格遵循）')
  parts.push(domainContext)

  // 命盘相关知识（已从知识库精准提取）
  if (knowledgeContext) {
    parts.push('\n## 相关紫微知识')
    parts.push(knowledgeContext)
  }

  // 对话历史
  if (sessionHistory) {
    parts.push('\n## 历史对话要点')
    parts.push(sessionHistory)
  }

  // 命主问题
  parts.push('\n## 用户问题')
  parts.push(question)

  return parts.join('\n')
}
