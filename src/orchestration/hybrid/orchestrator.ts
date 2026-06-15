/**
 * Hybrid 编排 — 自由对话模式
 *
 * 流程：
 * 1. 获取/创建会话
 * 2. 自动执行 Stage1+2（宫位评分 + 性格定性）
 * 3. 之后进入自由对话模式，由 IntentClassifier 决定每轮动作
 * 4. 根据 Action 路由到不同处理分支
 * 5. 组装 Prompt、调用 AI 流式输出
 * 6. SSE 结束后更新会话状态
 */

import 'server-only'

import type { ZiweiSessionData } from '@/lib/ziwei/session/types'
import { SessionManager } from '@/lib/ziwei/session/session-manager'
import { callAIStream } from '@/lib/ai/skill-callers'
import type { ChatMessage } from '@/lib/ai/skill-callers'
import { redis } from '@/lib/redis'

import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'
import { resolveMatterRoute } from '@/core/router/matter-route-resolver'
import { buildChartFingerprint } from '@/core/services/scoring-service'
import { resolveLiuNianGan, findCurrentDaXianFromChart } from '@/core/limit-analyzer/fortune-engine'

import {
  buildPrompt,
  buildChartSnapshot,
  buildChartSnapshotObject,
  buildPersonalityData,
  buildStage2UserPrompt,
  buildStage3UserPrompt,
  buildStage4UserPrompt,
  buildEventAnalysisGovernorPrompt,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import type { IRStage1, IRStage2, IRStage3or4, MatterType } from '@/core/types'
import type { PipelineDebugInfo } from '@/types/hybrid-debug'
import { formatMatterAnalysis } from '@/core/format/matter-analysis-formatter'

import {
  createEmptyHybridPersisted,
  parseHybridAssistantPayload,
  mergeCollected,
  type SessionPersisted,
} from '@/core/adapters/iztro/ai-parse'

import { classify, getActionLabel } from '@/core/intent/classifier'
import type { IntentResult, IntentContext } from '@/core/intent/types'
import { applySlidingWindow } from '@/core/context/sliding-window'
import { compileReportSkeleton, reportToMarkdown } from '@/core/report/report-compiler'
import type { ReportCompilerInput } from '@/core/report/types'
import { callAI } from '@/lib/ai/skill-callers'
import { scoringService } from '@/core/services/scoring-service'

const sessionManager = new SessionManager()
const MAX_HISTORY_MESSAGES = 10  // 最近 5 轮（10 条消息）
const MAX_MATTER_HISTORY = 8    // 最多 8 个事项

function ensureHybrid(session: ZiweiSessionData): SessionPersisted {
  if (!session.hybridPersisted) {
    session.hybridPersisted = createEmptyHybridPersisted()
  }
  const hp = session.hybridPersisted!
  // 兼容旧会话：补充新字段默认值
  if (!hp.matterHistory) hp.matterHistory = {}
  if (hp.currentMatterKey === undefined) hp.currentMatterKey = null
  if (hp.conversationSummary === undefined) hp.conversationSummary = ''
  return hp
}

function persistHybrid(session: ZiweiSessionData, hp: SessionPersisted): void {
  session.hybridPersisted = hp
  void sessionManager.persistSessionSnapshot(session).catch(err =>
    console.error('[Hybrid] persistSessionSnapshot 失败:', err),
  )
}

/**
 * 保存/更新 ConsultationRecord（Stage1+2 完成后异步执行）
 * 委托给 ScoringService.saveFullSnapshot()
 */
function upsertConsultationRecord(
  userId: string,
  chartData: Record<string, unknown>,
  hp: SessionPersisted,
  _sessionId: string,
  reportMarkdown?: string,
): void {
  if (!hp.stage1Output || !hp.stage2Output) return

  void scoringService.saveFullSnapshot({
    userId,
    chartData,
    stage1: hp.stage1Output,
    stage2: hp.stage2Output,
    reportMarkdown,
    matterType: hp.currentMatterKey ?? undefined,
  }).catch(err =>
    console.error('[Hybrid] ConsultationRecord 保存失败:', err),
  )
}

export interface RunHybridPipelineParams {
  sessionId: string
  userId: string
  question: string
  chartData?: Record<string, unknown>
  parentBirthYears?: { father?: number; mother?: number }
  targetYear?: number
  routingAnswers?: Record<string, string>
}

export interface RunHybridPipelineResult {
  stream: ReadableStream
  sessionId: string
  debugInfo?: PipelineDebugInfo
  /** 非 null 表示本次生成了结构化报告（不走 LLM 流） */
  reportMarkdown?: string
}

export type { PipelineDebugInfo } from '@/types/hybrid-debug'

/**
 * 运行 Hybrid 管线
 */
export async function runHybridPipeline(params: RunHybridPipelineParams): Promise<RunHybridPipelineResult> {
  const { sessionId, userId, question, chartData } = params
  const T0 = Date.now()
  const timing: Record<string, number> = {}
  const tick = (label: string) => {
    timing[label] = Date.now() - T0
    console.log(`[Hybrid⏱] +${timing[label]}ms  ${label}`)
  }

  tick('会话管理')
  const session = await sessionManager.getOrCreate(sessionId, userId, chartData)
  const hp = ensureHybrid(session)

  const debugInfo: PipelineDebugInfo = {
    architecture: 'hybrid',
    stage: hp.sessionState.currentStage,
    question,
    timing,
  }

  // 如果没有 chartData，尝试从 session 获取
  const effectiveChartData = chartData || session.chartData
  if (!effectiveChartData) {
    throw new Error('缺少命盘数据（chartData）')
  }

  tick('阶段计算')

  // ── Redis 缓存 key（含版本号，计算逻辑变更时升级版本） ──
  const cacheVersion = 'v1'
  const fp = buildChartFingerprint(effectiveChartData)
  const cacheKey1 = `stage1:${cacheVersion}:${fp}`
  const cacheKey2 = `stage2:${cacheVersion}:${fp}`
  const CACHE_TTL = 24 * 60 * 60 // 24 小时

  // 阶段 1：宫位评分（如果尚未执行）
  let stage1Output = hp.stage1Output
  if (!stage1Output) {
    // 先查 Redis 缓存
    try {
      const cached1 = await redis.get(cacheKey1)
      if (cached1) {
        stage1Output = JSON.parse(cached1) as typeof stage1Output
        console.log(`[Hybrid⏱] Stage1 Redis 缓存命中, key=${cacheKey1}`)
      }
    } catch { /* Redis 不可用时 fallback */ }

    if (!stage1Output) {
      stage1Output = executeStage1({ chartData: effectiveChartData, parentBirthYears: params.parentBirthYears })
      // 异步写入 Redis（不阻塞）
      redis.set(cacheKey1, JSON.stringify(stage1Output), 'EX', CACHE_TTL).catch(() => {})
    }
    hp.stage1Output = stage1Output
    hp.stage1Json = JSON.stringify(stage1Output)
    hp.sessionState.stage1Completed = true
  }

  // 阶段 2：性格定性（如果尚未执行）
  let stage2Output = hp.stage2Output
  if (!stage2Output) {
    // 先查 Redis 缓存
    try {
      const cached2 = await redis.get(cacheKey2)
      if (cached2) {
        stage2Output = JSON.parse(cached2) as typeof stage2Output
        console.log(`[Hybrid⏱] Stage2 Redis 缓存命中, key=${cacheKey2}`)
      }
    } catch { /* Redis 不可用时 fallback */ }

    if (!stage2Output) {
      stage2Output = executeStage2({ stage1: stage1Output, question })
      // 异步写入 Redis（不阻塞）
      redis.set(cacheKey2, JSON.stringify(stage2Output), 'EX', CACHE_TTL).catch(() => {})
    }
    hp.stage2Output = stage2Output
    hp.stage2Json = JSON.stringify(stage2Output)
    hp.sessionState.stage2Completed = true
  }

  if (params.targetYear !== undefined) {
    hp.collected.targetYear = params.targetYear
  }
  if (params.routingAnswers && Object.keys(params.routingAnswers).length > 0) {
    hp.collected.routingAnswers = {
      ...hp.collected.routingAnswers,
      ...params.routingAnswers,
    }
  }

  // ── 自由对话模式判断 ──
  // Stage1+2 都完成后，进入意图驱动的自由对话模式
  const freeChatReady = hp.sessionState.stage1Completed && hp.sessionState.stage2Completed
  let intentResult: IntentResult | null = null
  let effectiveTargetYear = params.targetYear ?? hp.collected.targetYear
  const effectiveRoutingAnswers = params.routingAnswers ?? hp.collected.routingAnswers

  tick('Prompt组装')

  let allMessages: ChatMessage[]
  let maxTokens: number

  if (!freeChatReady) {
    // ── Stage1/2 初始化阶段 ──
    const stage = hp.sessionState.currentStage
    const { messages } = buildMessagesForStage(
      stage,
      stage1Output,
      stage2Output,
      question,
      effectiveChartData,
      hp,
      params.parentBirthYears,
      effectiveTargetYear,
      effectiveRoutingAnswers,
    )
    allMessages = [
      ...messages,
      ...buildHistoryMessages(hp),
      { role: 'user', content: question },
    ]
    maxTokens = stage <= 2 ? 2500 : 4500

    // 更新阶段状态
    if (stage === 1) {
      hp.sessionState.currentStage = 2
    } else if (stage === 2) {
      hp.sessionState.stage2Completed = true
    }
  } else {
    // ── 自由对话模式 ──
    const intentCtx: IntentContext = {
      currentMatterKey: hp.currentMatterKey,
      currentQueryYear: hp.currentMatterKey
        ? (hp.matterHistory[hp.currentMatterKey]?.queryYear ?? null)
        : null,
      knownMatterKeys: Object.keys(hp.matterHistory),
      recentMessages: hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES),
      initialized: true,
    }
    intentResult = classify(question, intentCtx)
    console.log(`[Hybrid] 意图分类: ${getActionLabel(intentResult.action)}`, intentResult)

    const result = await handleFreeChat(
      intentResult,
      hp,
      stage1Output,
      stage2Output,
      question,
      effectiveChartData,
      params.parentBirthYears,
      effectiveTargetYear,
      effectiveRoutingAnswers,
    )
    allMessages = result.messages
    maxTokens = result.maxTokens
    effectiveTargetYear = result.effectiveTargetYear
    // 将规范格式 JSON 传入调试信息（#2 IR 区块展示用）
    if (result.matterDataJson) {
      debugInfo.irDataJson = result.matterDataJson
    }
  }

  // 调试信息
  const fullPromptText = allMessages.map(m => `${m.role}: ${m.content?.slice(0, 100)}...`).join('\n')
  debugInfo.fullPromptLength = fullPromptText.length
  debugInfo.knowledgeSnippetCount = stage1Output.knowledgeSnippets.length + stage2Output.knowledgeSnippets.length
  debugInfo.palaceCount = stage1Output.palaceScores.length
  debugInfo.patternCount = stage1Output.allPatterns.length
  if (intentResult) {
    debugInfo.stage = intentResult.action === 'REPORT' ? -1 : 3
  }

  // 将组装后的 Prompt 消息列表加入调试信息
  debugInfo.promptMessages = allMessages.map((m, index) => {
    let label: string | undefined
    const role = m.role as 'system' | 'user' | 'assistant'
    if (role === 'system') {
      if (index === 0) label = 'System Prompt（系统指令）'
      else if (m.content?.startsWith('【计算结果 IR】')) label = 'IR 数据注入（计算结果）'
      else if (m.content?.startsWith('【知识库片段】')) {
        if (m.content.includes('事项分析规范数据')) label = '#2 IR 规范数据注入（JSON）'
        else label = '知识库片段'
      }
      else if (m.content?.startsWith('【当前阶段指令】')) label = '当前阶段指令'
      else if (m.content?.startsWith('【对话摘要】')) label = '对话摘要'
      else label = 'System 消息'
    } else if (role === 'user') {
      if (m.content?.startsWith('【命盘速览】') || m.content?.startsWith('【事项类型】') || m.content?.startsWith('【入卦数据') || m.content?.startsWith('请根据以下事项分析数据')) {
        label = '用户 Prompt（结构化数据）'
      } else {
        label = '用户问题'
      }
    } else if (role === 'assistant') {
      label = '历史助手回复'
    }
    return {
      role,
      content: m.content ?? '',
      label,
    }
  })

  tick('AI调用')

  // 检查是否是报告模式（不走 LLM 流）
  const reportMarkdown = hp.collected.lastMemoryPatch?._reportMarkdown as string | undefined
  if (reportMarkdown && intentResult?.action === 'REPORT') {
    // 清理报告标记
    delete hp.collected.lastMemoryPatch?._reportMarkdown

    // 构造一个包含报告文本的 ReadableStream
    const reportStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reportMarkdown, sessionId })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    hp.conversationHistory.push({ role: 'user', content: question })
    hp.conversationHistory.push({ role: 'assistant', content: reportMarkdown.slice(0, 500) })
    if (hp.conversationHistory.length > MAX_HISTORY_MESSAGES) {
      hp.conversationHistory = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
    }
    persistHybrid(session, hp)

    // 保存命盘记录（含报告）
    upsertConsultationRecord(userId, effectiveChartData, hp, sessionId, reportMarkdown)

    debugInfo.timing = timing
    tick('完成')
    return { stream: reportStream, sessionId, debugInfo, reportMarkdown }
  }

  // 调用 AI 流式输出
  const aiStream = await callAIStream({ messages: allMessages, temperature: 0.7, max_tokens: maxTokens })

  // 更新会话状态
  hp.conversationHistory.push({ role: 'user', content: question })
  if (hp.conversationHistory.length > MAX_HISTORY_MESSAGES) {
    hp.conversationHistory = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  }
  persistHybrid(session, hp)

  // Stage1+2 完成后保存命盘记录
  if (freeChatReady && hp.stage1Output && hp.stage2Output) {
    upsertConsultationRecord(userId, effectiveChartData, hp, sessionId)
  }

  debugInfo.timing = timing

  tick('完成')

  return { stream: aiStream, sessionId, debugInfo }
}

