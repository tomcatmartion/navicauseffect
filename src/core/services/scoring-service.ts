/**
 * 评分服务 — 统一入口
 *
 * 职责：
 * 1. 接收命盘参数 → 执行计算 → 返回结果
 * 2. 缓存到数据库 → 后续直接查询
 * 3. 供 orchestrator / API route / 脚本统一调用
 *
 * 所有命盘数据来源：iztro（通过 iztro-reader 标准化）
 * 所有计算结果均可通过 API 复用，或从数据库中直接取。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { Stage1Output, Stage2Output, Stage3Output, Stage4Output, Stage1Input, Stage2Input, Stage3Input, Stage4Input } from '@/core/types'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'

// ═══════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════

/** 从 chartData 生成指纹（用于缓存键） */
export function buildChartFingerprint(chartData: Record<string, unknown>): string {
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthSolarDate = typeof birthInfo?.solarDate === 'string'
    ? birthInfo.solarDate
    : typeof chartData.solarDate === 'string'
      ? chartData.solarDate
      : ''
  const gender = chartData.gender === 'male' || chartData.gender === '男' ? 'MALE' : 'FEMALE'
  const timeIndex = typeof chartData.timeIndex === 'number' ? chartData.timeIndex : 0
  return `${birthSolarDate}_${gender}_${timeIndex}`
}

// ═══════════════════════════════════════════════════════════════════
// ScoringService
// ═══════════════════════════════════════════════════════════════════

export class ScoringService {
  // ── Stage 1：原局评分 ──────────────────────────────────────────

  /**
   * 获取或计算 Stage1（原局评分）
   *
   * 如果 DB 中已有同指纹的 stage1Snapshot，直接返回（跳过计算）。
   * 否则执行计算并写入 DB。
   */
  async getOrCacheStage1(params: {
    userId: string
    chartData: Record<string, unknown>
    parentBirthYears?: { father?: number; mother?: number }
  }): Promise<Stage1Output> {
    const fingerprint = buildChartFingerprint(params.chartData)

    // 尝试从 DB 读取缓存
    const cached = await prisma.consultationRecord.findFirst({
      where: {
        userId: params.userId,
        chartFingerprint: fingerprint,
        stage1Snapshot: { not: Prisma.DbNull },
      },
      select: { stage1Snapshot: true },
    })

    if (cached?.stage1Snapshot) {
      return cached.stage1Snapshot as unknown as Stage1Output
    }

    // 执行计算
    const result = executeStage1({
      chartData: params.chartData,
      parentBirthYears: params.parentBirthYears,
    })

    // 异步写入 DB（不阻塞返回）
    this.saveStage1ToDb(params.userId, params.chartData, result).catch(err =>
      console.error('[ScoringService] Stage1 DB 保存失败:', err),
    )

    return result
  }

  /**
   * 直接执行 Stage1 计算（不查 DB 缓存）
   * 适用于调试、脚本等场景
   */
  computeStage1(input: Stage1Input): Stage1Output {
    return executeStage1(input)
  }

  // ── Stage 2：性格定性 ──────────────────────────────────────────

  /**
   * 获取或计算 Stage2（性格定性）
   *
   * 依赖 Stage1 结果。如果 DB 中已有同指纹的 stage2Snapshot，直接返回。
   */
  async getOrCacheStage2(params: {
    userId: string
    chartData: Record<string, unknown>
    stage1: Stage1Output
    question: string
  }): Promise<Stage2Output> {
    const fingerprint = buildChartFingerprint(params.chartData)

    // 尝试从 DB 读取缓存
    const cached = await prisma.consultationRecord.findFirst({
      where: {
        userId: params.userId,
        chartFingerprint: fingerprint,
        stage2Snapshot: { not: Prisma.DbNull },
      },
      select: { stage2Snapshot: true },
    })

    if (cached?.stage2Snapshot) {
      return cached.stage2Snapshot as unknown as Stage2Output
    }

    // 执行计算
    const result = executeStage2({
      stage1: params.stage1,
      question: params.question,
    })

    // 异步写入 DB
    this.saveStage2ToDb(params.userId, params.chartData, result).catch(err =>
      console.error('[ScoringService] Stage2 DB 保存失败:', err),
    )

    return result
  }

  /**
   * 直接执行 Stage2 计算
   */
  computeStage2(input: Stage2Input): Stage2Output {
    return executeStage2(input)
  }

  // ── Stage 3：事项分析（纯计算，无 LLM）──────────────────────

  /**
   * 执行事项分析
   *
   * Stage3 是无状态的纯计算，每次都重新执行（不同 matterType/year 组合结果不同）。
   * 结果由调用方决定是否缓存（如 orchestrator 的 matterHistory）。
   */
  analyzeMatter(input: Stage3Input): Stage3Output {
    return executeStage3(input)
  }

