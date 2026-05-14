/**
 * Hybrid 编排 — ChartBridge(BaseIR) → 确定性 Stage1–4 → PromptBuilder → 流式 AI
 * 状态与对话历史持久化在 Session（Redis + MySQL hybrid_state），无进程内 Map。
 */

import 'server-only'

import type { ZiweiSessionData, ConversationTurn } from '@/lib/ziwei/rag/types'
import { SessionManager } from '@/lib/ziwei/rag/session-manager'
import { callAIStream } from '@/lib/ai/skill-callers'
import type { ChatMessage } from '@/lib/ai/skill-callers'

import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'

import {
  advanceStage,
  type SessionState,
  type Stage,
} from '@/core/orchestrator/state-machine'

import { detectMatterIntent, routeMatter } from '@/core/router/decision-tree'
import { extractAnswersFromDialog } from '@/core/router/answer-extractor'
import type { MatterType, MatterRouteResult } from '@/core/types'

import {
  buildPrompt,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'

import type {
  IR,
  IRStage1,
  IRStage2,
  IRStage3or4,
  Stage1Output,
  Stage2Output,
  Stage3Output,
  Stage4Output,
  KnowledgeSnippet,
} from '@/core/types'

import {
  createEmptyHybridPersisted,
  parseHybridStage1,
  parseHybridStage2,
  parseHybridStage3,
  parseHybridStage4,
  type HybridPersisted,
} from '@/lib/ziwei/hybrid/types'
import { buildBaseIR } from '@/lib/ziwei/hybrid/chart-bridge'
import { buildFinalIRFromStages } from '@/lib/ziwei/hybrid/final-ir-builder'
import { mergeCollected, parseHybridAssistantPayload } from '@/lib/ziwei/hybrid/ai-parse'
import { evaluateJsonPatterns } from '@/lib/ziwei/hybrid/patterns-dsl'

const sessionManager = new SessionManager()

const MAX_HISTORY_MESSAGES = 6

function ensureHybrid(session: ZiweiSessionData): HybridPersisted {
  if (!session.hybridPersisted) {
    session.hybridPersisted = createEmptyHybridPersisted()
  }
  const hp = session.hybridPersisted
  if (!hp.stage1Json && session.stageCache?.stage1) hp.stage1Json = session.stageCache.stage1
  if (!hp.stage2Json && session.stageCache?.stage2) hp.stage2Json = session.stageCache.stage2
  return hp
}

function persistHybrid(session: ZiweiSessionData, hp: HybridPersisted): void {
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
  stage: Stage
  question: string
  matterType?: string
  palaceCount?: number
  patternCount?: number
  intentDetected?: string
  knowledgeSnippetCount?: number
  fullPromptLength?: number
  timing: Record<string, number>
  /** ChartBridge 已写入 BaseIR */
  baseIRCached?: boolean
  /** patterns.json DSL 额外命中（调试） */
  dslPatternHits?: string[]
}

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
    stage: hp.sessionState.currentStage as Stage,
    question,
    timing,
  }

  tick(`阶段${hp.sessionState.currentStage}判断`)

  let ir: IR
  let stageHint: string
  let knowledgeSnippets: KnowledgeSnippet[] = []

  let stage1Output = parseHybridStage1(hp.stage1Json)
  let stage2Output = parseHybridStage2(hp.stage2Json)
  let stage3Output = parseHybridStage3(hp.stage3Json)
  let stage4Output = parseHybridStage4(hp.stage4Json)

  if (stage1Output) hp.sessionState.stage1Completed = true
  if (stage2Output) hp.sessionState.stage2Completed = true

  if (hp.sessionState.currentStage === 1 || !hp.sessionState.stage1Completed) {
    if (!session.chartData) {
      const stream = await callAIStream({ messages: buildNoChartMessages(question) })
      debugInfo.timing = timing
      return { stream, sessionId, debugInfo }
    }

    tick('阶段一执行')
    stage1Output = executeStage1({ chartData: session.chartData })
    hp.stage1Json = JSON.stringify(stage1Output)
    try {
      hp.baseIR = buildBaseIR(session.chartData)
      debugInfo.baseIRCached = true
    } catch (e) {
      console.warn('[Hybrid] ChartBridge BaseIR 失败:', e)
    }

    const matchedNames = new Set(stage1Output.allPatterns.map(p => p.name))
    const starsByPalaceIndex = stage1Output.scoringCtx.palaces.map(p =>
      p.majorStars.map(s => String(s)),
    )
    const dslHits = evaluateJsonPatterns({ starsByPalaceIndex, matchedPatternNames: matchedNames })
    debugInfo.dslPatternHits = dslHits.map(d => d.name)

    hp.sessionState = advanceStage(hp.sessionState, 2)
    persistHybrid(session, hp)

    ir = buildStage1IR(stage1Output)
    stageHint = STAGE1_HINT
    knowledgeSnippets = stage1Output.knowledgeSnippets

    debugInfo.palaceCount = stage1Output.palaceScores.length
    debugInfo.patternCount = stage1Output.allPatterns.length
    debugInfo.knowledgeSnippetCount = knowledgeSnippets.length

    if (question.includes('父亲') || question.includes('母亲') || question.includes('父母')) {
      hp.sessionState.hasParentInfo = true
    }
  } else if (hp.sessionState.currentStage === 2 && !hp.sessionState.stage2Completed) {
    if (!stage1Output) {
      const stream = await callAIStream({
        messages: buildFallbackMessages('性格定性需要先完成宫位评分'),
      })
      debugInfo.timing = timing
      return { stream, sessionId, debugInfo }
    }

    tick('阶段二执行')
    stage2Output = executeStage2({ stage1: stage1Output, question })
    hp.stage2Json = JSON.stringify(stage2Output)

    ir = buildStage2IR(stage2Output)
    knowledgeSnippets = stage2Output.knowledgeSnippets

    const matterIntent = detectMatterIntent(question)
    if (matterIntent && matterIntent !== '综合') {
      hp.sessionState.stage2Completed = true
      if (matterIntent === '互动关系') {
        hp.sessionState = advanceStage(hp.sessionState, 4)
      } else {
        hp.sessionState.currentMatterType = matterIntent as MatterType
        hp.sessionState = advanceStage(hp.sessionState, 3, matterIntent as MatterType)
      }
    } else {
      hp.sessionState.stage2Completed = true
    }

    stageHint = STAGE2_HINT
    debugInfo.knowledgeSnippetCount = knowledgeSnippets.length
    persistHybrid(session, hp)
  } else if (hp.sessionState.currentStage === 3 || hp.sessionState.currentStage === 4) {
    tick('意图识别')
    const matterIntent = detectMatterIntent(question)
    debugInfo.intentDetected = matterIntent ?? '未识别'

    if (!stage1Output && session.chartData) {
      tick('自动补全阶段一')
      stage1Output = executeStage1({ chartData: session.chartData })
      hp.stage1Json = JSON.stringify(stage1Output)
      hp.sessionState.stage1Completed = true
    }
    if (!stage2Output && stage1Output) {
      tick('自动补全阶段二')
      stage2Output = executeStage2({ stage1: stage1Output, question })
      hp.stage2Json = JSON.stringify(stage2Output)
      hp.sessionState.stage2Completed = true
    }

    if (hp.sessionState.currentStage === 4 || matterIntent === '互动关系') {
      tick('阶段四执行')

      const fromMatterAnalysis =
        hp.sessionState.currentStage === 3 &&
        hp.sessionState.currentMatterType !== null &&
        stage3Output !== undefined

      const focusContext =
        fromMatterAnalysis && stage3Output
          ? {
              matterType: stage3Output.matterType,
              primaryPalace: stage3Output.primaryAnalysis.palace,
            }
          : undefined

      const partnerYearMatch =
        question.match(/(?:对方|他|她|伴侣|另一半|恋人|爱人|男朋友|女朋友|老公|老婆|先生|太太|对象)[^\d]{0,4}(\d{4})/) ??
        question.match(/(\d{4})[^\d]{0,4}(?:出生|年生|年的)/)
      const partnerYear = partnerYearMatch ? parseInt(partnerYearMatch[1], 10) : null

      if (!partnerYear) {
        tick('阶段四降级：单方关系宫分析（无对方年份）')
      } else {
        tick(`对方年份：${partnerYear}`)
      }

      try {
        if (session.chartData && partnerYear) {
          hp.baseIR = buildBaseIR(session.chartData)
        }
      } catch {
        /* ignore */
      }

      stage4Output = executeStage4({
        stage1: stage1Output!,
        stage2: stage2Output!,
        partnerBirthYear: partnerYear,
        chartData: session.chartData ?? {},
        targetYear: new Date().getFullYear(),
        focusContext,
      })
      hp.stage4Json = JSON.stringify(stage4Output)

      ir = buildStage4IR(stage4Output)
      stageHint = focusContext
        ? buildStage4HintWithContext(focusContext.matterType, focusContext.primaryPalace)
        : STAGE4_HINT
      knowledgeSnippets = stage4Output.knowledgeSnippets
      debugInfo.matterType = '互动关系'
      debugInfo.knowledgeSnippetCount = knowledgeSnippets.length
    } else {
      tick('阶段三执行')
      const matterType = (matterIntent as MatterType) ?? hp.sessionState.currentMatterType ?? '求财'
      hp.sessionState.currentMatterType = matterType

      const extracted = extractAnswersFromDialog(question, matterType)
      const defaultAnswers = extracted.answers
      if (extracted.confidence > 0) {
        tick(`问诊提取(${Math.round(extracted.confidence * 100)}%)`)
      }
      const routeResult = routeMatter(matterType, defaultAnswers)

      stage3Output = executeStage3({
        stage1: stage1Output!,
        stage2: stage2Output!,
        matterType,
        routeResult,
        chartData: session.chartData ?? {},
        targetYear: new Date().getFullYear(),
      })
      hp.stage3Json = JSON.stringify(stage3Output)

      if (routeResult.needInteraction) {
        debugInfo.matterType = `${matterType}(含互动关系)`
      }

      ir = buildStage3IR(stage3Output)
      stageHint = STAGE3_HINT
      knowledgeSnippets = stage3Output.knowledgeSnippets
      debugInfo.matterType = matterType
      debugInfo.knowledgeSnippetCount = knowledgeSnippets.length
    }
    persistHybrid(session, hp)
  } else {
    if (!session.chartData) {
      const stream = await callAIStream({ messages: buildNoChartMessages(question) })
      debugInfo.timing = timing
      return { stream, sessionId, debugInfo }
    }
    stage1Output = executeStage1({ chartData: session.chartData })
    hp.stage1Json = JSON.stringify(stage1Output)
    ir = buildStage1IR(stage1Output)
    stageHint = STAGE1_HINT
    knowledgeSnippets = stage1Output.knowledgeSnippets
    persistHybrid(session, hp)
  }

  tick('Prompt组装')
  const finalSnap =
    stage1Output && stage2Output
      ? buildFinalIRFromStages(stage1Output, stage2Output)
      : stage1Output
        ? buildFinalIRFromStages(stage1Output)
        : null
  const memoryHint =
    '\n\n【输出约束】在正文之后可另起一行输出 JSON：{"intent":"...","memory_update":{...}}；memory_update 会与会话 collected 合并；若无可省略 JSON。'

  const rawMessages = buildPrompt(
    ir,
    knowledgeSnippets.map(s => s.content),
    question,
    (stageHint ?? '') + memoryHint,
  )

  const systemParts: string[] = []
  const nonSystemMessages: ChatMessage[] = []
  for (const m of rawMessages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
    } else {
      nonSystemMessages.push(m)
    }
  }

  if (finalSnap) {
    systemParts.push(`【FinalIR 摘要】\n${JSON.stringify(finalSnap, null, 2)}`)
  }

  const historySlice = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  const historyMessages: ChatMessage[] = historySlice.map(hm => ({
    role: hm.role,
    content: hm.content,
  }))

  const messages: ChatMessage[] = [
    { role: 'system', content: systemParts.join('\n\n') },
    ...historyMessages,
    ...nonSystemMessages,
  ]
  debugInfo.fullPromptLength = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)

  hp.conversationHistory.push({ role: 'user', content: question })
  if (hp.conversationHistory.length > MAX_HISTORY_MESSAGES) {
    hp.conversationHistory = hp.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
  }
  persistHybrid(session, hp)

  tick('LLM调用')
  const stream = await callAIStream({ messages, temperature: 0.7 })

  void sessionManager
    .addTurn(session, {
      userQuestion: question,
      domain: { domains: [debugInfo.matterType ?? '综合'], timeScope: '本命' },
      elements: { palaces: [], stars: [], sihua: [], patterns: [], timeScope: '本命', analysisPoints: [] },
      assistantReply: '（混合架构流式输出）',
      timestamp: Date.now(),
    })
    .catch(err => console.error('[Hybrid] 会话保存失败:', err))

  debugInfo.timing = timing
  debugInfo.stage = hp.sessionState.currentStage
  return { stream, sessionId, debugInfo }
}

