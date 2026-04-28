/**
 * AI 批量打标模块。
 * 支持三种模式：
 * - system: 严格按 systag 预设标签打标
 * - hybrid: 第一步按预设标签打标，第二步 AI 补充自定义标签（结果 = system + 补充）
 * - auto: AI 完全自由识别内容打标签
 */

import type { AIProvider } from "@/lib/ai/types";
import type { TagRuleDef } from "@/lib/logicdoc/registry";

/** 每批 chunk 数量 */
const BATCH_SIZE = 5;

/** AI 打标模式 */
export type AiTagMode = "system" | "hybrid" | "auto";

/** AI 打标结果：chunk index → tags */
export type AiTagResult = Map<number, string[]>;

// ─── Prompt 构建 ───

/**
 * 构建按预设标签严格打标的 prompt（system 模式 / hybrid 第一步）。
 */
function buildPresetTagPrompt(
  tagDefs: TagRuleDef[],
  fileTagsLine: string,
  chunks: Array<{ idx: number; text: string }>
): string {
  const tagDesc = tagDefs
    .map((t) => `- ${t.name}：${t.desc}（关键词：${t.keywords.join("、")}）`)
    .join("\n");

  const textList = chunks
    .map((c) => `[${c.idx}] ${c.text}`)
    .join("\n\n");

  return `你是分类专家。为下面 ${chunks.length} 段文本选择最相关的标签。

## 可选标签（共 ${tagDefs.length} 个，必须从中选取，禁止自创）
${tagDesc}

${fileTagsLine}

## 待分类文本
${textList}

## 输出格式
只输出一个 JSON 数组，不要输出其他任何内容。
每段的 idx 必须与输入文本的 [N] 编号完全一致。

[{"idx":0,"tags":["标签A","标签B"]},{"idx":1,"tags":["标签C","标签D"]}]

本批次共 ${chunks.length} 段，idx 范围 0~${chunks.length - 1}。

## 规则
1. 对照可选标签的关键词和描述，严格判断文本是否真正涉及该领域
2. 只打确实相关的标签，不要为了凑数而强行关联；如果文本是通用方法论、操作说明、模板等不涉及具体业务领域的内容，tags 可以为空数组
3. 每段 0~6 个标签
4. 只能从上面的可选标签中选取`;
}

/**
 * 构建 AI 补充打标的 prompt（hybrid 第二步）。
 * 告诉 AI 每段已有哪些预设标签，让它补充预设标签没覆盖的内容。
 */
function buildSupplementPrompt(
  presetTagsMap: Map<number, string[]>,
  chunks: Array<{ idx: number; text: string }>
): string {
  const textList = chunks
    .map((c) => {
      const existing = presetTagsMap.get(c.idx) ?? [];
      return `[${c.idx}] 已有标签：${existing.length > 0 ? existing.join("、") : "无"}\n${c.text}`;
    })
    .join("\n\n");

  return `你是分类专家。下面每段文本已有一些标签，请补充这些标签没覆盖到的内容领域。

## 待补充文本
${textList}

## 输出格式
只输出一个 JSON 数组，不要输出其他任何内容。
每段的 idx 必须与输入文本的 [N] 编号完全一致。
只输出新增的补充标签，不要重复已有标签。

[{"idx":0,"tags":["补充标签X"]},{"idx":1,"tags":["补充标签Y","补充标签Z"]}]

本批次共 ${chunks.length} 段，idx 范围 0~${chunks.length - 1}。

## 规则
1. 仔细阅读文本，找出已有标签没覆盖到的内容领域
2. 为每段补充 0~3 个新标签
3. 如果已有标签已经完全覆盖文本内容，可以返回空数组 []
4. 新标签 2~6 个中文字符，精确描述内容领域
5. 禁止过于宽泛的标签（如"基础知识"、"其他"、"综合"）`;
}

/**
 * 构建 AI 自由打标的 prompt（auto 模式）。
 */
