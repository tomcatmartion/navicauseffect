import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildAnalysisPrompt,
  getResolvedAnalysisPrompts,
  serializePromptMessagesForClient,
} from "@/lib/ai/prompts";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";
import {
  LogicdocIndexMissingError,
  retrieveLogicdocForAnalysisDetailed,
} from "@/lib/rag/logicdoc-retrieval";
import { auth } from "@/lib/auth";
import { checkDailyLimit } from "@/lib/rate-limit";
import { AnalysisCategory } from "@prisma/client";
import {
  buildChartFingerprint,
  getVipCategories,
  isVipCategory,
} from "@/lib/analysis-archive";
import { redis } from "@/lib/redis";
import { v4 as uuid } from "uuid";

/** Redis key 前缀，TTL 5 分钟 */
const CTX_PREFIX = "analysis:ctx:";
const CTX_TTL_SEC = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { category, astrolabeData, horoscopeData, modelId } = body;
    const userQuestion =
      typeof body.userQuestion === "string" ? body.userQuestion : undefined;

    if (!category || !astrolabeData) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }
    if (!Object.values(AnalysisCategory).includes(category)) {
      return NextResponse.json({ error: "无效的分析类别" }, { status: 400 });
    }

    const userId = session?.user?.id || null;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const membershipPlan = session?.user?.membershipPlan || "FREE";
    const isPremium =
      membershipPlan === "MONTHLY" ||
      membershipPlan === "QUARTERLY" ||
      membershipPlan === "YEARLY";

    // VIP 模块权限检查
    const vipList = await getVipCategories(prisma);
    if (isVipCategory(category as AnalysisCategory, vipList) && !isPremium) {
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

    // 限流检查（不计数，仅检查）
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

    // 检索知识库（detailed 版本）
    const resolvedPrompts = await getResolvedAnalysisPrompts(prisma);
    const family = getEmbeddingFamilyForProvider(modelConfig.provider);
    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family,
      category: category as AnalysisCategory,
      astrolabeData: astrolabeData as Record<string, unknown>,
      horoscopeData,
      categoryPrompt:
        resolvedPrompts.categoryPrompts[category as AnalysisCategory] ?? "",
      userSupplement: userQuestion,
    });

    // 拼装 messages
    const messages = buildAnalysisPrompt(
      category as AnalysisCategory,
      astrolabeData,
      horoscopeData,
      { knowledge: detail.knowledgeText, prompts: resolvedPrompts }
    );

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
      }),
      "EX",
      CTX_TTL_SEC
    );

    return NextResponse.json({
      contextId,
      queryTexts: detail.queryTexts,
      promptMessages: serializePromptMessagesForClient(messages),
      ragMeta: {
        knowledgeLength: detail.knowledgeText.length,
        topk: detail.meta.topk,
        truncated: detail.meta.truncated,
        filterSteps: detail.meta.filterSteps,
        hits: detail.meta.hits,
        totalHits: detail.meta.totalHits,
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
      },
    });
  } catch (error) {
    console.error("[analysis/context] error:", error);
    if (error instanceof LogicdocIndexMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