function buildStage1IR(output: Stage1Output): IRStage1 {
  return {
    stage: 1,
    palaceScores: output.palaceScores,
    allPatterns: output.allPatterns,
    mergedSihua: output.mergedSihua,
    hasParentInfo: output.hasParentInfo,
  }
}

function buildStage2IR(output: Stage2Output): IRStage2 {
  return {
    stage: 2,
    mingGongTags: output.mingGongTags,
    shenGongTags: output.shenGongTags,
    taiSuiTags: output.taiSuiTags,
    overallTone: output.overallTone,
    mingGongHolographic: output.mingGongHolographic,
  }
}

function buildStage3IR(output: Stage3Output): IRStage3or4 {
  return {
    stage: 3,
    matterType: output.matterType,
    primaryAnalysis: output.primaryAnalysis,
    daXianAnalysis: output.allDaXianMappings.map(d => ({
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
      direction: output.directionMatrix[1] === '吉' ? '吉' : '凶',
      daXianRelation: output.directionMatrix,
      window: output.directionWindow,
    },
  }
}

function buildStage4IR(output: Stage4Output): IRStage3or4 {
  return {
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
      liuNianGan: output.interaction.partnerGan,
      sihuaPositions: [],
      direction: '吉',
      daXianRelation: '吉吉',
      window: '推进窗口',
    },
  }
}

function buildNoChartMessages(userQuestion: string): ChatMessage[] {
  return [
    { role: 'system', content: '你是一位温暖的紫微斗数分析师。用户还没有提供命盘数据。' },
    { role: 'user', content: userQuestion },
  ]
}

function buildFallbackMessages(reason: string): ChatMessage[] {
  return [
    { role: 'system', content: '你是一位温暖的紫微斗数分析师。系统需要更多信息才能继续。' },
    { role: 'user', content: `系统提示：${reason}。请以温暖的方式向用户说明。` },
  ]
}

function buildStage4HintWithContext(matterType: string, primaryPalace: string): string {
  return `你正在阶段四：互动关系分析（事项关联模式）。
用户正在分析${matterType}事项，系统检测到该事项涉及互动关系。
请重点分析互动关系中与${primaryPalace}宫相关的互动影响，并结合事项背景给出建议。
同时完成整体互动模式定性，区分「可调整」「须谨慎」「不可调整」三种情况。`
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
