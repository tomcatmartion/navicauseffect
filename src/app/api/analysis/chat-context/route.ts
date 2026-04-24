import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkDailyLimit } from "@/lib/rate-limit";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";
import {
  retrieveLogicdocForAnalysisDetailed,
  retrieveLogicdocQueryTexts,
} from "@/lib/rag/logicdoc-retrieval";
import { DEFAULT_SYSTEM_PROMPT, getResolvedAnalysisPrompts } from "@/lib/ai/prompts";
import { slimAstrolabeData } from "@/lib/ai/slim-astrolabe";
import { buildChartContext } from "@/lib/ai/chart-context";
import { AnalysisCategory } from "@prisma/client";
import { inferAnalysisCategory } from "@/lib/rag/logicdoc-retrieval";
import { v4 as uuid } from "uuid";
import { redis } from "@/lib/redis";

/** Redis key 前缀，TTL 5 分钟 */
const CTX_PREFIX = "chat:ctx:";
const CTX_TTL_SEC = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { messages, astrolabeData, horoscopeData, modelId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "缺少 messages 参数" }, { status: 400 });
    }
    if (!astrolabeData) {
      return NextResponse.json({ error: "缺少 astrolabeData 参数" }, { status: 400 });
    }

    const userId = session?.user?.id || null;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const membershipPlan = session?.user?.membershipPlan || "FREE";

    // 限流检查
    const limitResult = await checkDailyLimit(userId, ip, membershipPlan);
    if (!limitResult.allowed) {
      const message = userId
        ? "今日免费次数已用完，请升级会员或按次付费继续使用"
        : "今日免费次数已用完，请登录获取更多次数";
      return NextResponse.json(
        { error: message, needLogin: !userId, needUpgrade: !!userId },
        { status: 429 }
      );
    }

    // 解析模型
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
    if (!modelConfig) {
      return NextResponse.json(
        { error: "暂无可用的 AI 模型，请联系管理员配置" },
        { status: 503 }
      );
    }

    // 从消息中提取用户最新问题
    const lastUserMsg = messages[messages.length - 1]?.content ?? "";
    if (!lastUserMsg.trim()) {
      return NextResponse.json({ error: "用户消息为空" }, { status: 400 });
    }

    // 推断分类
    const category = inferAnalysisCategory(lastUserMsg) as AnalysisCategory;
    const resolvedPrompts = await getResolvedAnalysisPrompts(prisma);
    const family = getEmbeddingFamilyForProvider(modelConfig.provider);

    // 获取检索词（不实际执行检索，只是为了得到 query texts）
    const queryTexts = await retrieveLogicdocQueryTexts(prisma, {
      family,
      category,
      astrolabeData: astrolabeData as Record<string, unknown>,
      horoscopeData,
      categoryPrompt: resolvedPrompts.categoryPrompts[category] ?? "",
      userSupplement: lastUserMsg,
    });

    // 实际检索以获取 RAG 元数据
    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family,
      category,
      astrolabeData: astrolabeData as Record<string, unknown>,
      horoscopeData,
      categoryPrompt: resolvedPrompts.categoryPrompts[category] ?? "",
      userSupplement: lastUserMsg,
    });

    // 构建完整的 promptMessages（用于调试页面展示）
    let systemContent = DEFAULT_SYSTEM_PROMPT;
    if (detail.knowledgeText.trim()) {
      systemContent += `\n\n## 解盘逻辑与规则（请严格参照执行）\n\n${detail.knowledgeText.trim()}`;
    }
    systemContent += `\n\n你正在为用户提供紫微斗数命理咨询服务。请基于命盘数据，结合用户的问题进行深入分析。保持温暖，专业、有深度的风格。`;

    // 构建命盘上下文
    const slimmed = slimAstrolabeData(astrolabeData);
    const birthYear = astrolabeData?.solarDate
      ? parseInt(String(astrolabeData.solarDate).substring(0, 4), 10)
      : 0;
    const chartContext = buildChartContext(slimmed, horoscopeData, {
      question: lastUserMsg,
      birthYear,
    });

    // 构建 promptMessages
    const promptMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemContent },
    ];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user") {
        const content =
          i === 0 && chartContext
            ? `${chartContext}\n\n${msg.content}`
            : msg.content;
        promptMessages.push({ role: "user", content });
      } else {
        promptMessages.push({ role: "assistant", content: msg.content });
      }
    }

    // 存入 Redis，返回 contextId
    const contextId = uuid();
    const redisKey = `${CTX_PREFIX}${contextId}`;
    await redis.set(
      redisKey,
      JSON.stringify({
        messages,
        category,
        astrolabeData,
        horoscopeData,
        modelId: modelConfig.id,
        knowledgeText: detail.knowledgeText, // 存储检索到的知识
      }),
      "EX",
      CTX_TTL_SEC
    );

    return NextResponse.json({
      contextId,
      queryTexts,
      promptMessages,
      ragMeta: detail.meta ? {
        knowledgeLength: detail.knowledgeText.length,
        topk: detail.meta.topk,
        truncated: detail.meta.truncated,
        filterSteps: detail.meta.filterSteps,
        hits: detail.meta.hits,
        totalHits: detail.meta.totalHits,
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
      } : null,
    });
  } catch (error) {
    console.error("[chat/context] error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