// ── 自由对话处理 ──────────────────────────────────────────

interface FreeChatResult {
  messages: ChatMessage[]
  maxTokens: number
  effectiveTargetYear: number
  /** 规范格式 JSON 数据（用于 debug 面板 #2 区块） */
  matterDataJson?: string
}

/**
 * 处理自由对话模式下的各种 Action
 */
async function handleFreeChat(
  intent: IntentResult,
  hp: SessionPersisted,
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  question: string,
  chartData: Record<string, unknown>,
  parentBirthYears?: { father?: number; mother?: number },
  targetYearOverride?: number,
  routingAnswers?: Record<string, string>,
): Promise<FreeChatResult> {
  const currentYear = new Date().getFullYear()

  switch (intent.action) {
    case 'NEW_MATTER': {
      // 新事项 → 运行 Stage3
      const matterType = (intent.matterType ?? '综合') as MatterType
      const targetYear = intent.targetYear ?? targetYearOverride ?? currentYear
      const route = resolveMatterRoute(matterType, question, routingAnswers)
      const stage3 = executeStage3({ stage1, stage2, matterType, routeResult: route, chartData, targetYear })
      hp.stage3Output = stage3

      // 缓存到 matterHistory
      cacheMatterRecord(hp, matterType, targetYear, stage3)

      // 构建 Stage3 的 Prompt（复用现有逻辑）
      const { messages, matterDataJson } = buildStage3Messages(
        stage1, stage2, stage3, matterType, targetYear,
        chartData, question, routingAnswers,
      )
      return { messages, maxTokens: 4500, effectiveTargetYear: targetYear, matterDataJson }
    }

    case 'RE_CALC': {
      // 年份变更 → 重跑 Stage3
      const matterType = (intent.matterType ?? hp.currentMatterKey ?? '综合') as MatterType
      const targetYear = intent.targetYear ?? targetYearOverride ?? currentYear
      const route = resolveMatterRoute(matterType, question, routingAnswers)
      const stage3 = executeStage3({ stage1, stage2, matterType, routeResult: route, chartData, targetYear })
      hp.stage3Output = stage3

      // 更新 matterHistory
      cacheMatterRecord(hp, matterType, targetYear, stage3)

      const { messages, matterDataJson } = buildStage3Messages(
        stage1, stage2, stage3, matterType, targetYear,
        chartData, question, routingAnswers,
      )
      return { messages, maxTokens: 4500, effectiveTargetYear: targetYear, matterDataJson }
    }

    case 'FOLLOW_UP': {
      // 追问 → 从缓存读取 Stage3
      const matterKey = hp.currentMatterKey
      const cachedRecord = matterKey ? hp.matterHistory[matterKey] : undefined

      if (cachedRecord) {
        // 从缓存恢复 Stage3 输出
        const stage3 = parseHybridStage3FromRecord(cachedRecord)
        if (stage3) {
          hp.stage3Output = stage3
          const { messages, matterDataJson } = buildStage3Messages(
            stage1, stage2, stage3, matterKey as MatterType, cachedRecord.queryYear,
            chartData, question, routingAnswers,
          )
          return { messages, maxTokens: 4500, effectiveTargetYear: cachedRecord.queryYear, matterDataJson }
        }
      }

      // 没有缓存 → 降级为 CHITCHAT
      return buildChitChatMessages(stage1, stage2, hp, question, chartData)
    }

    case 'INTERACTION': {
      // 互动关系 → 运行 Stage4
      const partnerYear = intent.partnerBirthYear ?? extractYearFromQuestion(question) ?? 1990
      const stage4 = executeStage4({ stage1, stage2, partnerBirthYear: partnerYear, chartData, targetYear: currentYear })
      hp.stage4Output = stage4

      const msgs = buildStage4Messages(stage1, stage2, stage4, chartData, currentYear)
      return { messages: msgs, maxTokens: 4500, effectiveTargetYear: currentYear }
    }

    case 'NEW_CHART': {
      // 为新命主流盘 → 引导用户前往排盘页（对话内自动排盘为后续增强）
      const yearInfo = intent.newChartBirthYear ? `（识别到约 ${intent.newChartBirthYear} 年出生）` : ''
      const guideMsgs: ChatMessage[] = [
        {
          role: 'system',
          content: `用户想为一个新的命主${yearInfo}排盘分析。当前对话模式无法直接排新盘。请温暖地引导用户：点击页面上的「重新排盘」或「新命主」按钮，输入完整出生信息（公历/农历年月日时、性别、出生地）后即可开始分析。严禁把这个出生年份当作当前命主的流年来解读或分析。`,
        },
        ...buildHistoryMessages(hp),
        { role: 'user', content: question },
      ]
      return { messages: guideMsgs, maxTokens: 800, effectiveTargetYear: currentYear }
    }

    case 'REPORT': {
      // 报告生成：编译骨架 → LLM 润色 → 返回 Markdown
      const reportResult = await generateReport(hp, stage1, stage2)
      if (reportResult) {
        const reportMessages: ChatMessage[] = [
          { role: 'system', content: '系统生成的结构化报告，无需 AI 解读。' },
          { role: 'user', content: question },
        ]
        hp.collected.lastMemoryPatch = { _reportMarkdown: reportResult }
        return { messages: reportMessages, maxTokens: 100, effectiveTargetYear: currentYear }
      }
      // 没有可分析的事项 → 降级为 CHITCHAT
      return buildChitChatMessages(stage1, stage2, hp, question, chartData)
    }

    case 'CHITCHAT':
    default: {
      return buildChitChatMessages(stage1, stage2, hp, question, chartData)
    }
  }
}

