/**
 * Hybrid 编排 — 真实实现
 * 负责管理状态机、调用各阶段、组装 Prompt、流式 AI 输出。
 *
 * 流程：
 * 1. 获取/创建会话
 * 2. 根据当前阶段执行计算（Stage1/2/3/4）
 * 3. 组装 Prompt（prompt-builder.ts 词令模板）
 * 4. 调用 AI 流式输出
 * 5. SSE 结束后解析助手回复，合并 memory_update
 * 6. 返回流
 */

import 'server-only'

import type { ZiweiSessionData } from '@/lib/ziwei/session/types'
import { SessionManager } from '@/lib/ziwei/session/session-manager'
import { callAIStream } from '@/lib/ai/skill-callers'
import type { ChatMessage } from '@/lib/ai/skill-callers'

import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'
import { routeMatter, detectMatterIntent } from '@/core/router/decision-tree'

import {
  buildPrompt,
  buildChartSnapshot,
  buildPersonalityData,
  buildStage2UserPrompt,
  buildStage3UserPrompt,
  buildStage4UserPrompt,
  getPhrase,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import type { IRStage1, IRStage2, IRStage3or4, MatterType } from '@/core/types'

import {
  createEmptyHybridPersisted,
  parseHybridAssistantPayload,
  mergeCollected,
  type SessionPersisted,
} from '@/core/adapters/iztro/ai-parse'

const sessionManager = new SessionManager()
const MAX_HISTORY_MESSAGES = 6

function ensureHybrid(session: ZiweiSessionData): SessionPersisted {
  if (!session.hybridPersisted) {
    session.hybridPersisted = createEmptyHybridPersisted()
  }
  const hp = session.hybridPersisted!
  if (hp.stage1Json === undefined && session.stageCache?.stage1) hp.stage1Json = session.stageCache.stage1
  if (hp.stage2Json === undefined && session.stageCache?.stage2) hp.stage2Json = session.stageCache.stage2
  return hp
}

function persistHybrid(session: ZiweiSessionData, hp: SessionPersisted): void {
  session.hybridPersisted = hp
  if (hp.stage1Json) {
    if (!session.stageCache) session.stageCache = {}
    session.stageCache.stage1 = hp.stage1Json
  }
  if (hp.stage2Json) {
    if (!session.stageCache) session.stageCache = {}
    session.stageCache.stage2 = hp.stage2Json
  }
  void sessionManager.persistSessionSnapshot(session).catch(err =>
    console.error('[Hybrid] persistSessionSnapshot 失败:', err),
  )
}

export interface RunHybridPipelineParams {
  sessionId: string
  userId: string
  question: string
  chartData?: Record<string, unknown>
}

export interface RunHybridPipelineResult {
  stream: ReadableStream
  sessionId: string
  debugInfo?: PipelineDebugInfo
}

export interface PipelineDebugInfo {
  architecture: 'hybrid'
  stage: number
  question: string
  matterType?: string
  palaceCount?: number
  patternCount?: number
  intentDetected?: string
  knowledgeSnippetCount?: number
  fullPromptLength?: number
  timing: Record<string, number>
  baseIRCached?: boolean
  dslPatternHits?: string[]
}

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

  // 阶段 1：宫位评分（如果尚未执行）
  let stage1Output = hp.stage1Output
  if (!stage1Output) {
    stage1Output = executeStage1({ chartData: effectiveChartData })
    hp.stage1Output = stage1Output
    hp.sessionState.stage1Completed = true
  }

  // 阶段 2：性格定性（如果尚未执行）
  let stage2Output = hp.stage2Output
  if (!stage2Output) {
    stage2Output = executeStage2({ stage1: stage1Output, question })
    hp.stage2Output = stage2Output
    hp.sessionState.stage2Completed = true
  }

  tick('Prompt组装')

  // 根据当前阶段构建 IR 和 Prompt
  const { messages, stageHint, ir } = buildMessagesForStage(
    hp.sessionState.currentStage,
    stage1Output,
    stage2Output,
    question,
    effectiveChartData,
    hp,
  )

  // 添加历史对话上下文（最近 MAX_HISTORY_MESSAGES 条）
  const historyMessages: ChatMessage[] = []
  const recentHistory = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  for (const turn of recentHistory) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      historyMessages.push({ role: turn.role, content: turn.content })
    }
  }

  const allMessages: ChatMessage[] = [
    ...messages,
    ...historyMessages,
    { role: 'user', content: question },
  ]

  const fullPromptText = allMessages.map(m => `${m.role}: ${m.content?.slice(0, 100)}...`).join('\n')
  debugInfo.fullPromptLength = fullPromptText.length
  debugInfo.knowledgeSnippetCount = stage1Output.knowledgeSnippets.length + stage2Output.knowledgeSnippets.length
  debugInfo.palaceCount = stage1Output.palaceScores.length
  debugInfo.patternCount = stage1Output.allPatterns.length

  tick('AI调用')

  // 调用 AI 流式输出
  const aiStream = await callAIStream({ messages: allMessages, temperature: 0.7, max_tokens: 4000 })

  // 更新会话状态（阶段推进）
  const nextStage = advanceStage(hp.sessionState.currentStage, question)
  hp.sessionState.currentStage = nextStage
  hp.conversationHistory.push({ role: 'user', content: question })
  persistHybrid(session, hp)

  debugInfo.timing = timing
  debugInfo.stage = nextStage

  tick('完成')

  return { stream: aiStream, sessionId, debugInfo }
}

