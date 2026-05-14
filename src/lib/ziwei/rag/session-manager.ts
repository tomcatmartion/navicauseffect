/**
 * 多轮会话管理器
 *
 * Redis 快路径（读写会话，24h TTL）+ MySQL 慢路径（持久化）
 * - 最近 5 轮保留
 * - assistantReply 截断到前 500 字（摘要足够，不存全文）
 * - 追问检测 + 要素继承
 */

import 'server-only'

import { redis } from '@/lib/redis'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { ZiweiSessionData, ConversationTurn, ReadingDomain, ReadingElements } from './types'
import { createEmptyHybridPersisted, type HybridPersisted } from '@/lib/ziwei/hybrid/types'

const SESSION_TTL = 60 * 60 * 24      // 24小时（秒）
const MAX_TURNS = 5                    // 保留最近5轮
const REDIS_PREFIX = 'ziwei:session:'
const MAX_REPLY_LENGTH = 500           // 助手回复截断长度

function sessionFromDbRow(dbSession: {
  id: string
  userId: string
  chartData: Prisma.JsonValue
  chartSummary: string
  turns: Prisma.JsonValue
  turnCount: number
  currentDomain: string
  createdAt: Date
  expiresAt: Date
  hybridState: Prisma.JsonValue | null
}): ZiweiSessionData {
  return {
    sessionId: dbSession.id,
    userId: dbSession.userId,
    chartData: dbSession.chartData as Record<string, unknown>,
    chartSummary: dbSession.chartSummary,
    turns: dbSession.turns as unknown as ConversationTurn[],
    currentDomain: dbSession.currentDomain,
    turnCount: dbSession.turnCount,
    createdAt: dbSession.createdAt.getTime(),
    expiresAt: dbSession.expiresAt.getTime(),
    hybridPersisted: (dbSession.hybridState as HybridPersisted | null) ?? createEmptyHybridPersisted(),
  }
}

export class SessionManager {

  /**
   * 仅加载会话（不创建）。Hybrid 追加历史等场景使用。
   */
  async loadSession(sessionId: string): Promise<ZiweiSessionData | null> {
    const cached = await redis.get(`${REDIS_PREFIX}${sessionId}`)
    if (cached) {
      try {
        const session = JSON.parse(cached) as ZiweiSessionData
        if (!session.hybridPersisted) {
          const row = await prisma.ziweiSession.findUnique({
            where: { id: sessionId },
            select: { hybridState: true },
          })
          session.hybridPersisted = (row?.hybridState as HybridPersisted | null) ?? createEmptyHybridPersisted()
        }
        return session
      } catch {
        return null
      }
    }

    const dbSession = await prisma.ziweiSession.findUnique({ where: { id: sessionId } })
    if (!dbSession) return null
    const session = sessionFromDbRow(dbSession)
    await redis.setex(`${REDIS_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session))
    return session
  }

  /**
   * 将当前会话快照写入 Redis + MySQL（含 hybrid_state）
   */
  async persistSessionSnapshot(session: ZiweiSessionData): Promise<void> {
    await redis.setex(
      `${REDIS_PREFIX}${session.sessionId}`,
      SESSION_TTL,
      JSON.stringify(session),
    )
    await prisma.ziweiSession.update({
      where: { id: session.sessionId },
      data: {
        chartData: session.chartData as unknown as Prisma.InputJsonValue,
        chartSummary: session.chartSummary,
        turns: session.turns as unknown as Prisma.InputJsonValue,
        turnCount: session.turnCount,
        currentDomain: session.currentDomain,
        hybridState: (session.hybridPersisted ?? createEmptyHybridPersisted()) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 获取或创建会话
   * 优先从 Redis 取（快），没有则从 MySQL 恢复，都没有则新建
   */
  async getOrCreate(
    sessionId: string,
    userId: string,
    chartData?: Record<string, unknown>,
  ): Promise<ZiweiSessionData> {

    // 优先从 Redis 取
    const cached = await redis.get(`${REDIS_PREFIX}${sessionId}`)
    if (cached) {
      try {
        const session = JSON.parse(cached) as ZiweiSessionData
        if (!session.hybridPersisted) {
          const row = await prisma.ziweiSession.findUnique({
            where: { id: sessionId },
            select: { hybridState: true },
          })
          session.hybridPersisted = (row?.hybridState as HybridPersisted | null) ?? createEmptyHybridPersisted()
        }
        return session
      } catch {
        // Redis 数据损坏，继续走 MySQL
      }
    }

    // Redis 没有，从 MySQL 恢复
    const dbSession = await prisma.ziweiSession.findUnique({
      where: { id: sessionId },
    })

    if (dbSession) {
      const session = sessionFromDbRow(dbSession)
      // 写回 Redis
      await redis.setex(`${REDIS_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session))
      return session
    }

    // 全新会话，命盘必须提供
    if (!chartData) {
      throw new Error('新会话必须提供命盘数据')
    }

    const chartSummary = generateChartSummary(chartData)
    const now = Date.now()
    const expiresAt = now + SESSION_TTL * 1000

    const hybridInit = createEmptyHybridPersisted()
    const session: ZiweiSessionData = {
      sessionId,
      userId,
      chartData,
      chartSummary,
      turns: [],
      currentDomain: '',
      turnCount: 0,
      createdAt: now,
      expiresAt,
      hybridPersisted: hybridInit,
    }