// ── 事项缓存管理 ──────────────────────────────────────────

function cacheMatterRecord(
  hp: SessionPersisted,
  matterType: MatterType,
  queryYear: number,
  stage3: ReturnType<typeof executeStage3>,
): void {
  const record = hp.matterHistory[matterType]
  hp.matterHistory[matterType] = {
    matterType,
    queryYear,
    stage3Json: JSON.stringify(stage3),
    lastAiSummary: record?.lastAiSummary ?? '',
    turnCount: (record?.turnCount ?? 0) + 1,
    lastAnalyzedAt: Date.now(),
  }
  hp.currentMatterKey = matterType

  // 限制最多 8 个事项
  const keys = Object.keys(hp.matterHistory)
  if (keys.length > MAX_MATTER_HISTORY) {
    // 按最后分析时间排序，移除最旧的
    const sorted = keys.sort((a, b) =>
      (hp.matterHistory[a]?.lastAnalyzedAt ?? 0) - (hp.matterHistory[b]?.lastAnalyzedAt ?? 0)
    )
    delete hp.matterHistory[sorted[0]]
  }
}

function parseHybridStage3FromRecord(record: { stage3Json: string }): ReturnType<typeof executeStage3> | null {
  try {
    return JSON.parse(record.stage3Json) as ReturnType<typeof executeStage3>
  } catch {
    return null
  }
}