function buildAutoTagPrompt(
  fileTagsLine: string,
  chunks: Array<{ idx: number; text: string }>
): string {
  const textList = chunks
    .map((c) => `[${c.idx}] ${c.text}`)
    .join("\n\n");

  return `你是分类专家。为下面 ${chunks.length} 段文本自由归纳标签。

${fileTagsLine}

## 待分类文本
${textList}

## 输出格式
只输出一个 JSON 数组，不要输出其他任何内容。
每段的 idx 必须与输入文本的 [N] 编号完全一致。

[{"idx":0,"tags":["标签A","标签B"]},{"idx":1,"tags":["标签C","标签D"]}]

本批次共 ${chunks.length} 段，idx 范围 0~${chunks.length - 1}。

## 规则
1. 根据内容自由归纳标签名称
2. 只打确实相关的标签，通用方法论或模板类内容可以返回空数组 []
3. 每段 0~6 个标签
4. 标签 2~6 个中文字符，精确描述内容领域
5. 禁止过于宽泛的标签（如"基础知识"、"其他"、"综合"）`;
}

// ─── 响应解析 ───

/**
 * 清除 AI 输出中的 thinking/reasoning 标签及其内容。
 */
function stripThinking(text: string): string {
  return text
    .replace(/<think[\s\S]*?<\/think\s*>/gi, "")
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
    .replace(/<\/?think[^>]*>/gi, "");
}

/**
 * 从 AI 响应中解析标签映射。
 * 兼容：thinking 标签、markdown code block、截断 JSON、字段名错拼。
 */
function parseTagResponse(response: string): AiTagResult {
  const result = new Map<number, string[]>();

  try {
    const cleaned = stripThinking(response);

    const allMatches = [...cleaned.matchAll(/\[\s*\{[\s\S]*?\}\s*\]/g)];
    if (allMatches.length === 0) return result;

    let jsonStr = allMatches[allMatches.length - 1][0];

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // JSON 可能被截断，尝试修复
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace > 0) {
        try {
          parsed = JSON.parse(jsonStr.slice(0, lastBrace + 1) + "]");
        } catch {
          return result;
        }
      } else {
        return result;
      }
    }

    if (!Array.isArray(parsed)) return result;

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      if (typeof item.idx !== "number") continue;
      const tagsValue = item.tags ?? item.ags ?? item.tag ?? item.Tag;
      if (Array.isArray(tagsValue)) {
        const tags = (tagsValue as unknown[]).filter((t): t is string => typeof t === "string");
        if (tags.length > 0) result.set(item.idx, tags);
      }
    }
  } catch {
    // 解析完全失败
  }

  return result;
}

// ─── 单批 AI 调用 ───

/** AI 调用配置 */
const CHAT_CONFIG = {
  systemMessage: "你是分类专家。只输出一个JSON数组，不输出思考过程、解释或任何其他文字。直接以 [ 开头。",
  maxTokens: 4000,
  temperature: 0,
};

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

/**
 * 对一批 chunk 调用 AI 并解析结果。带重试（遇 529 过载等临时错误自动重试）。
 */