  // ── Stage 4：互动关系（纯计算，无 LLM）──────────────────────

  /**
   * 执行互动关系分析
   *
   * Stage4 是无状态的纯计算。
   */
  analyzeInteraction(input: Stage4Input): Stage4Output {
    return executeStage4(input)
  }

  // ── DB 查询 ───────────────────────────────────────────────────

  /**
   * 获取用户的咨询记录列表
   */
  async listConsultations(userId: string) {
    return prisma.consultationRecord.findMany({
      where: { userId },
      select: {
        id: true,
        chartFingerprint: true,
        birthSolarDate: true,
        gender: true,
        timeIndex: true,
        lastMatterType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取单条咨询记录（含完整评分快照）
   */
  async getConsultation(id: string) {
    return prisma.consultationRecord.findUnique({
      where: { id },
    })
  }

  // ── DB 写入（内部方法）────────────────────────────────────────

  private async saveStage1ToDb(
    userId: string,
    chartData: Record<string, unknown>,
    stage1: Stage1Output,
  ): Promise<void> {
    const fingerprint = buildChartFingerprint(chartData)
    const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
    const birthSolarDate = typeof birthInfo?.solarDate === 'string'
      ? birthInfo.solarDate
      : typeof chartData.solarDate === 'string'
        ? chartData.solarDate
        : ''
    const gender = chartData.gender === 'male' || chartData.gender === '男' ? 'MALE' : 'FEMALE'
    const timeIndex = typeof chartData.timeIndex === 'number' ? chartData.timeIndex : 0

    const existing = await prisma.consultationRecord.findFirst({
      where: { userId, chartFingerprint: fingerprint },
    })

    if (existing) {
      await prisma.consultationRecord.update({
        where: { id: existing.id },
        data: { stage1Snapshot: stage1 as unknown as Prisma.InputJsonValue },
      })
    } else {
      await prisma.consultationRecord.create({
        data: {
          userId,
          chartFingerprint: fingerprint,
          birthSolarDate,
          gender: gender as 'MALE' | 'FEMALE',
          timeIndex,
          astrolabeData: chartData as unknown as Prisma.InputJsonValue,
          stage1Snapshot: stage1 as unknown as Prisma.InputJsonValue,
        },
      })
    }
  }

  private async saveStage2ToDb(
    userId: string,
    chartData: Record<string, unknown>,
    stage2: Stage2Output,
  ): Promise<void> {
    const fingerprint = buildChartFingerprint(chartData)

    const existing = await prisma.consultationRecord.findFirst({
      where: { userId, chartFingerprint: fingerprint },
    })

    if (existing) {
      await prisma.consultationRecord.update({
        where: { id: existing.id },
        data: { stage2Snapshot: stage2 as unknown as Prisma.InputJsonValue },
      })
    }
    // 如果没有 stage1 记录，不单独创建（stage2 依赖 stage1）
  }

  /**
   * 保存完整快照（Stage1 + Stage2 + 报告）
   * 供 orchestrator 在合适时机调用
   */
  async saveFullSnapshot(params: {
    userId: string
    chartData: Record<string, unknown>
    stage1: Stage1Output
    stage2: Stage2Output
    reportMarkdown?: string
    matterType?: string
  }): Promise<void> {
    const { userId, chartData, stage1, stage2, reportMarkdown, matterType } = params
    const fingerprint = buildChartFingerprint(chartData)
    const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
    const birthSolarDate = typeof birthInfo?.solarDate === 'string'
      ? birthInfo.solarDate
      : typeof chartData.solarDate === 'string'
        ? chartData.solarDate
        : ''
    const gender = chartData.gender === 'male' || chartData.gender === '男' ? 'MALE' : 'FEMALE'
    const timeIndex = typeof chartData.timeIndex === 'number' ? chartData.timeIndex : 0

    const data = {
      stage1Snapshot: stage1 as unknown as Prisma.InputJsonValue,
      stage2Snapshot: stage2 as unknown as Prisma.InputJsonValue,
      lastMatterType: matterType,
      latestReport: reportMarkdown
        ? { markdown: reportMarkdown, generatedAt: Date.now() } as unknown as Prisma.InputJsonValue
        : undefined,
    }

    const existing = await prisma.consultationRecord.findFirst({
      where: { userId, chartFingerprint: fingerprint },
    })

    if (existing) {
      await prisma.consultationRecord.update({
        where: { id: existing.id },
        data,
      })
    } else {
      await prisma.consultationRecord.create({
        data: {
          userId,
          chartFingerprint: fingerprint,
          birthSolarDate,
          gender: gender as 'MALE' | 'FEMALE',
          timeIndex,
          astrolabeData: chartData as unknown as Prisma.InputJsonValue,
          ...data,
        },
      })
    }
  }
}

/** 全局单例 */
export const scoringService = new ScoringService()