// ── Prompt 构建辅助 ────────────────────────────────────────

function buildHistoryMessages(hp: SessionPersisted): ChatMessage[] {
  const history: ChatMessage[] = []
  // 对话摘要
  if (hp.conversationSummary) {
    history.push({ role: 'system' as const, content: `【对话摘要】${hp.conversationSummary}` })
  }
  // 最近几轮原文
  const recent = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  for (const turn of recent) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      history.push({ role: turn.role, content: turn.content })
    }
  }
  return history
}

function buildChitChatMessages(
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  hp: SessionPersisted,
  question: string,
  chartData: Record<string, unknown>,
): FreeChatResult {
  const chartSnapshot = buildChartSnapshotObject(
    chartData,
    { birthGan: stage1.scoringCtx?.birthGan, taiSuiZhi: stage1.scoringCtx?.taiSuiZhi },
  )
  // 计算当前时间上下文（大限 + 流年），避免闲聊时 AI「失忆」反问出生年/大限缺失
  const currentYear = new Date().getFullYear()
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentDaXian = findCurrentDaXianFromChart([], currentYear, birthYear, chartData)
  const liuNianGan = resolveLiuNianGan(chartData, currentYear)
  const timeContext = currentDaXian
    ? `当前时间：${currentYear}年（${liuNianGan}干），用户处于第${currentDaXian.index}大限（${currentDaXian.ageRange[0]}~${currentDaXian.ageRange[1]}岁，大限命宫${currentDaXian.mingPalaceName}）。`
    : `当前时间：${currentYear}年（${liuNianGan}干）。`
  const ir: IRStage2 = {
    stage: 2,
    mingGongTags: stage2.mingGongTags,
    shenGongTags: stage2.shenGongTags,
    taiSuiTags: stage2.taiSuiTags,
    overallTone: stage2.overallTone,
    mingGongHolographic: stage2.mingGongHolographic,
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    chartSnapshot,
    personalityTriadSummary: stage2.personalityTriad?.synthesis,
  }

  const msgs = buildPrompt(
    ir,
    [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets].map(s => s.content),
    question,
    `你已进入自由对话模式。用户可能在聊天、提问或准备提出新的分析需求。请温暖地回应，自然引导。\n${timeContext}\n注意：用户的命盘数据（命主信息、十二宫评分、大限范围）已在快照中提供，禁止询问出生年份等系统已掌握的信息。`,
  )

  return {
    messages: [...msgs, ...buildHistoryMessages(hp), { role: 'user', content: question }] as ChatMessage[],
    maxTokens: 2500,
    effectiveTargetYear: new Date().getFullYear(),
  }
}