async function callAIForBatch(
  provider: AIProvider,
  prompt: string,
  batchIdx: number,
  totalBatches: number
): Promise<AiTagResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await provider.chatSync(
        [
          { role: "system", content: CHAT_CONFIG.systemMessage },
          { role: "user", content: prompt },
        ],
        { maxTokens: CHAT_CONFIG.maxTokens, temperature: CHAT_CONFIG.temperature }
      );

    if (!response || !response.trim()) {
      console.warn(`[ai-tagger] batch ${batchIdx}/${totalBatches} 空响应`);
      return new Map();
    }

    const batchResult = parseTagResponse(response);

    if (batchResult.size === 0) {
      const cleaned = stripThinking(response);
      // 区分：真正的 JSON 解析失败 vs AI 合法返回空标签
      const looksLikeValidJson = /^\s*\[\s*\{[\s\S]*\}\s*\]\s*$/.test(cleaned);
      if (looksLikeValidJson) {
        console.info(
          `[ai-tagger] batch ${batchIdx}/${totalBatches} AI 返回空标签（文本不涉及已知分类）`
        );
      } else {
        console.warn(
          `[ai-tagger] batch ${batchIdx}/${totalBatches} 响应解析失败，` +
          `原始响应前300字：${cleaned.slice(0, 300)}`
        );
      }
    }

    return batchResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isOverloaded = msg.includes("529") || msg.includes("overloaded") || msg.includes("rate");
    if (isOverloaded && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * attempt;
      console.warn(`[ai-tagger] batch ${batchIdx}/${totalBatches} 过载，${delay}ms 后重试 (${attempt}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    console.warn(`[ai-tagger] batch ${batchIdx}/${totalBatches} API 调用失败：${msg.slice(0, 200)}`);
    return new Map();
  }
  }
  return new Map();
}

/**
 * 将批次内 idx 转换为全局 idx 并写入 result。
 */
function mergeBatchResult(
  result: AiTagResult,
  batchResult: AiTagResult,
  batchStart: number
): void {
  for (const [idx, tags] of batchResult) {
    const globalIdx = batchStart + idx;
    const existing = result.get(globalIdx);
    if (existing) {
      // 合并去重
      const merged = [...new Set([...existing, ...tags])];
      result.set(globalIdx, merged);
    } else {
      result.set(globalIdx, [...tags]);
    }
  }
}

// ─── 主入口 ───

/**
 * 批量 AI 打标。
 *
 * - system: 一次调用，严格从预设标签中选取
 * - hybrid: 两次调用，第一次按预设标签打标，第二次 AI 补充
 * - auto: 一次调用，AI 完全自由归纳
 *
 * @returns chunk 全局 index → tags 映射
 */
export async function aiTagChunks(
  provider: AIProvider,
  allChunks: string[],
  mode: AiTagMode,
  tagDefs: TagRuleDef[],
  fileTags: string[],
  onBatchComplete?: (batchIdx: number, totalBatches: number) => void
): Promise<AiTagResult> {
  const result = new Map<number, string[]>();
  const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

  // 有意义的文件标签（过滤兜底值）
  const meaningfulTags = fileTags.filter((t) => t !== "通用" && t !== "always");
  const fileTagsLine = meaningfulTags.length > 0
    ? `## 文件级标签参考\n${meaningfulTags.join("、")}`
    : "";

  for (let batchStart = 0; batchStart < allChunks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, allChunks.length);
    const batchIdx = Math.floor(batchStart / BATCH_SIZE) + 1;

    const batchChunks = allChunks
      .slice(batchStart, batchEnd)
      .map((text, i) => ({ idx: i, text }));

    // ─── 第一步：按预设标签打标（system / hybrid 共用） ───
    if (mode === "system" || mode === "hybrid") {
      const presetPrompt = buildPresetTagPrompt(tagDefs, fileTagsLine, batchChunks);
      const presetResult = await callAIForBatch(provider, presetPrompt, batchIdx, totalBatches);
      mergeBatchResult(result, presetResult, batchStart);
    }

    // ─── hybrid 第二步：AI 补充标签 ───
    if (mode === "hybrid") {
      // 收集第一步的预设标签结果，传给补充 prompt
      const presetTagsMap = new Map<number, string[]>();
      for (const chunk of batchChunks) {
        const globalIdx = batchStart + chunk.idx;
        const tags = result.get(globalIdx);
        if (tags) presetTagsMap.set(chunk.idx, tags);
      }

      const supplementPrompt = buildSupplementPrompt(presetTagsMap, batchChunks);
      const supplementResult = await callAIForBatch(provider, supplementPrompt, batchIdx, totalBatches);
      mergeBatchResult(result, supplementResult, batchStart);
    }

    // ─── auto 模式：完全自由 ───
    if (mode === "auto") {
      const autoPrompt = buildAutoTagPrompt(fileTagsLine, batchChunks);
      const autoResult = await callAIForBatch(provider, autoPrompt, batchIdx, totalBatches);
      mergeBatchResult(result, autoResult, batchStart);
    }

    onBatchComplete?.(batchIdx, totalBatches);
  }

  return result;
}
