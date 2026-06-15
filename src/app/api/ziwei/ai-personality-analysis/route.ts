/**
 * API Route: AI 性格分析（流式）
 *
 * POST /api/ziwei/ai-personality-analysis
 *
 * 将阶段一（宫位评分）+ 阶段二（性格定性）的 IR 数据拼接为完整 prompt，
 * 调用大模型流式生成性格分析文本，以 SSE 响应返回。
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkDailyLimit, incrementDailyUsage } from '@/lib/rate-limit'
import { runCoreChartStages } from '@/core/pipeline/run-chart-stages'
import {
  buildPrompt,
  buildChartSnapshotObject,
  STAGE1_HINT,
  STAGE2_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import { callAIStream } from '@/lib/ai/skill-callers'
import { parseOpenAiSseEventBlock } from '@/lib/ai/openai-sse'
import type { IRStage1, IRStage2 } from '@/core/types'
import { hasValidChartPalaces } from '@/lib/ziwei/chart-data-validation'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const membershipPlan = session.user.membershipPlan || 'FREE'
  const limitResult = await checkDailyLimit(session.user.id, ip, membershipPlan)
  if (!limitResult.allowed) {
    return NextResponse.json({ error: '今日使用次数已达上限' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 })
  }

  const {
    chartData,
    targetYear: rawTargetYear,
    parentBirthYears,
  } = body as {
    chartData?: Record<string, unknown>
    targetYear?: number
    parentBirthYears?: { father?: number; mother?: number }
  }

  if (!hasValidChartPalaces(chartData)) {
    return NextResponse.json(
      { error: '缺少有效的 chartData.palaces（至少 12 宫）' },
      { status: 400 },
    )
  }

  const targetYear = rawTargetYear ?? new Date().getFullYear()

  try {
    // ── 1. 运行 stage1 + stage2 ──
    const { stage1, stage2 } = runCoreChartStages(chartData, {
      question: '请分析我的性格',
      matterType: '求财',
      targetYear,
      parentBirthYears,
    })

    // ── 2. 构建 IR ──
    const chartSnapshot = buildChartSnapshotObject(chartData, {
      birthGan: stage1.scoringCtx.birthGan,
      taiSuiZhi: stage1.scoringCtx.taiSuiZhi,
    })

    const ir1: IRStage1 = {
      stage: 1,
      palaceScores: stage1.palaceScores,
      allPatterns: stage1.allPatterns,
      mergedSihua: stage1.mergedSihua,
      hasParentInfo: stage1.hasParentInfo,
      parentBirthYears,
      chartSnapshot,
    }

    const ir2: IRStage2 = {
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
    }

    // ── 3. 构建并合并 prompt messages ──
    const knowledge1 = stage1.knowledgeSnippets.map(s => s.content)
    const knowledge2 = stage2.knowledgeSnippets.map(s => s.content)

    const msgs1 = buildPrompt(ir1, knowledge1, '（排盘页 AI 性格分析）', STAGE1_HINT)
    const msgs2 = buildPrompt(ir2, knowledge2, '请基于以上宫位评分结果，进行详细的性格分析', STAGE2_HINT)

    // 合并：共用系统角色 + IR1 + 知识1 + 阶段1提示 + IR2 + 知识2 + 阶段2提示 + 最终用户消息
    const mergedMessages = [
      msgs1[0],   // system: 系统角色
      msgs1[1],   // system: IR1 宫位评分
      msgs1[2],   // system: stage1 知识片段（可能不存在）
      msgs1[3],   // system: STAGE1_HINT
      msgs2[1],   // system: IR2 性格定性
      msgs2[2],   // system: stage2 知识片段
      msgs2[3],   // system: STAGE2_HINT
      {
        role: 'user' as const,
        content: '请综合以上宫位评分和性格定性数据，输出一份详尽的性格分析报告。\n\n要求：\n1. 先分析表层（命宫：外在表现、第一印象、社交面具）\n2. 再分析中层（身宫：遇到压力时的真实应对模式）\n3. 最后分析内核层（太岁宫：深层价值观、本能驱动力）\n4. 合参说明三者是统一、互补还是矛盾\n5. 分析时必须引用数据中的具体数值和星曜名称',
      },
    ].filter(Boolean)

    // ── 4. 调用 AI 流式输出 ──
    const aiStream = await callAIStream({ messages: mergedMessages, temperature: 0.7, max_tokens: 4000 })

    // ── 5. 包装为 SSE 响应 ──
    const sseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const reader = aiStream.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue

                const chunk = parseOpenAiSseEventBlock(line)
                if (chunk?.providerError) {
                  throw new Error(chunk.providerError)
                }
                if (chunk?.deltaText) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.deltaText })}\n\n`))
                }
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          await incrementDailyUsage(session.user.id, ip)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[AI Personality Analysis Error]', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
