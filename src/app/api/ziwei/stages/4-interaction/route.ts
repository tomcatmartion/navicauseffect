/**
 * API Route: 阶段四 — 互动关系分析
 *
 * POST /api/ziwei/stages/4-interaction
 *
 * 自动补全阶段一+二，返回虚拟命盘 + 三维合参 + 互动取象。
 * LLM 不参与本阶段计算。
 */

import { NextResponse } from 'next/server'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage4 } from '@/core/stages/stage4-interaction'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      chartData?: Record<string, unknown>
      partnerBirthYear?: number
      targetYear?: number
    }

    if (!body.chartData) {
      return NextResponse.json(
        { error: '缺少 chartData 参数' },
        { status: 400 },
      )
    }

    // partnerBirthYear 可以为 null → 降级为 E3 单方关系宫分析
    const partnerBirthYear = body.partnerBirthYear ?? null
    const targetYear = body.targetYear ?? new Date().getFullYear()

    // 自动补全阶段一+二
    const stage1 = executeStage1({ chartData: body.chartData })
    const stage2 = executeStage2({ stage1, question: '互动关系' })

    // 执行阶段四（含 E3 单方降级）
    const stage4 = executeStage4({
      stage1,
      stage2,
      partnerBirthYear,
      chartData: body.chartData,
      targetYear,
    })

    // E3 单方分析时 partnerGan/partnerZhi 为 '—'，无虚拟命盘
    const isSolo = (stage4.interaction.partnerGan as string) === '—'
    return NextResponse.json({
      stage: 4,
      mode: isSolo ? 'E3-单方关系宫分析' : '完整太岁入卦',
      partner: {
        gan: stage4.interaction.partnerGan,
        zhi: stage4.interaction.partnerZhi,
      },
      virtualChart: isSolo ? null : {
        virtualMingGong: stage4.interaction.virtualChart!.virtualMingGong,
        incomingStarCount: stage4.interaction.virtualChart!.incomingStars.length,
        incomingStars: stage4.interaction.virtualChart!.incomingStars.map(s => ({
          star: s.star,
          target: s.targetDiZhi,
          type: s.type,
          sihua: s.sihuaType,
        })),
      },
      threeDimension: stage4.interaction.threeDimension,
      tensionPoints: stage4.interaction.tensionPoints,
      adjustableAdvice: stage4.interaction.adjustableAdvice,
      fixedRisks: stage4.interaction.fixedRisks,
      knowledgeSnippetCount: stage4.knowledgeSnippets.length,
    })
  } catch (error) {
    console.error('[Stage4 API] 执行失败:', error)
    return NextResponse.json(
      { error: '阶段四执行失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