/**
 * 根据当前阶段构建 Prompt 消息（仅用于 Stage 1/2 初始化阶段）
 */
function buildMessagesForStage(
  stage: number,
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  question: string,
  chartData: Record<string, unknown>,
  _hp: SessionPersisted,
  parentBirthYears?: { father?: number; mother?: number },
  targetYearOverride?: number,
  routingAnswers?: Record<string, string>,
): { messages: ChatMessage[]; stageHint: string; ir: IRStage1 | IRStage2 } {
  // 预计算命盘快照（所有阶段共用）
  const chartSnapshot = buildChartSnapshotObject(chartData, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  switch (stage) {
    case 1: {
      const ir: IRStage1 = {
        stage: 1,
        palaceScores: stage1.palaceScores,
        allPatterns: stage1.allPatterns,
        mergedSihua: stage1.mergedSihua,
        hasParentInfo: stage1.hasParentInfo,
        parentBirthYears: parentBirthYears,
        chartSnapshot,
        allDaXianSummary: stage1.allDaXianSummary,
        currentDaXian: stage1.currentDaXian,
      }
      const msgs = buildPrompt(
        ir,
        stage1.knowledgeSnippets.map(s => s.content),
        question,
        STAGE1_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE1_HINT, ir }
    }

    case 2:
    default: {
      const ir: IRStage2 = {
        stage: 2,
        mingGongTags: stage2.mingGongTags,
        shenGongTags: stage2.shenGongTags,
        taiSuiTags: stage2.taiSuiTags,
        overallTone: stage2.overallTone,
        mingGongHolographic: stage2.mingGongHolographic,
        palaceScores: stage1.palaceScores,
        allPatterns: stage1.allPatterns,
        mergedSihua: stage1.mergedSihua,
        chartSnapshot,
        personalityTriadSummary: stage2.personalityTriad?.synthesis,
        allDaXianSummary: stage1.allDaXianSummary,
        currentDaXian: stage1.currentDaXian,
      }

      const chartSnapshotText = buildChartSnapshot(chartData as unknown as Parameters<typeof buildChartSnapshot>[0], {
        birthGan: stage1.scoringCtx?.birthGan,
        taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
      })
      const personalityData = buildPersonalityData(stage2)
      const userPrompt = buildStage2UserPrompt(chartSnapshotText, personalityData, question)

      const msgs = buildPrompt(
        ir,
        [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets].map(s => s.content),
        userPrompt,
        STAGE2_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE2_HINT, ir }
    }
  }
}

/**
 * 构建 Stage3 事项分析的 Prompt 消息（供自由对话模式复用）
 */
function buildStage3Messages(
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  stage3: ReturnType<typeof executeStage3>,
  matterType: MatterType,
  targetYear: number,
  chartData: Record<string, unknown>,
  question: string,
  routingAnswers?: Record<string, string>,
): { messages: ChatMessage[]; matterDataJson: string } {
  const chartSnapshot = buildChartSnapshotObject(chartData, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentDaXianMapping = findCurrentDaXianFromChart(stage3.allDaXianMappings, targetYear, birthYear, chartData)

  const structuredAnalysis = stage3.analysisSummary
    ? [
        `原局底盘：${stage3.analysisSummary.innateBase}`,
        `大限走向：${stage3.analysisSummary.fortuneTrend}`,
        `流年引动：${stage3.analysisSummary.yearlyTrigger}`,
        `综合结论：${stage3.analysisSummary.compositeConclusion}`,
        `风险建议：${stage3.analysisSummary.riskAdvice}`,
        stage3.compositeScore !== undefined
          ? `综合分 ${stage3.compositeScore.toFixed(1)}（${stage3.scoreLabel ?? ''}）→ ${stage3.scoreAction ?? ''}`
          : '',
        stage3.personalityAnchor ? `性格锚点：${stage3.personalityAnchor}` : '',
      ].filter(Boolean).join('\n')
    : undefined

  const ir: IRStage3or4 = {
    stage: 3,
    matterType: matterType as MatterType | '互动关系',
    primaryAnalysis: stage3.primaryAnalysis,
    daXianAnalysis: stage3.allDaXianMappings.map(d => {
      const isCurrent = currentDaXianMapping ? d.index === currentDaXianMapping.index : false
      return {
        index: d.index,
        ageRange: `${d.ageRange[0]}~${d.ageRange[1]}`,
        daXianGan: d.daXianGan,
        sihuaPositions: d.mutagen,
        tone: isCurrent
          ? (stage3.currentDaXianQualitative ?? '转机期')
          : ((d.mutagen[3] ? '艰辛期' : '顺畅期') as import('@/core/types').DaXianQualitativeLevel),
        isCurrent,
      }
    }),
    liuNianAnalysis: {
      liuNianGan: resolveLiuNianGan(chartData, targetYear),
      sihuaPositions: stage3.liuNianSihuaPositions ?? [],
      direction: stage3.directionMatrix[1] === '吉' ? '吉' : '凶',
      daXianRelation: stage3.directionMatrix,
      window: stage3.directionWindow,
    },
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    chartSnapshot,
  }

  const primaryPalace = stage3.primaryAnalysis.palace
  const primaryScore = stage1.palaceScores.find(p => p.palace === primaryPalace)?.finalScore ?? 0
  const brightness = stage1.palaceScores.find(p => p.palace === primaryPalace)?.tone ?? '平'
  const slimmedText =
    stage3.slimmedDescriptions?.length
      ? stage3.slimmedDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
      : '（无匹配断语，请依据 IR 与知识片段解读）'
  const sihuaLandingDetail = stage3.sihuaLandingReport?.layers.map(layer => {
    const rows = layer.rows.map(r =>
      `${r.sihuaType}${r.star}→${r.palace ?? '未知'}${r.inMatterFocus ? '（直中）' : ''}${r.hitsOppositeOfFocus ? '（对宫冲击）' : ''}[${r.palaceQuality}]`
    ).join('；')
    return `${layer.layer}(${layer.stemLabel}) 方向${layer.direction}，得分${layer.layerScore.toFixed(1)}：${rows || '无数据'}`
  }).join('\n') ?? '（无四化落宫数据）'
  const route = resolveMatterRoute(matterType, question, routingAnswers)
  // 逐大限梳理文本（全量大限）
  const daXianTimelineText = (stage3.allDaXianMappings?.length ?? 0) > 0
    ? stage3.allDaXianMappings.map(d => {
        const isCur = currentDaXianMapping ? d.index === currentDaXianMapping.index : false
        const cur = isCur ? ' ★当前' : ''
        const tone = isCur
          ? (stage3.currentDaXianQualitative ?? '转机期')
          : (d.mutagen?.[3] ? '艰辛期' : '顺畅期')
        return `第${d.index}大限 ${d.ageRange[0]}~${d.ageRange[1]}岁（${tone}）${cur}：宫干${d.daXianGan}，命宫→${d.mingPalaceName}，四化${d.mutagen?.join('、') ?? '—'}`
      }).join('\n')
    : '（无大限梳理数据）'
  const governorBlock = buildEventAnalysisGovernorPrompt({
    intent: matterType,
    primaryPalaceData: `${primaryPalace}（得分 ${primaryScore.toFixed(1)}，${brightness}）· ${stage3.primaryAnalysis.innateLevel ?? ''}`,
    protectionStatus: stage3.primaryAnalysis.protectionStatus ?? '未检测',
    fourDimensionResult: stage3.primaryAnalysis.fourDimensionResult ?? '未分析',
    slimmedDescriptions: slimmedText,
    daXianTimeline: daXianTimelineText,
    causalChain: stage3.causalChain ?? structuredAnalysis ?? '（暂无因果链模板）',
    luluJiFlow: (stage3.luluJiFlow?.length ? stage3.luluJiFlow.join('；') : '（未检测到禄随忌走）'),
    sihuaLandingDetail,
    holographicBackground: stage3.personalityAnchor ?? stage2.overallTone ?? '（暂无性格锚点）',
    governorStrategy: stage3.resilience?.strategy ?? stage3.scoreAction ?? '发展性咨询',
    crisisSuffix: stage3.resilience?.promptSuffix ?? '',
  })
  // 按「通用单人事项分析数据格式规范」组装完整规范格式数据
  const matterSpecData = formatMatterAnalysis({
    stage1,
    stage3,
    matterType,
    targetYear,
    chartData,
  })
  const matterDataJson = JSON.stringify(matterSpecData, null, 2)

  const userPrompt = buildStage3UserPrompt(
    matterType,
    primaryPalace,
    primaryScore,
    brightness,
    stage3.knowledgeSnippets.find(s => s.source === '星曜赋性')?.content ?? '',
    stage3.knowledgeSnippets.find(s => s.source === '宫位含义')?.content ?? '',
    stage3.directionMatrix[0] === '吉' ? '吉' : '凶',
    stage3.directionMatrix[1] === '吉' ? '吉' : '凶',
    stage3.directionWindow,
    route.specialConditions.join('；') || '无',
    structuredAnalysis,
    governorBlock,
    matterDataJson,
  )

  // #2 IR 数据注入：将规范 JSON 作为知识片段注入
  const irDataKnowledge = `【事项分析规范数据（JSON 格式，三层十二宫完整数据）】\n${matterDataJson}`
  const allKnowledge = [
    ...stage1.knowledgeSnippets,
    ...stage2.knowledgeSnippets,
    ...stage3.knowledgeSnippets,
  ].map(s => s.content)
  // 将规范 JSON 追加到知识片段末尾
  allKnowledge.push(irDataKnowledge)

  const msgs = buildPrompt(
    ir,
    allKnowledge,
    userPrompt,
    STAGE3_HINT,
  )
  return { messages: msgs as ChatMessage[], matterDataJson }
}

/**
 * 构建 Stage4 互动关系的 Prompt 消息
 */
function buildStage4Messages(
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  stage4: ReturnType<typeof executeStage4>,
  chartData: Record<string, unknown>,
  targetYear: number,
): ChatMessage[] {
  const chartSnapshot = buildChartSnapshotObject(chartData, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  const ir: IRStage3or4 = {
    stage: 4,
    matterType: '互动关系',
    primaryAnalysis: {
      palace: '夫妻',
      fourDimensionResult: '互动关系分析',
      mingGongRegulation: '',
      protectionStatus: '',
      innateLevel: '互动分析',
    },
    daXianAnalysis: [],
    liuNianAnalysis: {
      liuNianGan: resolveLiuNianGan(chartData, targetYear),
      sihuaPositions: [],
      direction: '吉',
      daXianRelation: '吉吉',
      window: '推进窗口',
    },
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    chartSnapshot,
  }

  const interactionData = JSON.stringify({
    partnerGan: stage4.interaction.partnerGan,
    partnerZhi: stage4.interaction.partnerZhi,
    tensionPoints: stage4.interaction.tensionPoints,
  }, null, 2)
  const userPrompt = buildStage4UserPrompt(
    interactionData,
    stage4.interaction.tensionPoints.join('；') || '无',
    stage4.interaction.adjustableAdvice.join('；') || '无',
  )

  const msgs = buildPrompt(
    ir,
    [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets, ...stage4.knowledgeSnippets].map(s => s.content),
    userPrompt,
    STAGE4_HINT,
  )
  return msgs as ChatMessage[]
}

/**
 * 生成结构化报告（程序编译 + LLM 润色）
 */
async function generateReport(
  hp: SessionPersisted,
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
): Promise<string | null> {
  // 收集所有已分析的事项
  const matterKeys = Object.keys(hp.matterHistory)
  if (matterKeys.length === 0) return null

  const sections: string[] = []
  sections.push('# 紫微斗数命理解读报告')
  sections.push('')

  // 命主基础信息
  if (stage2.personalityTriad?.synthesis) {
    sections.push(`## 命主性格底色`)
    sections.push(stage2.personalityTriad.synthesis)
    sections.push('')
  }

  // 各事项分析
  for (const key of matterKeys) {
    const record = hp.matterHistory[key]
    if (!record) continue

    // 从缓存的 stage3Json 恢复分析摘要
    const stage3Data = JSON.parse(record.stage3Json) as Record<string, unknown>
    const analysisSummary = stage3Data.analysisSummary as {
      innateBase: string; fortuneTrend: string; yearlyTrigger: string
      compositeConclusion: string; riskAdvice: string
    } | undefined

    const compositeScore = typeof stage3Data.compositeScore === 'number' ? stage3Data.compositeScore : 0
    const scoreLabel = typeof stage3Data.scoreLabel === 'string' ? stage3Data.scoreLabel : ''
    const directionMatrix = stage3Data.directionMatrix as [string, string] | undefined
    const personalityAnchor = typeof stage3Data.personalityAnchor === 'string' ? stage3Data.personalityAnchor : undefined
    const primaryAnalysis = stage3Data.primaryAnalysis as { palace: string; innateLevel: string } | undefined
    const primaryPalace = primaryAnalysis?.palace ?? key
    const primaryScore = stage1.palaceScores.find(p => p.palace === primaryPalace)?.finalScore ?? 0
    const primaryBrightness = stage1.palaceScores.find(p => p.palace === primaryPalace)?.tone ?? '平'
    const causalChain = typeof stage3Data.causalChain === 'string' ? stage3Data.causalChain : undefined

    const input: ReportCompilerInput = {
      matterType: record.matterType,
      queryYear: record.queryYear,
      compositeScore,
      scoreLabel,
      directionMatrix: directionMatrix ?? ['平', '平'],
      directionWindow: typeof stage3Data.directionWindow === 'string' ? stage3Data.directionWindow : '',
      aiSummary: record.lastAiSummary,
      analysisSummary,
      personalityAnchor,
      primaryPalace,
      primaryScore,
      primaryBrightness,
      causalChain,
    }

    const report = compileReportSkeleton(input)
    const md = reportToMarkdown(report)
    sections.push(md)
    sections.push('')
  }

  const skeletonMd = sections.join('\n')

  // 第二阶段：LLM 润色
  try {
    const polishResult = await callAI({
      messages: [
        {
          role: 'system',
          content: `你是一位紫微斗数分析师，擅长将结构化数据润色为温暖、有温度的自然语言报告。
规则：
1. 保持报告的章节结构不变
2. 不可修改任何评分、等级、星曜数据
3. 将机械的描述转化为自然、亲切的语言
4. 用「你」来称呼用户
5. 等级用语：吉旺→强旺，平→一般，凶弱→偏弱`,
        },
        {
          role: 'user',
          content: `请将以下命理分析报告润色为更温暖自然的语言，保持所有数据和结构不变：\n\n${skeletonMd}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    })

    if (polishResult.content) {
      return polishResult.content
    }
  } catch (err) {
    console.error('[Report] LLM 润色失败，使用原始骨架:', err)
  }

  return skeletonMd
}

/**
 * 从问题中提取年份
 */
function extractYearFromQuestion(text: string): number | null {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * SSE 结束后追加助手消息，并解析 memory_update 合并到 collected
 * 更新 matterHistory 中的 AI 摘要
 */
export async function appendAssistantReply(sessionId: string, reply: string): Promise<void> {
  const session = await sessionManager.loadSession(sessionId)
  if (!session || reply.length === 0) return

  const hp = ensureHybrid(session)
  const { narrative, memoryUpdate, intent } = parseHybridAssistantPayload(reply)
  const text = (narrative || reply).slice(0, 500)
  hp.conversationHistory.push({ role: 'assistant', content: text })

  // 滑动窗口：超过 3 轮时压缩旧消息为摘要
  const { trimmedHistory, updatedSummary } = applySlidingWindow(
    hp.conversationHistory,
    hp.conversationSummary,
  )
  hp.conversationHistory = trimmedHistory
  hp.conversationSummary = updatedSummary

  if (intent) hp.collected.lastIntent = intent
  if (memoryUpdate) {
    hp.collected.lastMemoryPatch = memoryUpdate
    hp.collected.eventAnswers = mergeCollected(hp.collected.eventAnswers, memoryUpdate)
  }

  // 更新当前事项的 AI 摘要
  if (hp.currentMatterKey && hp.matterHistory[hp.currentMatterKey]) {
    hp.matterHistory[hp.currentMatterKey].lastAiSummary = text.slice(0, 200)
  }

  persistHybrid(session, hp)
}
