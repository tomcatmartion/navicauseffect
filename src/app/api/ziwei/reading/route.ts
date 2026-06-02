/**
 * POST /api/ziwei/reading — 紫微斗数解盘（程序混合 Hybrid）
 *
 * 请求体：{ sessionId?, question, chartData?, stream? }
 * 响应：stream=true 时为 SSE 流式输出
 */
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkDailyLimit, incrementDailyUsage } from '@/lib/rate-limit'
import { runHybridPipeline, appendAssistantReply } from '@/orchestration/hybrid'
import type { HybridDebugInfo } from '@/types/hybrid-debug'
import { ReadingRequestSchema } from '@/lib/ziwei/session/types'
import { parseOpenAiSseEventBlock } from '@/lib/ai/openai-sse'
import { parseHybridAssistantPayload } from '@/core/adapters/iztro/ai-parse'

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
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
  }

  const parsed = ReadingRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', detail: parsed.error.message },
      { status: 400 },
    )
  }

  const { sessionId, question, chartData } = parsed.data
  const useStream = Boolean((body as Record<string, unknown>)?.stream)

  if (!sessionId && !chartData) {
    return NextResponse.json(
      { error: '首次解盘需要提供命盘数据（chartData）' },
      { status: 400 },
    )
  }

  try {
    const { stream, sessionId: newSessionId, debugInfo } = await runHybridPipeline({
      sessionId: sessionId ?? crypto.randomUUID(),
      userId: session.user.id,
      question,
      chartData,
      parentBirthYears: parsed.data.parentBirthYears,
      targetYear: parsed.data.targetYear,
      routingAnswers: parsed.data.routingAnswers,
    })

    await incrementDailyUsage(session.user.id, ip)

    if (useStream) {
      const transformedStream = createSseStream(stream, newSessionId, debugInfo, (fullReply) => {
        void appendAssistantReply(newSessionId, fullReply).catch(err =>
          console.error('[Hybrid] appendAssistantReply 失败:', err),
        )
      })
      return new Response(transformedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Architecture': 'hybrid',
        },
      })
    }

    return NextResponse.json({
      reply: '(请使用 stream=true 获取流式响应)',
      sessionId: newSessionId,
    })
  } catch (err) {
    console.error('[ZiWei Reading Error]', err)

    const errMsg = err instanceof Error ? err.message : String(err)
    let userMessage = '解盘失败，请稍后重试'

    if (errMsg.includes('未配置任何 AI 模型')) {
      userMessage = 'AI 模型未配置，请联系管理员'
    } else if (errMsg.includes('API error') || errMsg.includes('请求失败')) {
      userMessage = 'AI 服务暂时不可用，请稍后重试'
    } else if (errMsg.includes('token plan not support')) {
      userMessage = 'AI 模型套餐不支持，请联系管理员更换模型'
    }

    const devDebug =
      process.env.NODE_ENV === 'development'
        ? errMsg.length > 12000
          ? `${errMsg.slice(0, 6000)}\n…(省略中间)…\n${errMsg.slice(-5500)}`
          : errMsg
        : undefined

    return NextResponse.json(
      {
        error: userMessage,
        ...(devDebug ? { _debug: devDebug } : {}),
      },
      { status: 500 },
    )
  }
}

function mapSseStreamError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  const isTimeout =
    name === 'TimeoutError' ||
    msg.includes('aborted due to timeout') ||
    msg.includes('请求超时')
  if (isTimeout) {
    return 'AI 响应超时（生成时间较长），请稍后重试或缩短提问'
  }
  if (process.env.NODE_ENV === 'development') {
    return `生成中断：${msg.slice(0, 300)}`
  }
  return '生成中断，请稍后重试'
}

function createSseStream(
  stream: ReadableStream,
  sessionId: string,
  debugInfo?: HybridDebugInfo,
  onComplete?: (fullReply: string) => void,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let sessionIdSent = false
      let debugSent = false
      let fullReply = ''

      const TAIL_BUFFER_SIZE = 300
      let tailBuffer = ''

      const emitText = (text: string) => {
        if (!text) return
        if (!sessionIdSent) {
          sessionIdSent = true
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, sessionId })}\n\n`))
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
        if (!debugSent && debugInfo) {
          debugSent = true
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'debug', debugInfo })}\n\n`))
        }
      }

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
                const deltaText = chunk.deltaText
                fullReply += deltaText
                tailBuffer += deltaText

                if (tailBuffer.length > TAIL_BUFFER_SIZE) {
                  const safeLen = tailBuffer.length - TAIL_BUFFER_SIZE
                  emitText(tailBuffer.slice(0, safeLen))
                  tailBuffer = tailBuffer.slice(safeLen)
                }
              }
            }
          }
        }

        const { narrative } = parseHybridAssistantPayload(fullReply)

        // 如果 AI 返回空内容，发送错误提示
        if (!narrative || narrative.length === 0) {
          console.warn('[SSE] AI 返回空内容，fullReply 长度:', fullReply.length)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'AI 返回空内容，请重试' })}\n\n`),
          )
        } else {
          const alreadySent = fullReply.length - tailBuffer.length
          const remaining = narrative.length - alreadySent
          if (remaining > 0) {
            emitText(tailBuffer.slice(0, remaining))
          }
        }

        if (!debugSent && debugInfo) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'debug', debugInfo })}\n\n`))
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        if (onComplete && fullReply.length > 0) {
          onComplete(fullReply)
        }
      } catch (err) {
        console.error('[SSE] 流处理错误:', err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: mapSseStreamError(err) })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })
}
