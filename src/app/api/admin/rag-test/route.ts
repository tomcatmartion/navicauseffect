import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";
import {
  retrieveLogicdocForAnalysisDetailed,
  retrieveLogicdocQueryTexts,
  buildRagQueryText,
  buildRagQueryVariants,
  inferAnalysisCategory,
} from "@/lib/rag/logicdoc-retrieval";
import { buildAnalysisPrompt, getResolvedAnalysisPrompts } from "@/lib/ai/prompts";
import { AnalysisCategory } from "@prisma/client";
import type { EmbeddingDimensionFamily } from "@/lib/zvec/constants";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * POST: RAG 检索测试
 * 接收检索语句，使用与前端完全一致的逻辑生成检索词、执行检索、组装 prompt。
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const body = await request.json();
    const {
      query,
      category = "PERSONALITY",
      topk = 12,
      family: familyOverride,
      astrolabeData: userAstrolabe,
    }: {
      query: string;
      category?: string;
      topk?: number;
      family?: string;
      astrolabeData?: Record<string, unknown>;
    } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: "缺少检索语句" }, { status: 400 });
    }

    // topk 范围校验
    const safeTopk = Math.min(Math.max(1, topk), 50);

    // 自动推断类别：AUTO → 根据 query 推断
    let categoryEnum = category as AnalysisCategory;
    if (category === "AUTO") {
      categoryEnum = inferAnalysisCategory(query);
    }
    if (!Object.values(AnalysisCategory).includes(categoryEnum)) {
      return NextResponse.json({ error: `无效的类别: ${category}` }, { status: 400 });
    }

    // 获取活跃模型
    const modelConfig = await prisma.aIModelConfig.findFirst({
      where: { isActive: true, isDefault: true },
    }) ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });

    if (!modelConfig) {
      return NextResponse.json({ error: "无可用 AI 模型配置" }, { status: 503 });
    }

    const family: EmbeddingDimensionFamily = (familyOverride as EmbeddingDimensionFamily) ?? getEmbeddingFamilyForProvider(modelConfig.provider);

    // 获取 prompt 配置
    const resolvedPrompts = await getResolvedAnalysisPrompts(prisma);
    const categoryPrompt = resolvedPrompts.categoryPrompts[categoryEnum] ?? "";

    // 使用传入的 astrolabeData（如无则用空数据，仅测试检索词/向量匹配）
    const mockAstrolabe: Record<string, unknown> = userAstrolabe ?? { soul: "", body: "", palaces: [] };

    // 1. 生成检索词（与前端逻辑一致）
    const queryTexts = await retrieveLogicdocQueryTexts(prisma, {
      family,
      category: categoryEnum,
      astrolabeData: mockAstrolabe,
      horoscopeData: {},
      categoryPrompt,
      userSupplement: query,
    });

    // 也生成 query 变体用于展示
    const queryVariants = buildRagQueryVariants(
      categoryEnum,
      categoryPrompt,
      mockAstrolabe,
      {},
      query
    );

    const singleQuery = buildRagQueryText(
      categoryEnum,
      categoryPrompt,
      mockAstrolabe,
      {},
      query
    );

    // 2. 执行 RAG 检索（获取详细结果）
    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family,
      category: categoryEnum,
      astrolabeData: mockAstrolabe,
      horoscopeData: {},
      categoryPrompt,
      userSupplement: query,
      topk: safeTopk,
    });

    // 3. 组装完整 prompt（与前端一致）
    const messages = buildAnalysisPrompt(
      categoryEnum,
      mockAstrolabe,
      {},
      { knowledge: detail.knowledgeText, prompts: resolvedPrompts }
    );

    // 4. 提取 RAG 检索结果片段（从 meta.hits 获取命中详情）
    const retrievalResults = detail.meta.hits.map((hit) => ({
      id: `hit-${hit.index}`,
      score: hit.score,
      text: hit.preview,
      sourceFile: hit.sourceFile,
      textLength: hit.textLength,
      bizModules: hit.bizModules,
      palaces: [] as string[],
      stars: [] as string[],
    }));

    return NextResponse.json({
      queryTexts,
      queryVariants,
      singleQuery,
      resolvedCategory: categoryEnum,
      categoryPrompt,
      retrievalResults,
      knowledgeText: detail.knowledgeText,
      systemPrompt: messages[0]?.content ?? "",
      userMessage: messages[1]?.content ?? "",
      ragMeta: detail.meta ? {
        knowledgeLength: detail.knowledgeText.length,
        topk: detail.meta.topk,
        truncated: detail.meta.truncated,
        filterSteps: detail.meta.filterSteps,
        hits: detail.meta.hits,
        totalHits: detail.meta.totalHits,
      } : null,
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
      family,
    });
  } catch (error) {
    console.error("[rag-test] error:", error);
    const msg = error instanceof Error ? error.message : "检索失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