    // 持久化到 MySQL
    await prisma.ziweiSession.create({
      data: {
        id: sessionId,
        userId,
        chartData: chartData as unknown as Prisma.InputJsonValue,
        chartSummary,
        turns: [],
        turnCount: 0,
        currentDomain: '',
        hybridState: hybridInit as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(expiresAt),
      },
    })

    // 写入 Redis
    await redis.setex(`${REDIS_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session))

    return session
  }

  /**
   * 添加一轮对话
   * Redis 同步更新（快路径），MySQL 异步更新（慢路径，不阻塞响应）
   */
  async addTurn(session: ZiweiSessionData, turn: ConversationTurn): Promise<void> {
    // 截断助手回复（不存全文）
    const truncatedReply = turn.assistantReply.length > MAX_REPLY_LENGTH
      ? turn.assistantReply.slice(0, MAX_REPLY_LENGTH) + '...'
      : turn.assistantReply

    const trimmedTurn: ConversationTurn = {
      ...turn,
      assistantReply: truncatedReply,
    }

    session.turns.push(trimmedTurn)
    session.currentDomain = turn.domain.domains[0] ?? ''
    session.turnCount += 1

    // 只保留最近 N 轮
    if (session.turns.length > MAX_TURNS) {
      session.turns = session.turns.slice(-MAX_TURNS)
    }

    // 更新 Redis（快路径）
    await redis.setex(
      `${REDIS_PREFIX}${session.sessionId}`,
      SESSION_TTL,
      JSON.stringify(session),
    )

    // 异步更新 MySQL（慢路径，不阻塞响应）
    prisma.ziweiSession.update({
      where: { id: session.sessionId },
      data: {
        turns: session.turns as unknown as Prisma.InputJsonValue,
        turnCount: session.turnCount,
        currentDomain: session.currentDomain,
        hybridState: (session.hybridPersisted ?? createEmptyHybridPersisted()) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    }).catch(err => console.error('[SessionManager] MySQL 更新失败:', err))
  }

  /**
   * 追问检测
   */
  isFollowUp(question: string, session: ZiweiSessionData): boolean {
    if (session.turns.length === 0) return false
    const hasFollowWord = /那|还有|再|另外|继续|刚才|之前|如果|那么|为什么|怎么说|能具体|详细/.test(question)
    // 超短句（<4字）且含指代词才算追问
    const isUltraShort = question.length < 4
    return hasFollowWord || isUltraShort
  }

  /**
   * 获取最近 3 轮摘要
   */
  getRecentSummary(session: ZiweiSessionData): string {
    const recentTurns = session.turns.slice(-3)
    if (recentTurns.length === 0) return ''

    return recentTurns.map(t =>
      `用户问：${t.userQuestion}\n` +
      `解盘要点：${t.elements.analysisPoints.slice(0, 3).join('；')}` +
      (t.assistantReply ? `\n回答摘要：${t.assistantReply.slice(0, 100)}` : '')
    ).join('\n\n')
  }
}

// ── 命盘摘要生成 ────────────────────────────────────────

/**
 * 将 iztro 命盘数据转换为适合 Prompt 的文字摘要
 * 包含：基本信息 + 各宫主星（含四化） + 大限信息 + 四化汇总
 */
function generateChartSummary(chartData: Record<string, unknown>): string {
  const lines: string[] = []

  // 基本信息
  lines.push('## 命盘基本信息')
  lines.push(`- 命主：${String(chartData.name ?? '命主')}`)
  lines.push(`- 性别：${chartData.gender === 'male' || chartData.gender === '男' ? '男' : '女'}`)
  lines.push(`- 命宫：${String(chartData.soul ?? '')} | 身宫：${String(chartData.body ?? '')}`)
  lines.push(`- 五行局：${String(chartData.fiveElementsClass ?? '')}`)

  // 各宫主星（含四化标注）
  lines.push('\n## 各宫主星')
  const palaces = chartData.palaces as Array<{
    name: string
    majorStars: Array<{ name: string; mutagen?: string; type?: string }>
    minorStars: Array<{ name: string; mutagen?: string; type?: string }>
  }> ?? []

  for (const palace of palaces) {
    const majorStarNames = palace.majorStars.map(s =>
      s.mutagen ? `${s.name}（${s.mutagen}）` : s.name
    ).join('、')
    const minorStarNames = palace.minorStars
      ?.filter(s => ['化禄', '化权', '化科', '化忌'].includes(s.name) || s.mutagen)
      .map(s => s.mutagen ? `${s.name}（${s.mutagen}）` : s.name)
      .join('、') ?? ''
    const allStars = [majorStarNames, minorStarNames].filter(Boolean).join('、')
    if (allStars) {
      lines.push(`- ${palace.name}：${allStars}`)
    }
  }

  // 命盘中出现的四化汇总（从 mutagen 字段提取）
  const sihuaSummary: string[] = []
  const sihuaNames = ['化禄', '化权', '化科', '化忌']
  for (const palace of palaces) {
    for (const star of palace.majorStars) {
      if (star.mutagen && sihuaNames.includes(star.mutagen)) {
        sihuaSummary.push(`${star.name}${star.mutagen}入${palace.name}`)
      }
    }
  }
  if (sihuaSummary.length > 0) {
    lines.push('\n## 命盘四化')
    lines.push(`- ${sihuaSummary.join('；')}`)
  }

  return lines.join('\n')
}
