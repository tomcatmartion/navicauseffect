/**
 * POST /api/ziwei/reading — 紫微斗数解盘入口
 *
 * 支持两种架构：
 * - Skill 架构（混合架构，推荐）：知识直灌 + 5%兜底工具调用
 * - RAG 架构：向量检索，保留旧版架构（pipeline.rag.ts）
 *
 * 请求体：{ sessionId?, question, chartData?, stream?, architecture? }
 *   - architecture: "skill" | "rag" (可选，默认从环境变量读取)
 * 响应：
 *   - stream=false: { reply, sessionId, elements }
 *   - stream=true: SSE 流式输出
 */
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkDailyLimit, incrementDailyUsage } from '@/lib/rate-limit'
import { runReadingPipeline } from '@/lib/ziwei/rag/pipeline'   // 混合架构（默认）
import { runReadingPipeline as runRAGPipeline } from '@/lib/ziwei/rag/pipeline.rag' // RAG 架构
import { runHybridPipeline, appendAssistantReply } from '@/lib/ziwei/rag/pipeline.hybrid' // 程序模型混合架构
import type { SkillDebugInfo } from '@/lib/ziwei/rag/pipeline'
import type { HybridDebugInfo } from '@/lib/ziwei/rag/pipeline.hybrid'
import { SessionManager } from '@/lib/ziwei/rag/session-manager'
import { ReadingRequestSchema } from '@/lib/ziwei/rag/types'
import { parseOpenAiSseEventBlock } from '@/lib/ai/openai-sse'
import { getArchitectureMode, ARCHITECTURE_MODE } from '@/lib/ziwei/architecture-mode'
import { parseHybridAssistantPayload } from '@/lib/ziwei/hybrid/ai-parse'

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

  // ── 请求体解析 ─────────────────────────────────────
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

  // 优先使用请求参数中的架构选择，否则使用环境变量
  const requestArchitecture = (body as Record<string, unknown>)?.architecture as string | undefined
  const currentMode = getArchitectureMode()
  const useSkillArchitecture = requestArchitecture === 'skill' || (!requestArchitecture && currentMode === ARCHITECTURE_MODE.SKILL)
  const useHybridArchitecture = requestArchitecture === 'hybrid' || (!requestArchitecture && currentMode === ARCHITECTURE_MODE.HYBRID)

  console.log(`[ZiWei Reading] 使用架构: ${useHybridArchitecture ? 'Hybrid' : useSkillArchitecture ? 'Skill混合' : 'RAG'} (请求:${requestArchitecture ?? '无'} | 环境:${currentMode})`)

  // 首次解盘（无 sessionId）必须提供命盘数据
  if (!sessionId && !chartData) {
    return NextResponse.json(
      { error: '首次解盘需要提供命盘数据（chartData）' },
      { status: 400 }
    )
  }

  try {
    // ── 根据架构模式选择 Pipeline ─────────────────────
    if (useHybridArchitecture) {
      // ── 程序模型混合架构 ─────────────────────────────
      const { stream, sessionId: newSessionId, debugInfo } = await runHybridPipeline({
        sessionId: sessionId ?? crypto.randomUUID(),
        userId: session.user.id,
        question,
        chartData,
      })

      // 更新使用量
      await incrementDailyUsage(session.user.id, ip)

      // 流式响应
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
            'Connection': 'keep-alive',
            'X-Architecture': 'hybrid',
          },
        })
      }

      // 同步响应
      return NextResponse.json({
        reply: '(请使用 stream=true 获取流式响应)',
        sessionId: newSessionId,
      })
    } else if (useSkillArchitecture) {
      // ── Skill 混合架构 ───────────────────────────────
      const { stream, sessionId: newSessionId, debugInfo } = await runReadingPipeline({
        sessionId: sessionId ?? crypto.randomUUID(),
        userId: session.user.id,
        question,
        chartData,
      })

      // 更新使用量
      await incrementDailyUsage(session.user.id, ip)

      // 流式响应
      if (useStream) {
        const transformedStream = createSseStream(stream, newSessionId, debugInfo, (fullReply) => {
          // 流结束后保存完整 AI 回复到会话历史
          void sessionManager.loadSession(newSessionId).then(session => {
            if (session) {
              // 更新最后一轮的 assistantReply
              const lastTurn = session.turns[session.turns.length - 1]
              if (lastTurn) {
                lastTurn.assistantReply = fullReply
                void sessionManager.persistSessionSnapshot(session).catch(err =>
                  console.error('[Skill] 保存完整回复失败:', err),
                )
              }
            }
          }).catch(err => console.error('[Skill] 加载会话失败:', err))
        })
        return new Response(transformedStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Architecture': 'skill',
          },
        })
      }

      // 同步响应
      return NextResponse.json({
        reply: '(请使用 stream=true 获取流式响应)',
        sessionId: newSessionId,
      })
    } else {
      // ── RAG 向量架构 ─────────────────────────────────
      const result = await runRAGPipeline({
        sessionId: sessionId ?? crypto.randomUUID(),
        userId: session.user.id,
        question,
        chartData,
        stream: useStream,
      })

      // 更新使用量
      await incrementDailyUsage(session.user.id, ip)

      // 流式响应
      if (useStream && result.stream) {
        const streamDomain = result.domain
        const streamSession = result.session

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

                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') continue

                    const chunk = parseOpenAiSseEventBlock(line)
                    if (chunk?.deltaText) {
                      fullReply += chunk.deltaText

                      if (!sessionIdSent) {
                        sessionIdSent = true
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.deltaText, sessionId: result.sessionId })}\n\n`))
                      } else {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.deltaText })}\n\n`))
                      }

                      if (!debugSent && result.debugInfo) {
                        debugSent = true
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'debug', debugInfo: result.debugInfo })}\n\n`))
                      }
                    }
                  }
                }
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'))

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
            'X-Architecture': 'rag',
          },
        })
      }

      // 同步响应
      return NextResponse.json({
        reply: result.reply,
        sessionId: result.sessionId,
        elements: result.elements,
        debugInfo: result.debugInfo,
      })
    }


  } catch (err) {
    console.error('[ZiWei Reading Error]', err)

    // 提取有意义的错误信息
    const errMsg = err instanceof Error ? err.message : String(err)
    let userMessage = '解盘失败，请稍后重试'

    if (errMsg.includes('未配置任何 AI 模型')) {
      userMessage = 'AI 模型未配置，请联系管理员'
    } else if (errMsg.includes('API error') || errMsg.includes('请求失败')) {
      userMessage = 'AI 服务暂时不可用，请稍后重试'
    } else if (errMsg.includes('token plan not support')) {
      userMessage = 'AI 模型套餐不支持，请联系管理员更换模型'
    }

    // 开发环境：Prisma 等错误往往在长 invocation 片段之后才有根因，勿只截前 800 字
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
      { status: 500 }
    )
  }
}

/**
 * 创建 SSE 流的通用函数（支持 Skill 调试信息）
 */
function createSseStream(
  stream: ReadableStream,
  sessionId: string,
  debugInfo?: SkillDebugInfo | HybridDebugInfo,
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

      // 尾部延迟缓冲：缓存最后 300 字符，流结束后用 parseHybridAssistantPayload 剥离 JSON
      const TAIL_BUFFER_SIZE = 300
      let tailBuffer = ''  // 延迟未发的尾部文本

      /** 将文本安全地发往前端，处理 sessionId 和 debugInfo */
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
              if (chunk?.deltaText) {
                const deltaText = chunk.deltaText
                fullReply += deltaText

                // 将新文本追加到尾部缓冲
                tailBuffer += deltaText

                // 如果缓冲超过阈值，把前面安全的部分发出去，只保留尾部
                if (tailBuffer.length > TAIL_BUFFER_SIZE) {
                  const safeLen = tailBuffer.length - TAIL_BUFFER_SIZE
                  emitText(tailBuffer.slice(0, safeLen))
                  tailBuffer = tailBuffer.slice(safeLen)
                }
              }
            }
          }
        }

        // 流结束：用 parseHybridAssistantPayload 解析完整回复，剥离尾部 JSON
        const { narrative } = parseHybridAssistantPayload(fullReply)

        // 计算实际应该发送的总文本长度（narrative）
        // 已经发送了 fullReply.length - tailBuffer.length 的文本
        // 需要从 tailBuffer 中只发送 narrative 剩余的部分
        const alreadySent = fullReply.length - tailBuffer.length
        const remaining = narrative.length - alreadySent
        if (remaining > 0) {
          emitText(tailBuffer.slice(0, remaining))
        }

        // 如果没有发送过调试信息（在首个文本之前发送）
        if (!debugSent && debugInfo) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'debug', debugInfo })}\n\n`))
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        // 流结束后回调，传递完整回复（用于对话历史）
        if (onComplete && fullReply.length > 0) {
          onComplete(fullReply)
        }
      } catch (err) {
        console.error('[SSE] 流处理错误:', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成中断' })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
}
