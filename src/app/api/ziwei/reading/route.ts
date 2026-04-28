/**
 * POST /api/ziwei/reading — 四步精准召回流水线入口
 *
 * 请求体：{ sessionId?, question, chartData? }
 * 响应：
 *   - stream=false: { reply, sessionId, elements }
 *   - stream=true: SSE 流式输出
 *
 * SSE 时序：Step 1-3 同步完成后，仅 Step 4 做流式
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkDailyLimit, incrementDailyUsage } from '@/lib/rate-limit'
import { runReadingPipeline } from '@/lib/ziwei/rag/pipeline'
import { SessionManager } from '@/lib/ziwei/rag/session-manager'
import { ReadingRequestSchema } from '@/lib/ziwei/rag/types'
import { parseOpenAiSseEventBlock } from '@/lib/ai/openai-sse'

const sessionManager = new SessionManager()

export async function POST(request: NextRequest) {
  // ── 认证 ────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  // ── 限流 ────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const membershipPlan = session.user.membershipPlan || 'FREE'
  const limitResult = await checkDailyLimit(session.user.id, ip, membershipPlan)
  if (!limitResult.allowed) {
    return NextResponse.json({ error: '今日使用次数已达上限' }, { status: 429 })
  }

  // ── 请求体解析 ──────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
  }

  const parsed = ReadingRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', detail: parsed.error.message },
      { status: 400 }
    )
  }

  const { sessionId, question, chartData } = parsed.data
  const useStream = Boolean((body as Record<string, unknown>)?.stream)

  // 首次解盘（无 sessionId）必须提供命盘数据
  if (!sessionId && !chartData) {
    return NextResponse.json(
      { error: '首次解盘需要提供命盘数据（chartData）' },
      { status: 400 }
    )
  }

  try {
    const result = await runReadingPipeline({
      sessionId: sessionId ?? crypto.randomUUID(),
      userId: session.user.id,
      question,
      chartData,
      stream: useStream,
    })

    // ── 更新使用量 ──────────────────────────────────────
    await incrementDailyUsage(session.user.id, ip)

    // ── 流式响应 ────────────────────────────────────────
    if (useStream && result.stream) {
      // 闭包捕获：流式模式需要 domain 和 session 来保存会话
      const streamDomain = result.domain
      const streamSession = result.session

      // 将 AI 的 SSE 流转换为前端可读的 SSE 流
      const transformedStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          const reader = result.stream!.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let fullReply = ''
          let sessionIdSent = false
          let debugSent = false

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })

              // 解析 SSE 事件块
              const lines = buffer.split('\n')
              buffer = lines.pop() ?? ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') continue

                  const chunk = parseOpenAiSseEventBlock(line)
                  if (chunk?.deltaText) {
                    fullReply += chunk.deltaText

                    // 首个事件携带 sessionId
                    if (!sessionIdSent) {
                      sessionIdSent = true
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.deltaText, sessionId: result.sessionId })}\n\n`))
                    } else {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.deltaText })}\n\n`))
                    }

                    // 首个文本事件之后立即发送调试数据
                    if (!debugSent && result.debugInfo) {
                      debugSent = true
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'debug', debugInfo: result.debugInfo })}\n\n`))
                    }
                  }
                }
              }
            }

            // 发送结束标记
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))

            // 流结束后保存会话（异步，不阻塞响应）
            if (streamDomain && streamSession) {
              sessionManager.addTurn(streamSession, {
                userQuestion: question,
                domain: streamDomain,
                elements: result.elements,
                assistantReply: fullReply || '[流式回复]',
                timestamp: Date.now(),
              }).catch(err => console.error('[Reading SSE] 会话保存失败:', err))
            }
          } catch (err) {
            console.error('[Reading SSE] 流处理错误:', err)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成中断' })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(transformedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── 同步响应 ────────────────────────────────────────
    return NextResponse.json({
      reply: result.reply,
      sessionId: result.sessionId,
      elements: result.elements,
      debugInfo: result.debugInfo,
    })

  } catch (err) {
    console.error('[ZiWei Reading Error]', err)
    return NextResponse.json(
      { error: '解盘失败，请稍后重试' },
      { status: 500 }
    )
  }
}
