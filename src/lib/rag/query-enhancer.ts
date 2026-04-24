/**
 * AI 语义增强检索关键词生成。
 * 根据用户原句、推断类别、命盘数据，让 AI 生成检索增强关键词。
 * 带内存缓存（相同输入复用结果）。
 */
import type { AIProvider } from "@/lib/ai/types";
import type { AnalysisCategory } from "@prisma/client";
import { createHash } from "crypto";

// ─── 缓存 ───

const CACHE_MAX = 128;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { keywords: string; expireAt: number }>();

function cacheKey(category: AnalysisCategory, userQuery: string): string {
  return createHash("sha256")
    .update(`${category}:${userQuery.slice(0, 200)}`)
    .digest("hex");
}

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }
  return entry.keywords;
}

function setCache(key: string, keywords: string): void {
  if (cache.size >= CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expireAt) cache.delete(k);
    }
    if (cache.size >= CACHE_MAX) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
  }
  cache.set(key, { keywords, expireAt: Date.now() + CACHE_TTL_MS });
}

// ─── AI 调用 ───

const SYSTEM_PROMPT = `你是紫微斗数领域的检索专家。根据用户问题和分析类别，生成用于知识库向量检索的增强关键词。
只输出关键词，用空格分隔，不要输出其他内容。要求：
1. 生成 10~20 个关键词，覆盖用户意图的不同表达方式
2. 使用紫微斗数专业术语（宫位名、星曜名、四化术语等）
3. 宁多勿漏，同义词、近义词都要包含
4. 不要重复用户原句中的词`;

function buildUserPrompt(
  category: AnalysisCategory,
  userQuery: string,
  palaceSnippet: string
): string {
  const CATEGORY_LABEL: Record<AnalysisCategory, string> = {
    PERSONALITY: "性格分析",
    FORTUNE: "综合运势",
    MARRIAGE: "感情婚姻",
    CAREER: "事业财运",
    HEALTH: "健康提示",
    PARENT_CHILD: "家庭六亲关系",
    EMOTION: "情绪心理",
  };

  let prompt = `用户问题：${userQuery}\n分析类别：${CATEGORY_LABEL[category] ?? category}`;
  if (palaceSnippet) {
    prompt += `\n命盘宫位信息：${palaceSnippet}`;
  }
  prompt += "\n\n请生成用于知识库检索的增强关键词（仅输出空格分隔的关键词）：";
  return prompt;
}

/**
 * 清除 AI 输出中的 thinking 标签。
 */
function stripThinking(text: string): string {
  return text
    .replace(/<think[\s\S]*?<\/think\s*>/gi, "")
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
    .replace(/<\/?think[^>]*>/gi, "");
}

/**
 * 从 AI 响应中提取关键词字符串。
 */
function parseKeywordResponse(response: string): string {
  const cleaned = stripThinking(response).trim();
  // 移除可能的序号、逗号、分号，统一为空格分隔
  return cleaned
    .replace(/[\d]+[.、,，;；:\s]+/g, " ")
    .replace(/[,，;；:：\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 调用 AI 生成检索增强关键词（带缓存）。
 * @returns 空格分隔的关键词字符串
 */
export async function generateQueryEnhanceKeywords(
  provider: AIProvider,
  category: AnalysisCategory,
  userQuery: string,
  palaceSnippet: string
): Promise<string> {
  const key = cacheKey(category, userQuery);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const response = await provider.chatSync(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(category, userQuery, palaceSnippet) },
      ],
      { maxTokens: 500, temperature: 0.3 }
    );

    const keywords = parseKeywordResponse(response);
    if (keywords.length > 0) {
      setCache(key, keywords);
      return keywords;
    }
    return "";
  } catch {
    // AI 调用失败不阻塞，返回空关键词
    return "";
  }
}
