import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createProvider } from "@/lib/ai";
import {
  buildAnalysisPrompt,
  getResolvedAnalysisPrompts,
  serializePromptMessagesForClient,
} from "@/lib/ai/prompts";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";
import {
  LogicdocIndexMissingError,
  retrieveLogicdocForAnalysis,
} from "@/lib/rag/logicdoc-retrieval";
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

const VIP_UPGRADE_MESSAGE =
  "请升级为 VIP 或充值单次付费后再使用本模块";

async function resolveActiveAIModel(modelId?: string) {
  let modelConfig = null;
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
  return modelConfig;
}

export async function POST(request: NextRequest) {
  const T0 = Date.now();
  const tick = (label: string) => {
    const ms = Date.now() - T0;
    console.log(`[analysis⏱] +${ms}ms  ${label}`);
    return ms;
  };

  try {
    tick("请求到达");
    const session = await auth();
    const body = await request.json();
    const { category, astrolabeData, horoscopeData, modelId } = body;
    const userQuestion =
      typeof body.userQuestion === "string" ? body.userQuestion : undefined;
    const showPromptOverlay = body.showPromptOverlay !== false;
    tick("auth + parse body");

    if (!category || !astrolabeData) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    if (!Object.values(AnalysisCategory).includes(category)) {
      return NextResponse.json(
        { error: "无效的分析类别" },
        { status: 400 }
      );
    }

    const vipList = await getVipCategories(prisma);

    const userId = session?.user?.id || null;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const membershipPlan = session?.user?.membershipPlan || "FREE";

    const isPremium =
      membershipPlan === "MONTHLY" ||
      membershipPlan === "QUARTERLY" ||
      membershipPlan === "YEARLY";

    const fingerprint = buildChartFingerprint(astrolabeData as Record<string, unknown>);
    tick("fingerprint");

    // 1) 已登录用户：先查存档，命中则直接返回完整内容，不调用 AI、不扣次数
    if (userId) {
      const record = await prisma.consultationRecord.findFirst({
        where: { userId, chartFingerprint: fingerprint },
        include: {
          analyses: {
            where: { category: category as AnalysisCategory },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (record?.analyses?.[0]) {
        tick("存档命中，直接返回");
        const cached = record.analyses[0];
        const payload: Record<string, unknown> = {
          cached: true,
          content: cached.fullContent,
        };
        if (showPromptOverlay) {
          const ragModel = await resolveActiveAIModel(modelId);
          if (!ragModel) {
            return NextResponse.json(
              {
                error:
                  "暂无可用的 AI 模型，无法生成 prompt 预览（向量维度与当前对话模型对齐）",
              },
              { status: 503 }
            );
          }
          const resolvedPrompts = await getResolvedAnalysisPrompts(prisma);
          const family = getEmbeddingFamilyForProvider(ragModel.provider);
          const knowledge = await retrieveLogicdocForAnalysis(prisma, {
            family,
            category: category as AnalysisCategory,
            astrolabeData: astrolabeData as Record<string, unknown>,
            horoscopeData,
            categoryPrompt:
              resolvedPrompts.categoryPrompts[category as AnalysisCategory] ??
              "",
            userSupplement: userQuestion,
          });
          const pm = buildAnalysisPrompt(
            category as AnalysisCategory,
            astrolabeData as Record<string, unknown>,
            horoscopeData,
            { knowledge, prompts: resolvedPrompts }
          );
          payload.promptMessages = serializePromptMessagesForClient(pm);
        }
        return NextResponse.json(payload);
      }

      // 2) 未命中存档且为「VIP探真」模块：无 VIP 且无单次付费次数则 403
      if (isVipCategory(category as AnalysisCategory, vipList) && !isPremium) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { bonusQueries: true },
        });
        const hasBonus = (user?.bonusQueries ?? 0) >= 1;
        if (!hasBonus) {
          return NextResponse.json(
            {
              error: VIP_UPGRADE_MESSAGE,
              needUpgrade: true,
              needSinglePay: true,
            },
            { status: 403 }
          );
        }
      }
    } else {
      // 未登录用户点击「VIP探真」模块：提示先登录
      if (isVipCategory(category as AnalysisCategory, vipList)) {
        return NextResponse.json(
          {
            error: "请先登录后再使用本模块，登录后可升级 VIP 或按次付费。",
            needUpgrade: true,
            needLogin: true,
          },
          { status: 403 }
        );
      }
    }

    const limitResult = await checkDailyLimit(userId, ip, membershipPlan);
    tick("限流检查");
    if (!limitResult.allowed) {
      const message = userId
        ? "今日免费次数已用完，请升级会员或按次付费（0.5元/次）继续使用"
        : "今日免费次数已用完，请登录获取更多次数";
      return NextResponse.json(
        { error: message, needLogin: !userId, needUpgrade: !!userId },
        { status: 429 }
      );
    }

    const modelConfig = await resolveActiveAIModel(modelId);

    if (!modelConfig) {
      return NextResponse.json(
        { error: "暂无可用的 AI 模型，请联系管理员配置" },
        { status: 503 }
      );
    }
    tick(`模型配置: ${modelConfig.provider}/${modelConfig.modelId}`);

    const resolvedPrompts = await getResolvedAnalysisPrompts(prisma);
    tick("prompts 读取");

    const provider = createProvider({
      id: modelConfig.id,
      name: modelConfig.name,
      provider: modelConfig.provider,
      apiKey: modelConfig.apiKeyEncrypted,
      baseUrl: modelConfig.baseUrl,
      modelId: modelConfig.modelId,
    });

    const family = getEmbeddingFamilyForProvider(modelConfig.provider);
    const knowledge = await retrieveLogicdocForAnalysis(prisma, {
      family,
      category: category as AnalysisCategory,
      astrolabeData: astrolabeData as Record<string, unknown>,
      horoscopeData,
      categoryPrompt:
        resolvedPrompts.categoryPrompts[category as AnalysisCategory] ?? "",
      userSupplement: userQuestion,
    });
    tick(`RAG 知识库: ${knowledge.length} chars`);

    const messages = buildAnalysisPrompt(
      category as AnalysisCategory,
      astrolabeData,
      horoscopeData,
      { knowledge, prompts: resolvedPrompts }
    );
    const promptChars = messages.reduce((s, m) => s + m.content.length, 0);
    tick(`prompt 组装: ${promptChars} chars → 发起 AI 请求`);

    // 流式输出：使用 provider.chat() 边收边转发；同时累积全文用于存档（全文推送，不按会员截断）
    const maxOutputTokens = getAnalysisMaxOutputTokens();
    const encoder = new TextEncoder();
    let accumulated = "";
    let sseBuffer = "";

    const providerStream = await provider.chat(messages, {
      maxTokens: maxOutputTokens,
    });

    const stream = new ReadableStream({
      async start(controller) {
        tick("ReadableStream.start() 进入");
        const reader = providerStream.getReader();
        let tickDone = false;
        let firstContentTick = false;
        let firstEnqueueTick = false;
        const decoder = new TextDecoder();

        try {
          if (showPromptOverlay) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  naviMeta: {
                    kind: "analysis_prompt",
                    messages: serializePromptMessagesForClient(messages),
                  },
                })}\n\n`
              )
            );
          }
          while (true) {
            const { done, value } = await reader.read();
            if (!done && !tickDone) {
              tick("🔥 AI 首个 chunk 到达");
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
                      "[analysis] sse chunk parse failed (可能为分包截断或不兼容格式):",
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
                    tick("🔥 首个有效内容(deltaText)到达");
                    firstContentTick = true;
                  }
                  accumulated += deltaText;
                }
                if (!firstEnqueueTick) {
                  tick("🔥 首 chunk enqueue → client");
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
                console.warn("[analysis] stream ended with no content from provider", {
                  category,
                  model: modelConfig.name,
                  provider: modelConfig.provider,
                  modelId: modelConfig.modelId,
                });
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{
                        delta: {
                          content:
                            "\n\n[服务端] 未解析到任何模型输出。请检查管理后台：API Key、Base URL、模型 ID 是否与厂商一致；查看终端日志中是否有「sse chunk parse failed」或上游错误 JSON。",
                        },
                      }],
                    })}\n\n`
                  )
                );
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();

              await incrementDailyUsage(userId, ip);
              if (userId) {
                let record = await prisma.consultationRecord.findFirst({
                  where: { userId, chartFingerprint: fingerprint },
                });
                if (!record) {
                  const genderVal = astrolabeData.gender === "MALE" ? Gender.MALE : Gender.FEMALE;
                  record = await prisma.consultationRecord.create({
                    data: {
                      userId,
                      chartFingerprint: fingerprint,
                      birthSolarDate: astrolabeData.solarDate || "",
                      birthLunarDate: astrolabeData.lunarDate || null,
                      timeIndex: 0,
                      gender: genderVal,
                      astrolabeData: astrolabeData as object,
                    },
                  });
                }
                await prisma.aIAnalysis.create({
                  data: {
                    recordId: record.id,
                    category: category as AnalysisCategory,
                    aiModelUsed: modelConfig.name,
                    fullContent: accumulated,
                    previewContent: accumulated,
                  },
                });
                if (isVipCategory(category as AnalysisCategory, vipList) && !isPremium) {
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
          console.error("[analysis] stream error:", err);
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
    console.error("Analysis API error:", error);
    if (error instanceof LogicdocIndexMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const errMsg = error instanceof Error ? error.message : "服务器内部错误";
    // 识别 AbortError / 超时错误，返回 504 而非 500
    const isTimeout = errMsg.includes("超时") || errMsg.includes("aborted");
    const isEmbCfg =
      errMsg.includes("未配置") && errMsg.includes("embedding");
    return NextResponse.json(
      { error: isTimeout ? "AI 生成超时，请稍后重试或换用其他模型" : errMsg },
      { status: isTimeout ? 504 : isEmbCfg ? 503 : 500 }
    );
  }
}
