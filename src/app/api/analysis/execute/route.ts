import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createProvider } from "@/lib/ai";
import { parseOpenAiSseEventBlock } from "@/lib/ai/openai-sse";
import { getAnalysisMaxOutputTokens } from "@/lib/ai/analysis-limits";
import { auth } from "@/lib/auth";
import { checkDailyLimit, incrementDailyUsage } from "@/lib/rate-limit";
import { AnalysisCategory, Gender } from "@prisma/client";
import {
  buildChartFingerprint,
  getVipCategories,
  isVipCategory,
} from "@/lib/analysis-archive";
import { redis } from "@/lib/redis";
import type { AnalysisChatMessage } from "@/lib/ai/prompts";

const CTX_PREFIX = "analysis:ctx:";

type StoredContext = {
  messages: AnalysisChatMessage[];
  category: string;
  astrolabeData: Record<string, unknown>;
  horoscopeData?: Record<string, unknown>;
  modelId: string;
};

export async function POST(request: NextRequest) {
  const T0 = Date.now();
  const tick = (label: string) => {
    const ms = Date.now() - T0;
    console.log(`[analysis-exec⏱] +${ms}ms  ${label}`);
    return ms;
  };

  try {
    tick("请求到达");
    const session = await auth();
    const body = await request.json();
    const { contextId, category, astrolabeData } = body;

    if (!contextId) {
      return NextResponse.json({ error: "缺少 contextId" }, { status: 400 });
    }

    // 从 Redis 取回上下文
    const raw = await redis.get(`${CTX_PREFIX}${contextId}`);
    if (!raw) {
      return NextResponse.json(
        { error: "上下文已过期，请重新获取" },
        { status: 410 }
      );
    }
    // 取回即删，防止重复使用
    await redis.del(`${CTX_PREFIX}${contextId}`);

    const stored = JSON.parse(raw) as StoredContext;
    const messages = stored.messages;
    const effectiveCategory = (category ?? stored.category) as AnalysisCategory;
    const effectiveAstrolabeData =
      (astrolabeData as Record<string, unknown>) ?? stored.astrolabeData;
    const effectiveHoroscopeData = stored.horoscopeData;
    tick("Redis 取回上下文");

    // 鉴权 + 限流
    const userId = session?.user?.id || null;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const membershipPlan = session?.user?.membershipPlan || "FREE";
    const isPremium =
      membershipPlan === "MONTHLY" ||
      membershipPlan === "QUARTERLY" ||
      membershipPlan === "YEARLY";

    const vipList = await getVipCategories(prisma);
    if (
      isVipCategory(effectiveCategory, vipList) &&
      !isPremium
    ) {
      if (!userId) {
        return NextResponse.json(
          { error: "请先登录后再使用本模块", needLogin: true },
          { status: 403 }
        );
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { bonusQueries: true },
      });
      const hasBonus = (user?.bonusQueries ?? 0) >= 1;
      if (!hasBonus) {
        return NextResponse.json(
          { error: "请升级为 VIP 或充值单次付费后再使用本模块", needUpgrade: true },
          { status: 403 }
        );
      }
    }

    const limitResult = await checkDailyLimit(userId, ip, membershipPlan);
    tick("限流检查");
    if (!limitResult.allowed) {
      const message = userId
        ? "今日免费次数已用完，请升级会员或按次付费继续使用"
        : "今日免费次数已用完，请登录获取更多次数";
      return NextResponse.json(
        { error: message, needLogin: !userId, needUpgrade: !!userId },
        { status: 429 }
      );
    }

    // 解析模型（用 context 存储的 modelId）
    const modelConfig = await prisma.aIModelConfig.findFirst({
      where: { id: stored.modelId, isActive: true },
    });
    if (!modelConfig) {
      return NextResponse.json(
        { error: "模型配置已变更，请重新获取上下文" },
        { status: 503 }
      );
    }
    tick(`模型配置: ${modelConfig.provider}/${modelConfig.modelId}`);

    const provider = createProvider({
      id: modelConfig.id,
      name: modelConfig.name,
      provider: modelConfig.provider,
      apiKey: modelConfig.apiKeyEncrypted,
      baseUrl: modelConfig.baseUrl,
      modelId: modelConfig.modelId,
    });

    // 流式调用 LLM
    const maxOutputTokens = getAnalysisMaxOutputTokens();
    const encoder = new TextEncoder();
    let accumulated = "";
    let sseBuffer = "";

    const providerStream = await provider.chat(messages, {
      maxTokens: maxOutputTokens,
    });

    const fingerprint = buildChartFingerprint(effectiveAstrolabeData);

    const stream = new ReadableStream({
      async start(controller) {
        tick("ReadableStream.start() 进入");
        const reader = providerStream.getReader();
        let tickDone = false;
        let firstContentTick = false;
        let firstEnqueueTick = false;
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (!done && !tickDone) {
              tick("AI 首个 chunk 到达");
              tickDone = true;
            }
            if (value) {
              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split(/\n\n/);
              sseBuffer = events.pop() ?? "";

              for (const event of events) {
                if (!event.trim()) continue;
                const normalizedEvent = event
                  .replace(/\r\n/g, "\n")
                  .replace(/\r/g, "\n");
                const { deltaText, providerError } = parseOpenAiSseEventBlock(
                  normalizedEvent,
                  (payload, err) => {
                    console.warn(
                      "[analysis-exec] sse chunk parse failed:",
                      payload.slice(0, 160),
                      err
                    );
                  }
                );
                if (providerError) {
                  const errMsg = `\n\n[上游接口] ${providerError}`;
                  accumulated += errMsg;
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
                  if (!firstContentTick) {
                    tick("首个有效内容到达");
                    firstContentTick = true;
                  }
                  accumulated += deltaText;
                }
                if (!firstEnqueueTick) {
                  tick("首 chunk enqueue");
                  firstEnqueueTick = true;
                }
                controller.enqueue(
                  encoder.encode(`${normalizedEvent.trim()}\n\n`)
                );
              }
            }

            if (done) {
              tick(`流结束，accumulated: ${accumulated.length} chars`);
              if (sseBuffer.trim()) {
                const tail = sseBuffer
                  .replace(/\r\n/g, "\n")
                  .replace(/\r/g, "\n")
                  .trim();
                const parsedTail = parseOpenAiSseEventBlock(tail);
                if (parsedTail.providerError) {
                  const errMsg = `\n\n[上游接口] ${parsedTail.providerError}`;
                  accumulated += errMsg;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        choices: [{ delta: { content: errMsg } }],
                      })}\n\n`
                    )
                  );
                } else {
                  if (parsedTail.deltaText) {
                    accumulated += parsedTail.deltaText;
                  }
                  controller.enqueue(encoder.encode(`${tail}\n\n`));
                }
              }
              if (!accumulated) {
                console.warn("[analysis-exec] stream ended with no content");
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: "\n\n[未解析到模型输出，请重试]" } }],
                    })}\n\n`
                  )
                );
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();

              // 扣次数 + 写存档
              await incrementDailyUsage(userId, ip);
              if (userId) {
                let record = await prisma.consultationRecord.findFirst({
                  where: { userId, chartFingerprint: fingerprint },
                });
                if (!record) {
                  const genderVal =
                    effectiveAstrolabeData.gender === "MALE"
                      ? Gender.MALE
                      : Gender.FEMALE;
                  record = await prisma.consultationRecord.create({
                    data: {
                      userId,
                      chartFingerprint: fingerprint,
                      birthSolarDate: String(effectiveAstrolabeData.solarDate ?? ""),
                      birthLunarDate: effectiveAstrolabeData.lunarDate ? String(effectiveAstrolabeData.lunarDate) : null,
                      timeIndex: 0,
                      gender: genderVal,
                      astrolabeData: effectiveAstrolabeData as object,
                    },
                  });
                }
                await prisma.aIAnalysis.create({
                  data: {
                    recordId: record.id,
                    category: effectiveCategory,
                    aiModelUsed: modelConfig.name,
                    fullContent: accumulated,
                    previewContent: accumulated,
                  },
                });
                if (
                  isVipCategory(effectiveCategory, vipList) &&
                  !isPremium
                ) {
                  await prisma.user.update({
                    where: { id: userId },
                    data: { bonusQueries: { decrement: 1 } },
                  });
                }
              }
              return;
            }
          }
        } catch (err) {
          console.error("[analysis-exec] stream error:", err);
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: "\n\n[解析中断，请重试]" } }],
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
    console.error("[analysis/execute] error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
