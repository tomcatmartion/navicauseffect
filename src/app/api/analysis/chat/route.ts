import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createProvider } from "@/lib/ai";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/prompts/defaults";
import { retrieveLogicdocForChat } from "@/lib/rag/logicdoc-retrieval";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";
import { slimAstrolabeData } from "@/lib/ai/slim-astrolabe";
import { buildChartContext } from "@/lib/ai/chart-context";
import { parseOpenAiSseEventBlock } from "@/lib/ai/openai-sse";
import { getAnalysisMaxOutputTokens } from "@/lib/ai/analysis-limits";
import { checkDailyLimit, incrementDailyUsage } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const timing = (label: string) => {
    console.log(`[chat-timing] ${label}: +${Date.now() - t0}ms`);
  };

  try {
    // 1. 认证
    const session = await auth();
    timing("auth");
    const userId = session?.user?.id || null;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const membershipPlan = session?.user?.membershipPlan || "FREE";

    // 2. 解析请求体
    const body = await request.json();
    timing("parse-body");
    const {
      messages,
      astrolabeData,
      horoscopeData,
      modelId,
    }: {
      messages: ChatMessage[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      astrolabeData?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      horoscopeData?: any;
      modelId?: string;
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "缺少对话消息" },
        { status: 400 }
      );
    }

    // 3. 限流
    const limitResult = await checkDailyLimit(userId, ip, membershipPlan);
    timing("rate-limit");
    if (!limitResult.allowed) {
      const message = userId
        ? "今日免费次数已用完，请升级会员或按次付费继续使用"
        : "今日免费次数已用完，请登录获取更多次数";
      return NextResponse.json(
        { error: message, needLogin: !userId, needUpgrade: !!userId },
        { status: 429 }
      );
    }

    // 3.5 检查是否有预存的检索知识（通过 contextId 传入）
    let preloadedKnowledge: string | null = null;
    const { contextId }: { contextId?: string } = body;
    if (contextId) {
      const redisKey = `chat:ctx:${contextId}`;
      const stored = await redis.get(redisKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          preloadedKnowledge = parsed.knowledgeText ?? null;
        } catch {
          // ignore
        }
      }
    }

    // 4. 模型配置
    let modelConfig;
    if (modelId) {
      modelConfig = await prisma.aIModelConfig.findFirst({
        where: { id: modelId, isActive: true },
      });
    }
    if (!modelConfig) {
      modelConfig = await prisma.aIModelConfig.findFirst({
        where: { isActive: true, isDefault: true },
      });
    }
    if (!modelConfig) {
      modelConfig = await prisma.aIModelConfig.findFirst({
        where: { isActive: true },
      });
    }
    if (!modelConfig) {
      return NextResponse.json(
        { error: "暂无可用的 AI 模型，请联系管理员配置" },
        { status: 503 }
      );
    }
    timing("model-config");

    const provider = createProvider({
      id: modelConfig.id,
      name: modelConfig.name,
      provider: modelConfig.provider,
      apiKey: modelConfig.apiKeyEncrypted,
      baseUrl: modelConfig.baseUrl,
      modelId: modelConfig.modelId,
    });

    // 5. 向量检索知识库（基于用户问题推断分类，检索最相关的知识片段）
    let systemContent = DEFAULT_SYSTEM_PROMPT;
    const lastUserMsg = messages[messages.length - 1]?.content ?? "";
    try {
      if (preloadedKnowledge) {
        // 使用预存的知识（来自 chat-context API 调试模式）
        if (preloadedKnowledge.trim()) {
          systemContent += `\n\n## 解盘逻辑与规则（请严格参照执行）\n\n${preloadedKnowledge.trim()}`;
        }
      } else {
        // 正常检索
        const family = getEmbeddingFamilyForProvider(modelConfig.provider);
        const knowledge = await retrieveLogicdocForChat(prisma, {
          family,
          userQuestion: lastUserMsg,
          astrolabeData: astrolabeData ?? {},
          horoscopeData,
        });
        if (knowledge.trim()) {
          systemContent += `\n\n## 解盘逻辑与规则（请严格参照执行）\n\n${knowledge.trim()}`;
        }
      }
    } catch (e) {
      console.warn("[chat] logicdoc vector retrieval failed:", e);
    }
    timing("logicdoc-vector-retrieval");

    systemContent += `\n\n你正在为用户提供紫微斗数命理咨询服务。请基于命盘数据，结合用户的问题进行深入分析。保持温暖、专业、有深度的风格。`;

    console.log(
      `[chat-timing] system prompt 长度: ${systemContent.length} 字符`
    );

    // 6. 精简命盘数据并构建消息
    const slimmed = slimAstrolabeData(astrolabeData);
    // 从阳历日期中提取出生年份（如 "1990-01-15" → 1990）
    const birthYear = astrolabeData?.solarDate
      ? parseInt(String(astrolabeData.solarDate).substring(0, 4), 10)
      : 0;
    const chartContext = buildChartContext(slimmed, horoscopeData, {
      question: lastUserMsg,
      birthYear,
    });
    timing("slim+build-context");

    const aiMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemContent }];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user") {
        const content =
          i === 0 && chartContext
            ? `${chartContext}\n\n${msg.content}`
            : msg.content;
        aiMessages.push({ role: "user", content });
      } else {
        aiMessages.push({ role: "assistant", content: msg.content });
      }
    }
    timing("build-messages");

    const totalInputChars = aiMessages.reduce((s, m) => s + m.content.length, 0);
    console.log(
      `[chat-timing] 总输入字符: ${totalInputChars}, 消息数: ${aiMessages.length}`
    );

    // 7. 调用 AI
    const maxOutputTokens = getAnalysisMaxOutputTokens();
    const providerStream = await provider.chat(aiMessages, {
      maxTokens: maxOutputTokens,
    });
    timing("provider.chat() 返回（首 token 到达）");

    const encoder = new TextEncoder();
    let sseBuffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = providerStream.getReader();
        const decoder = new TextDecoder();

        try {
          let firstChunk = true;
          while (true) {
            const { done, value } = await reader.read();
            if (value) {
              if (firstChunk) {
                timing("首 chunk 写入 client");
                firstChunk = false;
              }
              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split(/\n\n/);
              sseBuffer = events.pop() ?? "";

              for (const event of events) {
                if (!event.trim()) continue;
                const normalizedEvent = event
                  .replace(/\r\n/g, "\n")
                  .replace(/\r/g, "\n");
                const { deltaText, providerError } =
                  parseOpenAiSseEventBlock(normalizedEvent, (payload, err) => {
                    console.warn(
                      "[chat] sse parse failed:",
                      payload.slice(0, 160),
                      err
                    );
                  });
                if (providerError) {
                  const errMsg = `\n\n[上游接口] ${providerError}`;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        choices: [{ delta: { content: errMsg } }],
                      })}\n\n`
                    )
                  );
                  continue;
                }
                if (deltaText) {
                  controller.enqueue(
                    encoder.encode(`${normalizedEvent.trim()}\n\n`)
                  );
                }
              }
            }

            if (done) {
              if (sseBuffer.trim()) {
                const tail = sseBuffer
                  .replace(/\r\n/g, "\n")
                  .replace(/\r/g, "\n")
                  .trim();
                const parsedTail = parseOpenAiSseEventBlock(tail);
                if (parsedTail.deltaText) {
                  controller.enqueue(encoder.encode(`${tail}\n\n`));
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();

              await incrementDailyUsage(userId, ip);
              timing("stream 完成（总耗时）");
              return;
            }
          }
        } catch (err) {
          console.error("[chat] stream error:", err);
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: "\n\n[对话中断，请重试]" } }],
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } finally {
            controller.close();
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