/**
 * 根据当前阶段构建 Prompt 消息
 */
function buildMessagesForStage(
  stage: number,
  stage1: ReturnType<typeof executeStage1>,
  stage2: ReturnType<typeof executeStage2>,
  question: string,
  chartData: Record<string, unknown>,
  _hp: SessionPersisted,
): { messages: ChatMessage[]; stageHint: string; ir: IRStage1 | IRStage2 | IRStage3or4 } {
  switch (stage) {
    case 1: {
      const ir: IRStage1 = {
        stage: 1,
        palaceScores: stage1.palaceScores,
        allPatterns: stage1.allPatterns,
        mergedSihua: stage1.mergedSihua,
        hasParentInfo: stage1.hasParentInfo,
      }
      const msgs = buildPrompt(
        ir,
        stage1.knowledgeSnippets.map(s => s.content),
        question,
        STAGE1_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE1_HINT, ir }
    }

    case 2: {
      const ir: IRStage2 = {
        stage: 2,
        mingGongTags: stage2.mingGongTags,
        shenGongTags: stage2.shenGongTags,
        taiSuiTags: stage2.taiSuiTags,
        overallTone: stage2.overallTone,
        mingGongHolographic: stage2.mingGongHolographic,
      }

      // 使用 prompt-builder 词令风格的用户 Prompt
      const chartSnapshot = buildChartSnapshot(chartData as unknown as Parameters<typeof buildChartSnapshot>[0])
      const personalityData = buildPersonalityData(stage2)
      const userPrompt = buildStage2UserPrompt(chartSnapshot, personalityData, question)

      const msgs = buildPrompt(
        ir,
        [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets].map(s => s.content),
        userPrompt,
        STAGE2_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE2_HINT, ir }
    }

    case 3: {
      // 阶段 3：事项分析
      const matterType = detectMatterType(question) as MatterType
      const route = routeMatter(matterType, {})
      const stage3 = executeStage3({
        stage1,
        stage2,
        matterType,
        routeResult: route,
        chartData,
        targetYear: new Date().getFullYear(),
      })

      // 缓存 stage3 输出
      _hp.stage3Output = stage3

      const ir: IRStage3or4 = {
        stage: 3,
        matterType: matterType as MatterType | '互动关系',
        primaryAnalysis: stage3.primaryAnalysis,
        daXianAnalysis: stage3.allDaXianMappings.map(d => ({
          index: d.index,
          ageRange: `${d.ageRange[0]}~${d.ageRange[1]}`,
          daXianGan: d.daXianGan,
          sihuaPositions: d.mutagen,
          tone: (d.mutagen[3] ? '艰辛期' : '顺畅期') as '顺畅期' | '艰辛期' | '危机期' | '转机期',
          isCurrent: false,
        })),
        liuNianAnalysis: {
          liuNianGan: '甲',
          sihuaPositions: [],
          direction: stage3.directionMatrix[1] === '吉' ? '吉' : '凶',
          daXianRelation: stage3.directionMatrix,
          window: stage3.directionWindow,
        },
      }

      // 使用模板构建用户 Prompt
      const primaryPalace = stage3.primaryAnalysis.palace
      const primaryScore = stage1.palaceScores.find(p => p.palace === primaryPalace)?.finalScore ?? 0
      const brightness = stage1.palaceScores.find(p => p.palace === primaryPalace)?.tone ?? '平'
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
      )

      const msgs = buildPrompt(
        ir,
        [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets, ...stage3.knowledgeSnippets].map(s => s.content),
        userPrompt,
        STAGE3_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE3_HINT, ir }
    }

    case 4: {
      // 阶段 4：互动关系分析
      const partnerYear = extractYearFromQuestion(question)
      const stage4 = executeStage4({
        stage1,
        stage2,
        partnerBirthYear: partnerYear,
        chartData,
        targetYear: new Date().getFullYear(),
      })

      // 缓存 stage4 输出
      _hp.stage4Output = stage4

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
          liuNianGan: stage4.interaction.partnerGan === ('—' as string) ? '甲' : stage4.interaction.partnerGan,
          sihuaPositions: [],
          direction: '吉',
          daXianRelation: '吉吉',
          window: '推进窗口',
        },
      }

      // 使用模板构建用户 Prompt
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
      return { messages: msgs as ChatMessage[], stageHint: STAGE4_HINT, ir }
    }

    default: {
      // 默认返回阶段 2（性格分析）
      const ir: IRStage2 = {
        stage: 2,
        mingGongTags: stage2.mingGongTags,
        shenGongTags: stage2.shenGongTags,
        taiSuiTags: stage2.taiSuiTags,
        overallTone: stage2.overallTone,
        mingGongHolographic: stage2.mingGongHolographic,
      }
      const msgs = buildPrompt(
        ir,
        [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets].map(s => s.content),
        question,
        STAGE2_HINT,
      )
      return { messages: msgs as ChatMessage[], stageHint: STAGE2_HINT, ir }
    }
  }
}

/**
 * 检测事项类型（基于关键词）
 * 优先使用路由决策树的意图识别，降级到本地关键词匹配
 */
function detectMatterType(question: string): string {
  // 优先使用决策树的意图识别
  const intent = detectMatterIntent(question)
  if (intent && intent !== '综合') {
    return intent
  }

  // 降级到本地关键词匹配
  const lower = question.toLowerCase()
  if (lower.includes('财') || lower.includes('钱') || lower.includes('投资') || lower.includes('赚')) return '求财'
  if (lower.includes('爱') || lower.includes('情') || lower.includes('婚') || lower.includes('恋') || lower.includes('对象')) return '求爱'
  if (lower.includes('学') || lower.includes('考') || lower.includes('试') || lower.includes('书')) return '求学'
  if (lower.includes('职') || lower.includes('工作') || lower.includes('业') || lower.includes('跳')) return '求职'
  if (lower.includes('健康') || lower.includes('病') || lower.includes('身体')) return '求健康'
  if (lower.includes('名') || lower.includes('声') || lower.includes('传播')) return '求名'
  if (lower.includes('互动') || lower.includes('关系') || lower.includes('合') || lower.includes('对方')) return '互动关系'
  return '综合'
}

/**
 * 从问题中提取年份
 */
function extractYearFromQuestion(text: string): number | null {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * 阶段推进逻辑
 */
function advanceStage(currentStage: number, question: string): 1 | 2 | 3 | 4 {
  const matter = detectMatterType(question)

  switch (currentStage) {
    case 1:
      // 阶段 1 完成后自动进入阶段 2
      return 2
    case 2:
      // 阶段 2：根据用户问题决定下一步
      if (matter === '互动关系') return 4
      if (matter !== '综合') return 3
      return 2
    case 3:
      // 阶段 3：如果用户切换事项，保持在阶段 3；如果问互动关系，进入阶段 4
      if (matter === '互动关系') return 4
      return 3
    case 4:
      // 阶段 4 完成后回到阶段 2
      return 2
    default:
      return 2
  }
}

/** 兼容旧接口：清理逻辑改为依赖 Redis TTL，此处保留空实现 */
export function cleanupExpiredSessions(_maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  /* no-op：会话以 Redis + DB 为准 */
}

/**
 * SSE 结束后追加助手消息，并解析 memory_update 合并到 collected
 */
export async function appendAssistantReply(sessionId: string, reply: string): Promise<void> {
  const session = await sessionManager.loadSession(sessionId)
  if (!session || reply.length === 0) return

  const hp = ensureHybrid(session)
  const { narrative, memoryUpdate, intent } = parseHybridAssistantPayload(reply)
  const text = (narrative || reply).slice(0, 500)
  hp.conversationHistory.push({ role: 'assistant', content: text })
  if (hp.conversationHistory.length > MAX_HISTORY_MESSAGES) {
    hp.conversationHistory = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  }
  if (intent) hp.collected.lastIntent = intent
  if (memoryUpdate) {
    hp.collected.lastMemoryPatch = memoryUpdate
    hp.collected.eventAnswers = mergeCollected(hp.collected.eventAnswers, memoryUpdate)
  }
  persistHybrid(session, hp)
}
