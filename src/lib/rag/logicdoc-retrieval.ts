import { AnalysisCategory } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  ZVecIndexType,
  ZVecOpen,
  type ZVecCollection,
} from "@zvec/zvec";
import { ensureZvecInitialized } from "@/lib/zvec/init-zvec";
import { embeddingCollectionDimension } from "@/lib/zvec/constants";
import { getEmbeddingConfigForFamily } from "@/lib/zvec/embedding-config";
import { fetchEmbeddingVector } from "@/lib/zvec/fetch-embedding";
import { getLogicdocCollectionPath } from "@/lib/zvec/paths";
import type { EmbeddingDimensionFamily } from "@/lib/zvec/constants";
import { buildHoroscopeQuerySnippet } from "@/lib/rag/horoscope-query-snippet";
import { stableChunkId } from "@/lib/logicdoc/chunk-metadata";
import { extractSystagKeywordsForCategory } from "@/lib/logicdoc/registry";
import { generateQueryEnhanceKeywords } from "@/lib/rag/query-enhancer";
import { createProvider } from "@/lib/ai";
import {
  buildTextLikeOrFilter,
  extractKeywordSupplementTerms,
} from "@/lib/rag/logicdoc-hybrid";
import { rerankRowsByLexical, type RerankableRow } from "@/lib/rag/logicdoc-rerank";
import { createHash } from "crypto";

// ─── Embedding 向量缓存（避免相同查询文本重复调 API） ───
const EMBEDDING_CACHE_MAX = 128;
const EMBEDDING_CACHE_TTL_MS = 10 * 60 * 1000;
const embeddingCache = new Map<string, { vector: number[]; expireAt: number }>();

function getEmbeddingCacheKey(queryText: string, dimension: number): string {
  return createHash("sha256").update(`${dimension}:${queryText}`).digest("hex");
}

function getCachedVector(key: string): number[] | null {
  const entry = embeddingCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    embeddingCache.delete(key);
    return null;
  }
  return entry.vector;
}

function setCachedVector(key: string, vector: number[]): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of embeddingCache) {
      if (now > v.expireAt) embeddingCache.delete(k);
    }
    if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey !== undefined) embeddingCache.delete(firstKey);
    }
  }
  embeddingCache.set(key, { vector, expireAt: Date.now() + EMBEDDING_CACHE_TTL_MS });
}

export class LogicdocIndexMissingError extends Error {
  constructor() {
    super(
      "未建立 logicdoc 向量索引。请在管理后台配置两套 Embedding 后点击「重建 logicdoc 索引」，或在服务器执行 npm run logicdoc:index-zvec"
    );
    this.name = "LogicdocIndexMissingError";
  }
}

function uniqTags(tags: string[]): string[] {
  return [...new Set(tags)];
}

/**
 * 各模块对应 systag 标签体系中的标签名。
 * 标签名须与 systag/*.json 中定义的 name 一致，否则 contain_any 过滤无法命中。
 *
 * 同时保留了旧标签名（如"性格""感情"等）作为兼容，确保尚未重新打标的 chunk 仍能被检索到。
 */
const ANALYSIS_CATEGORY_BIZ_TAGS: Record<AnalysisCategory, string[]> = {
  PERSONALITY: uniqTags([
    // systag 新标签
    "正面性格", "负面性格", "人生境遇", "容貌外形", "精神心理",
    // 旧标签兼容（未重新打标的 chunk）
    "性格", "感情", "互动", "通用", "always",
    "星曜赋性", "容貌体相", "宫位论述", "星曜组合",
    "脾气性情", "正向", "负向",
  ]),
  FORTUNE: uniqTags([
    // systag 新标签
    "人生境遇", "事业职业", "财运专项", "健康疾病", "学业功名",
    "正面性格", "负面性格", "出行迁移", "官司刑狱",
    // 旧标签兼容
    "运势", "事业", "财运", "健康", "名声", "学业", "性格", "通用", "always",
    "运限分析", "格局", "四化论述", "星曜赋性",
  ]),
  MARRIAGE: uniqTags([
    // systag 新标签
    "婚姻恋爱", "子女家庭", "六亲关系", "正面性格", "负面性格", "精神心理",
    "人生境遇", "健康疾病",
    // 旧标签兼容
    "感情", "亲子", "互动", "性格", "运势", "健康", "通用", "always",
    "星曜赋性", "四化论述", "宫位论述", "星曜组合",
    "正向", "负向", "禁忌注意",
  ]),
  CAREER: uniqTags([
    // systag 新标签
    "事业职业", "财运专项", "人生境遇", "正面性格", "负面性格",
    // 旧标签兼容
    "事业", "财运", "名声", "运势", "性格", "通用", "always",
    "星曜赋性", "格局", "宫位论述", "星曜组合",
    "正向", "负向",
  ]),
  HEALTH: uniqTags([
    // systag 新标签
    "健康疾病", "人生境遇", "负面性格",
    // 旧标签兼容
    "健康", "运势", "通用", "always",
    "星曜赋性", "宫位论述",
    "负向", "禁忌注意",
  ]),
  PARENT_CHILD: uniqTags([
    // systag 新标签
    "子女家庭", "婚姻恋爱", "六亲关系", "正面性格", "负面性格", "精神心理",
    "人生境遇", "健康疾病",
    // 旧标签兼容
    "亲子", "感情", "互动", "性格", "运势", "健康", "通用", "always",
    "星曜赋性", "宫位论述", "星曜组合",
    "正向", "负向", "禁忌注意",
  ]),
  EMOTION: uniqTags([
    // systag 新标签
    "婚姻恋爱", "正面性格", "负面性格", "精神心理", "六亲关系",
    "子女家庭", "人生境遇",
    // 旧标签兼容
    "感情", "性格", "互动", "亲子", "运势", "健康", "通用", "always",
    "星曜赋性", "脾气性情", "四化论述", "宫位论述", "星曜组合",
    "正向", "负向",
  ]),
};

function quoteFilter(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function buildBizModulesFilter(tags: string[]): string {
  const parts = tags.map(quoteFilter).join(", ");
  return `biz_modules contain_any (${parts})`;
}

function mingPalaceClauseForCategory(category: AnalysisCategory): string {
  const relational: AnalysisCategory[] = [
    "MARRIAGE",
    "EMOTION",
    "PARENT_CHILD",
  ];
  if (relational.includes(category)) {
    return (
      "(palaces contain_any ('命宫', '夫妻宫', '子女宫', '交友宫', '仆役宫') or " +
      "array_length(palaces) = 0)"
    );
  }
  return "(palaces contain_any ('命宫') or array_length(palaces) = 0)";
}

function attachMingPalaceFilter(
  baseFilter: string,
  category: AnalysisCategory
): string {
  if (process.env.LOGICDOC_RAG_FILTER_MING !== "1") return baseFilter;
  const ming = mingPalaceClauseForCategory(category);
  return `(${baseFilter}) and ${ming}`;
}

/** 各解盘模块优先强调的宫位（用于检索 query 与关键词补充） */
const MODULE_FOCUS_PALACES: Record<AnalysisCategory, string[]> = {
  PERSONALITY: ["命宫", "福德宫"],
  FORTUNE: ["命宫", "迁移宫", "福德宫"],
  MARRIAGE: ["夫妻宫", "命宫", "子女宫"],
  CAREER: ["官禄宫", "事业宫", "财帛宫", "迁移宫"],
  HEALTH: ["疾厄宫", "命宫", "福德宫"],
  PARENT_CHILD: ["子女宫", "父母宫", "兄弟宫", "夫妻宫", "命宫"],
  EMOTION: ["夫妻宫", "福德宫", "命宫"],
};

/**
 * 各分类查询增强关键词：在检索查询中追加，帮助 embedding 聚焦到正确主题。
 *
 * 注意：应使用知识库中实际高频出现的核心术语，而非用户口语化用词。
 * 例如知识库中用"大限/流年"而非"运势"，用"入卦/四化"而非"亲子/教育"。
 */
const CATEGORY_QUERY_ENHANCE: Record<AnalysisCategory, string> = {
  PERSONALITY: "命主性格 性格底色 为人处事 行为模式 性格特征",
  FORTUNE: "大限 流年 行运 十年 事项宫 四化 事业 财运 运势", // 知识库高频词优先
  MARRIAGE: "感情 夫妻宫 入卦 四化 关系类型 互动 桃花 配偶 伴侣", // 知识库以"感情+入卦"为主
  CAREER: "事业 官禄宫 财帛宫 工作 四化 事项宫 升职 跳槽 创业 职业 财运 财星 化禄 正财 偏财 财富 收入 理财 禄存 赚钱",
  HEALTH: "疾厄宫 健康 身体 疾病 养生 凶格 凶限 四化 事项宫",
  PARENT_CHILD: "子女宫 亲子 父母宫 兄弟宫 夫妻宫 六亲 家庭关系 入卦 四化 关系类型 互动 教育 子女缘分 兄弟姐妹 手足 配偶",
  EMOTION: "感情 夫妻宫 入卦 四化 关系类型 互动 桃花 情绪 伴侣 婚姻",
};

function ragRelaxMinHits(): number {
  const n = Number(process.env.LOGICDOC_RAG_RELAX_MIN_HITS ?? "5");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

function ragRelaxAlwaysPool(): boolean {
  return process.env.LOGICDOC_RAG_RELAX_ALWAYS_POOL !== "0";
}

function ragAllowNoFilter(): boolean {
  return process.env.LOGICDOC_RAG_ALLOW_NO_FILTER !== "0";
}

function ragMultiQuery(): boolean {
  return process.env.LOGICDOC_RAG_MULTIQUERY !== "0";
}

function ragNeighborChunks(): boolean {
  return process.env.LOGICDOC_RAG_NEIGHBOR_CHUNKS !== "0";
}

function ragKeywordSupplement(): boolean {
  return process.env.LOGICDOC_RAG_KEYWORD_SUPPLEMENT !== "0";
}

function ragLexicalWeight(): number {
  const n = Number(process.env.LOGICDOC_RAG_LEXICAL_WEIGHT ?? "0.35");
  if (!Number.isFinite(n)) return 0.35;
  return Math.min(1, Math.max(0, n));
}

// ─── 融合检索配置 ───

function ragRetrievalMode(): "legacy" | "fusion" {
  return process.env.LOGICDOC_RAG_MODE === "fusion" ? "fusion" : "legacy";
}

function ragFusionVectorTopk(): number {
  const n = Number(process.env.LOGICDOC_RAG_FUSION_VECTOR_TOPK ?? "40");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40;
}

function ragFusionTagTopk(): number {
  const n = Number(process.env.LOGICDOC_RAG_FUSION_TAG_TOPK ?? "30");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

function ragFusionKeywordTopk(): number {
  const n = Number(process.env.LOGICDOC_RAG_FUSION_KW_TOPK ?? "15");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 15;
}

function ragFusionTagBoost(): number {
  const n = Number(process.env.LOGICDOC_RAG_FUSION_TAG_BOOST ?? "0.15");
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.15));
}

function ragFusionRrfK(): number {
  const n = Number(process.env.LOGICDOC_RAG_FUSION_RRF_K ?? "60");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

// ─── RRF 融合 ───

/**
 * 应用层 RRF（Reciprocal Rank Fusion）。
 * 多通道结果按排名倒数加权求和，合并为统一排序。
 * RRF 基于排名而非绝对分值，天然对分值尺度不一致免疫。
 */
function rrfFuse(
  channels: ZvecHit[][],
  weights: number[],
  k: number
): ZvecHit[] {
  const scoreMap = new Map<string, { hit: ZvecHit; rrfScore: number }>();

  for (let ci = 0; ci < channels.length; ci++) {
    const channel = channels[ci];
    const w = weights[ci] ?? 1;
    for (let rank = 0; rank < channel.length; rank++) {
      const hit = channel[rank];
      const rrfContribution = w / (k + rank + 1);
      const existing = scoreMap.get(hit.id);
      if (existing) {
        existing.rrfScore += rrfContribution;
        // 保留更高向量分
        if ((hit.score ?? 0) > (existing.hit.score ?? 0)) {
          existing.hit = hit;
        }
      } else {
        scoreMap.set(hit.id, { hit, rrfScore: rrfContribution });
      }
    }
  }

  const fused = [...scoreMap.values()];
  fused.sort((a, b) => b.rrfScore - a.rrfScore);

  // 将 RRF 分回写到 score 字段
  return fused.map((item) => ({
    ...item.hit,
    score: item.rrfScore,
  }));
}

// ─── 标签软加权 ───

/**
 * 标签软加权：匹配分类标签的 chunk 获得额外加分，不匹配的不受惩罚。
 * 标签从"门控过滤"变为"加分信号"。
 */
function applyTagSoftBoost(
  rows: ZvecHit[],
  categoryTags: string[],
  boostFactor: number
): ZvecHit[] {
  if (boostFactor <= 0) return rows;
  const tagSet = new Set(categoryTags);

  return rows.map((r) => {
    const modules = parseBizModulesField(r.fields?.biz_modules);
    const hasMatch = modules.some((m) => tagSet.has(m));
    if (!hasMatch) return r;
    return { ...r, score: (r.score ?? 0) + boostFactor };
  });
}

// ─── 通用工具 ───

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function collectPalaceSnippetForCategory(
  category: AnalysisCategory,
  palaces:
    | Array<{
        name?: string;
        majorStars?: Array<{ name?: string }>;
      }>
    | undefined
): string {
  const want = new Set(MODULE_FOCUS_PALACES[category] ?? []);
  if (!want.size || !Array.isArray(palaces)) return "";
  const parts: string[] = [];
  for (const p of palaces) {
    const n = String(p?.name ?? "");
    if (!want.has(n)) continue;
    const stars = (p.majorStars ?? [])
      .map((m) => m.name)
      .filter(Boolean)
      .join("、");
    if (stars) parts.push(`${n}：${stars}`);
  }
  return parts.length ? `模块相关宫位星曜：${parts.join("；")}。` : "";
}

function collectPalaceNamesFromChart(
  palaces:
    | Array<{ name?: string }>
    | undefined
): string[] {
  if (!Array.isArray(palaces)) return [];
  return palaces
    .map((p) => String(p?.name ?? "").trim())
    .filter(Boolean);
}

/**
 * 构建 RAG 查询文本；在总长度上限内尽量保留用户原句与分类说明（下限约 200 字）。
 * @param extraEnhanceKeywords 额外的检索增强关键词（systag + AI 语义增强合并结果）
 */
export function buildRagQueryText(
  category: AnalysisCategory,
  categoryPrompt: string,
  astrolabeData: Record<string, unknown>,
  horoscopeData?: Record<string, unknown>,
  userSupplement?: string,
  extraEnhanceKeywords?: string
): string {
  const soul = String(astrolabeData.soul ?? "");
  const bodyStar = String(astrolabeData.body ?? "");
  const palaces = astrolabeData.palaces as
    | Array<{
        name?: string;
        majorStars?: Array<{ name?: string }>;
      }>
    | undefined;

  let mingStars = "";
  if (Array.isArray(palaces)) {
    const ming = palaces.find((p) => String(p?.name ?? "").includes("命"));
    if (ming?.majorStars?.length) {
      mingStars = ming.majorStars
        .map((m) => m.name)
        .filter(Boolean)
        .join("、");
    }
  }

  const horoSnippet =
    horoscopeData && typeof horoscopeData === "object" && !Array.isArray(horoscopeData)
      ? buildHoroscopeQuerySnippet(horoscopeData as Record<string, unknown>)
      : "";

  const extraRaw = userSupplement?.trim() ?? "";
  const extra = normalizeWhitespace(extraRaw).slice(0, 800);
  const palaceLine = collectPalaceSnippetForCategory(category, palaces);

  const taskFull = normalizeWhitespace(categoryPrompt);
  const taskMin = 200;
  const taskHead = taskFull.slice(0, 600);

  const parts: string[] = [];

  // 分类关键词增强：systag 关键词（外部传入）+ 硬编码兜底
  const enhance = extraEnhanceKeywords || CATEGORY_QUERY_ENHANCE[category] || "";
  if (enhance) {
    parts.push(`【检索主题：${enhance}】`);
  }

  if (extra) {
    parts.push(`用户特别想了解：${extra}`);
  }

  if (palaceLine) parts.push(palaceLine);

  // 针对特定分类增加紫微斗数专业背景信息，强化 embedding 语义
  if (category === "PARENT_CHILD" && palaces) {
    // 六亲宫位星曜组合，覆盖父母、子女、兄弟、夫妻
    const familyPalaces = [
      { keyword: "子女", label: "子女", desc: "命主与子女的关系" },
      { keyword: "父母", label: "父母", desc: "命主与父母的关系" },
      { keyword: "兄弟", label: "兄弟", desc: "命主与兄弟姐妹的关系" },
      { keyword: "夫妻", label: "夫妻", desc: "命主与配偶的夫妻关系" },
    ];
    for (const fp of familyPalaces) {
      const p = palaces.find((p) => String(p?.name ?? "").includes(fp.keyword));
      if (p?.majorStars?.length) {
        const stars = p.majorStars.map((m) => m.name).filter(Boolean).join("、");
        parts.push(`【紫微斗数六亲分析】${fp.label}宫${stars}，分析${fp.desc}。`);
      }
    }
  }

  if (mingStars) {
    parts.push(`请分析紫微斗数命盘中，命宫${mingStars}坐守的相关特征。`);
  }

  if (soul) {
    parts.push(`命主${soul}${bodyStar ? `，身主${bodyStar}` : ""}。`);
  }

  if (taskFull && taskFull !== extra) {
    parts.push(taskHead.length >= taskMin ? taskHead : taskFull.slice(0, Math.max(taskMin, 600)));
  }

  if (horoSnippet) {
    parts.push(`当前运限要点：${horoSnippet}`);
  }

  if (process.env.LOGICDOC_RAG_QUERY_REPEAT_USER === "1" && extra) {
    parts.push(`（再次强调用户关注点）${extra}`);
  }

  let joined = parts.join("\n");
  const max = 2500;
  if (joined.length > max) {
    const horoPart = horoSnippet ? `当前运限要点：${horoSnippet}` : "";
    let core = parts.filter((p) => !p.startsWith("当前运限要点：")).join("\n");
    if (core.length > max - 80) {
      core = core.slice(0, max - 120) + "…\n";
    }
    joined = (core + (horoPart ? `\n${horoPart}` : "")).slice(0, max);
  }
  return joined;
}

/** 多 query 变体：主 query + 命宫/任务 + 运限侧重（去重后各自 embedding） */
export function buildRagQueryVariants(
  category: AnalysisCategory,
  categoryPrompt: string,
  astrolabeData: Record<string, unknown>,
  horoscopeData?: Record<string, unknown>,
  userSupplement?: string,
  extraEnhanceKeywords?: string
): string[] {
  const main = buildRagQueryText(
    category,
    categoryPrompt,
    astrolabeData,
    horoscopeData,
    userSupplement,
    extraEnhanceKeywords
  );
  const palaces = astrolabeData.palaces as
    | Array<{ name?: string; majorStars?: Array<{ name?: string }> }>
    | undefined;
  let mingStars = "";
  if (Array.isArray(palaces)) {
    const ming = palaces.find((p) => String(p?.name ?? "").includes("命"));
    if (ming?.majorStars?.length) {
      mingStars = ming.majorStars
        .map((m) => m.name)
        .filter(Boolean)
        .join("、");
    }
  }
  const extra = normalizeWhitespace(userSupplement?.trim() ?? "").slice(0, 500);
  const task = normalizeWhitespace(categoryPrompt).slice(0, 400);
  const v2Parts = [
    extra ? `用户关注点：${extra}` : "",
    mingStars ? `命宫主星：${mingStars}` : "",
    task ? `解盘任务：${task}` : "",
  ].filter(Boolean);
  const v2 = v2Parts.join("\n").slice(0, 2000);

  const horoSnippet =
    horoscopeData && typeof horoscopeData === "object" && !Array.isArray(horoscopeData)
      ? buildHoroscopeQuerySnippet(horoscopeData as Record<string, unknown>)
      : "";
  const soul = String(astrolabeData.soul ?? "");
  const v3Parts = [
    horoSnippet ? `运限：${horoSnippet}` : "",
    soul ? `命主：${soul}` : "",
    task ? `任务摘要：${task.slice(0, 280)}` : "",
  ].filter(Boolean);
  const v3 = v3Parts.join("\n").slice(0, 2000);

  const out: string[] = [];
  for (const q of [main, v2, v3]) {
    const t = q.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function openReadCollection(
  family: EmbeddingDimensionFamily,
  pathStr: string
): ZVecCollection {
  ensureZvecInitialized();
  try {
    return ZVecOpen(pathStr, { readOnly: true });
  } catch {
    throw new LogicdocIndexMissingError();
  }
}

export type LogicdocHitDetail = {
  index: number;
  sourceFile: string;
  textLength: number;
  preview: string;
  score: number;
  bizModules: string[];
};

export type FilterStepRecord = {
  label: string;
  hitCount: number;
};

export type LogicdocRetrievalDetail = {
  knowledgeText: string;
  queryTexts: string[];
  meta: {
    hits: LogicdocHitDetail[];
    totalHits: number;
    totalChars: number;
    topk: number;
    truncated: boolean;
    filterSteps: FilterStepRecord[];
  };
};

type RetrievalOpts = {
  family: EmbeddingDimensionFamily;
  category: AnalysisCategory;
  astrolabeData: Record<string, unknown>;
  horoscopeData?: Record<string, unknown>;
  categoryPrompt: string;
  userSupplement?: string;
  topk?: number;
  maxChars?: number;
};

type ZvecHit = RerankableRow;

function parseBizModulesField(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    return v
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** 仅基础类标签（通用/always），排序时置后 */
function rowIsWeakBaseline(row: ZvecHit): boolean {
  const b = parseBizModulesField(row.fields?.biz_modules);
  if (!b.length) return true;
  return b.every((t) => t === "always" || t === "通用");
}

function applyMinScoreFilter(rows: ZvecHit[]): ZvecHit[] {
  const raw = process.env.LOGICDOC_RAG_MIN_SCORE?.trim();
  if (raw === undefined || raw === "") return rows;
  const min = Number(raw);
  if (!Number.isFinite(min)) return rows;
  return rows.filter((r) => (Number.isFinite(r.score) ? r.score : 0) >= min);
}

function mergeRowsPreferScore(primary: ZvecHit[], secondary: ZvecHit[]): ZvecHit[] {
  const map = new Map<string, ZvecHit>();
  for (const r of primary) {
    map.set(r.id, r);
  }
  for (const r of secondary) {
    const ex = map.get(r.id);
    if (!ex || r.score > ex.score) map.set(r.id, r);
  }
  return [...map.values()];
}

function sortWeakBaselineLast(rows: ZvecHit[]): ZvecHit[] {
  return [...rows].sort((a, b) => {
    const wa = rowIsWeakBaseline(a);
    const wb = rowIsWeakBaseline(b);
    if (wa !== wb) return wa ? 1 : -1;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

/** 源文件多样性控制：限制每个文件最多 maxPerFile 块，避免单文件霸占结果 */
function diversifyBySourceFile(rows: ZvecHit[], maxPerFile: number): ZvecHit[] {
  const fileCount = new Map<string, number>();
  return rows.filter((r) => {
    const file = String(r.fields?.source_file ?? "");
    const count = fileCount.get(file) ?? 0;
    if (count >= maxPerFile) return false;
    fileCount.set(file, count + 1);
    return true;
  });
}

function decodeChunkIndexFromId(sourceFile: string, id: string): number {
  const rel = `sysfiles/sysknowledge/${sourceFile}`;
  const max = 512;
  for (let i = 0; i < max; i++) {
    if (stableChunkId(rel, i) === id) return i;
  }
  return -1;
}

function appendNeighborChunks(
  col: ZVecCollection,
  rows: ZvecHit[],
  maxPerHit: number,
  maxCharsPerNeighbor: number
): ZvecHit[] {
  const seen = new Set(rows.map((r) => r.id));
  const extra: ZvecHit[] = [];
  for (const r of rows) {
    const file = String(r.fields?.source_file ?? "");
    if (!file) continue;
    const idx = decodeChunkIndexFromId(file, r.id);
    if (idx < 0) continue;
    const rel = `sysfiles/sysknowledge/${file}`;
    let added = 0;
    for (const delta of [-1, 1]) {
      if (added >= maxPerHit) break;
      const ni = idx + delta;
      if (ni < 0) continue;
      const nid = stableChunkId(rel, ni);
      if (seen.has(nid)) continue;
      const fetched = col.fetchSync(nid)[nid];
      if (!fetched?.fields?.text) continue;
      seen.add(nid);
      added += 1;
      let text = String(fetched.fields.text);
      if (text.length > maxCharsPerNeighbor) {
        text = text.slice(0, maxCharsPerNeighbor) + "…";
      }
      extra.push({
        id: nid,
        score: (r.score ?? 0) * 0.85,
        fields: {
          text: `[邻接上下文 ${delta > 0 ? "下" : "上"}一块]\n${text}`,
          source_file: file,
          biz_modules: fetched.fields.biz_modules,
        },
      });
    }
  }
  return [...rows, ...extra];
}

async function getOrEmbedQueryVector(
  cfg: Awaited<ReturnType<typeof getEmbeddingConfigForFamily>>,
  queryText: string,
  dimension: number
): Promise<number[]> {
  const cacheKey = getEmbeddingCacheKey(queryText, dimension);
  let vector = getCachedVector(cacheKey);
  if (vector) {
    if (process.env.LOGICDOC_RAG_DEBUG === "1") {
      console.log(`[logicdoc-rag] embedding 缓存命中 dim=${dimension}`);
    }
    return vector;
  }
  vector = await fetchEmbeddingVector(cfg, queryText, {
    expectedDimension: dimension,
    callRole: "query",
  });
  setCachedVector(cacheKey, vector);
  return vector;
}

function runVectorQuery(
  col: ZVecCollection,
  vector: number[],
  topk: number,
  filterExpr?: string
): ZvecHit[] {
  const q: Parameters<ZVecCollection["querySync"]>[0] = {
    fieldName: "embedding",
    vector,
    topk,
    outputFields: ["text", "source_file", "biz_modules"],
    params: { indexType: ZVecIndexType.HNSW, ef: 200 },
  };
  if (filterExpr) {
    (q as { filter: string }).filter = filterExpr;
  }
  const raw = col.querySync(q) as unknown as ZvecHit[];
  return Array.isArray(raw) ? raw : [];
}

/**
 * 融合检索：并行三路召回 + RRF 融合 + 标签软加权。
 * 将"先过滤后检索"改为"并行检索后融合"，标签从门控过滤变为加分信号。
 *
 * 通道 A：纯向量检索（无标签过滤）—— 兜底召回语义匹配但标签错/漏的内容
 * 通道 B：标签过滤向量检索 —— 精准召回标签匹配的内容
 * 通道 C：text like 关键词检索 —— 补回向量可能漏掉的精确匹配
 */
async function retrieveFusion(
  prisma: PrismaClient,
  opts: RetrievalOpts
): Promise<LogicdocRetrievalDetail> {
  const pathStr = getLogicdocCollectionPath(opts.family);
  const col = openReadCollection(opts.family, pathStr);
  const filterSteps: FilterStepRecord[] = [];

  try {
    const tags = ANALYSIS_CATEGORY_BIZ_TAGS[opts.category];
    const specificTags = tags.filter((t) => t !== "always" && t !== "通用");
    const strictBizFilter = attachMingPalaceFilter(
      buildBizModulesFilter(specificTags),
      opts.category
    );

    const cfg = await getEmbeddingConfigForFamily(prisma, opts.family);
    const dimension = embeddingCollectionDimension(opts.family);
    const topkFull = opts.topk ?? (Number(process.env.LOGICDOC_RAG_TOPK ?? "24") || 24);
    const palaces = opts.astrolabeData.palaces as
      | Array<{ name?: string }>
      | undefined;
    const palaceNames = collectPalaceNamesFromChart(palaces);

    // ── 查询增强关键词（systag + AI） ──
    let enhanceKeywords = "";
    const systagKw = await extractSystagKeywordsForCategory(specificTags);
    let aiKw = "";
    try {
      const modelConfig = await prisma.aIModelConfig.findFirst({ where: { isActive: true, isDefault: true } })
        ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });
      if (modelConfig) {
        const aiProvider = createProvider({
          id: modelConfig.id, name: modelConfig.name, provider: modelConfig.provider,
          apiKey: modelConfig.apiKeyEncrypted, baseUrl: modelConfig.baseUrl, modelId: modelConfig.modelId,
        });
        const palaceLine = collectPalaceSnippetForCategory(opts.category, palaces as Array<{ name?: string; majorStars?: Array<{ name?: string }> }> | undefined);
        aiKw = await generateQueryEnhanceKeywords(aiProvider, opts.category, opts.userSupplement ?? "", palaceLine);
      }
    } catch { /* AI 增强失败不阻塞 */ }
    if (systagKw || aiKw) {
      const merged = new Set<string>();
      for (const w of systagKw.split(/\s+/)) if (w) merged.add(w);
      for (const w of aiKw.split(/\s+/)) if (w) merged.add(w);
      enhanceKeywords = [...merged].join(" ");
    }

    // ── 构建查询变体 ──
    const queryTexts = ragMultiQuery()
      ? buildRagQueryVariants(opts.category, opts.categoryPrompt, opts.astrolabeData, opts.horoscopeData, opts.userSupplement, enhanceKeywords)
      : [buildRagQueryText(opts.category, opts.categoryPrompt, opts.astrolabeData, opts.horoscopeData, opts.userSupplement, enhanceKeywords)];

    // ── 获取配置 ──
    const vecTopk = ragFusionVectorTopk();
    const tagTopk = ragFusionTagTopk();
    const kwTopk = ragFusionKeywordTopk();
    const rrfK = ragFusionRrfK();
    const tagBoost = ragFusionTagBoost();

    // ── 通道 A：纯向量检索（无标签过滤）──
    let channelA: ZvecHit[] = [];
    for (const qt of queryTexts) {
      const vec = await getOrEmbedQueryVector(cfg, qt, dimension);
      const part = applyMinScoreFilter(runVectorQuery(col, vec, vecTopk));
      channelA = mergeRowsPreferScore(channelA, part);
    }
    channelA.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    channelA = channelA.slice(0, vecTopk);
    filterSteps.push({ label: "融合-纯向量通道", hitCount: channelA.length });

    // ── 通道 B：标签过滤向量检索 ──
    let channelB: ZvecHit[] = [];
    for (const qt of queryTexts) {
      const vec = await getOrEmbedQueryVector(cfg, qt, dimension);
      const part = applyMinScoreFilter(runVectorQuery(col, vec, tagTopk, strictBizFilter));
      channelB = mergeRowsPreferScore(channelB, part);
    }
    channelB.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    channelB = channelB.slice(0, tagTopk);
    filterSteps.push({ label: "融合-标签过滤通道", hitCount: channelB.length });

    // ── 通道 C：text like 关键词检索 ──
    const kwTerms = ragKeywordSupplement()
      ? extractKeywordSupplementTerms(opts.userSupplement, opts.categoryPrompt, palaceNames, opts.category)
      : [];
    let channelC: ZvecHit[] = [];
    if (kwTerms.length > 0) {
      const likeFilter = buildTextLikeOrFilter(kwTerms);
      if (likeFilter) {
        const mainVec = await getOrEmbedQueryVector(cfg, queryTexts[0] ?? "", dimension);
        channelC = applyMinScoreFilter(runVectorQuery(col, mainVec, kwTopk, likeFilter));
      }
    }
    filterSteps.push({ label: "融合-关键词通道", hitCount: channelC.length });

    // ── RRF 融合（权重：向量 1.0, 标签 0.8, 关键词 0.6）──
    const fused = rrfFuse([channelA, channelB, channelC], [1.0, 0.8, 0.6], rrfK);
    filterSteps.push({ label: "RRF 融合后", hitCount: fused.length });

    // ── 标签软加权 ──
    let rows = applyTagSoftBoost(fused, specificTags, tagBoost);

    // ── 词面重排（复用现有） ──
    const primaryQueryText = queryTexts[0] ?? "";
    rows = rerankRowsByLexical(rows, primaryQueryText, ragLexicalWeight());
    rows = rows.slice(0, topkFull * 2);

    // ── 后处理（复用现有） ──
    const uniqueFiles = new Set(rows.map((r) => String(r.fields?.source_file ?? "")));
    if (uniqueFiles.size > 1) {
      rows = diversifyBySourceFile(rows, Math.max(3, Math.ceil(topkFull / uniqueFiles.size)));
    }
    rows = rows.slice(0, topkFull);
    rows = sortWeakBaselineLast(rows);

    if (ragNeighborChunks()) {
      const maxN = Number(process.env.LOGICDOC_RAG_NEIGHBOR_MAX_CHARS ?? "450") || 450;
      rows = appendNeighborChunks(col, rows, 1, maxN);
      rows = rows.slice(0, topkFull + 6);
    }

    // ── 输出格式化 ──
    const emptyKnowledge =
      "（向量库无匹配片段：① 请确认 sysfiles/sysknowledge/ 下有 .md/.docx 且已成功索引；" +
      "② 请至少配置同维度的 embedding 并成功索引。）";

    if (!rows.length) {
      return { knowledgeText: emptyKnowledge, queryTexts, meta: { hits: [], totalHits: 0, totalChars: 0, topk: topkFull, truncated: false, filterSteps } };
    }

    const hits: LogicdocHitDetail[] = rows.map((r, i) => ({
      index: i + 1,
      sourceFile: String(r.fields?.source_file ?? ""),
      textLength: String(r.fields?.text ?? "").length,
      preview: String(r.fields?.text ?? "").slice(0, 200),
      score: Number.isFinite(r.score) ? r.score : 0,
      bizModules: parseBizModulesField(r.fields?.biz_modules),
    }));

    let joined = rows
      .map((r, i) => `### 片段${i + 1}（${String(r.fields?.source_file ?? "")}）\n${String(r.fields?.text ?? "")}`)
      .join("\n\n---\n\n");

    const max = opts.maxChars ?? (Number(process.env.LOGICDOC_RAG_MAX_CHARS ?? "14000") || 14000);
    const truncated = joined.length > max;
    if (truncated) {
      joined = joined.slice(0, max) + `\n\n[…… RAG 检索结果已按 LOGICDOC_RAG_MAX_CHARS=${max} 截断]`;
    }

    if (process.env.LOGICDOC_RAG_DEBUG === "1") {
      console.log(
        `[logicdoc-rag-fusion] category=${opts.category} topk=${topkFull} steps=` +
          filterSteps.map((s) => `${s.label}:${s.hitCount}`).join("|")
      );
    }

    return { knowledgeText: joined, queryTexts, meta: { hits, totalHits: rows.length, totalChars: joined.length, topk: topkFull, truncated, filterSteps } };
  } finally {
    col.closeSync();
  }
}

/**
 * 详细版 RAG 检索：过滤链、可选 multi-query、always 池合并、关键词补充、邻块、词面重排。
 */
export async function retrieveLogicdocForAnalysisDetailed(
  prisma: PrismaClient,
  opts: RetrievalOpts
): Promise<LogicdocRetrievalDetail> {
  // 融合检索模式：并行三路召回 + RRF + 标签软加权
  if (ragRetrievalMode() === "fusion") {
    return retrieveFusion(prisma, opts);
  }
  // 以下是原有 legacy 流程
  const pathStr = getLogicdocCollectionPath(opts.family);
  const col = openReadCollection(opts.family, pathStr);
  const filterSteps: FilterStepRecord[] = [];

  try {
    const tags = ANALYSIS_CATEGORY_BIZ_TAGS[opts.category];
    const specificTags = tags.filter((t) => t !== "always" && t !== "通用");
    const strictBizFilter = attachMingPalaceFilter(
      buildBizModulesFilter(specificTags),
      opts.category
    );
    // 全量标签过滤（含 always/通用），用于补充池和降级
    const fullBizFilter = attachMingPalaceFilter(
      buildBizModulesFilter(tags),
      opts.category
    );

    const cfg = await getEmbeddingConfigForFamily(prisma, opts.family);
    const dimension = embeddingCollectionDimension(opts.family);
    const topkFull = opts.topk ?? (Number(process.env.LOGICDOC_RAG_TOPK ?? "24") || 24);
    const strictOn = process.env.LOGICDOC_RAG_STRICT_BIZ_FILTER === "1";
    const relaxMin = ragRelaxMinHits();
    const palaces = opts.astrolabeData.palaces as
      | Array<{ name?: string }>
      | undefined;
    const palaceNames = collectPalaceNamesFromChart(palaces);

    // ── 检索关键词增强：systag 关键词 + AI 语义增强 ──
    let enhanceKeywords = "";

    // 1. systag 关键词提取（零成本）
    const systagKw = await extractSystagKeywordsForCategory(specificTags);

    // 2. AI 语义增强（轻量调用，有缓存）
    let aiKw = "";
    try {
      const modelConfig = await prisma.aIModelConfig.findFirst({ where: { isActive: true, isDefault: true } })
        ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });
      if (modelConfig) {
        const aiProvider = createProvider({
          id: modelConfig.id,
          name: modelConfig.name,
          provider: modelConfig.provider,
          apiKey: modelConfig.apiKeyEncrypted,
          baseUrl: modelConfig.baseUrl,
          modelId: modelConfig.modelId,
        });
        const palaceLine = collectPalaceSnippetForCategory(opts.category, palaces as Array<{ name?: string; majorStars?: Array<{ name?: string }> }> | undefined);
        aiKw = await generateQueryEnhanceKeywords(aiProvider, opts.category, opts.userSupplement ?? "", palaceLine);
      }
    } catch {
      // AI 增强失败不阻塞
    }

    // 3. 合并去重：以硬编码基础词优先，systag/AI 作为补充，总上限 50
    const baseKw = CATEGORY_QUERY_ENHANCE[opts.category] || "";
    const MAX_ENHANCE_KW = 50;
    if (baseKw || systagKw || aiKw) {
      const merged: string[] = [];
      const seen = new Set<string>();
      // 硬编码基础词优先（保证核心词一定在）
      for (const w of baseKw.split(/\s+/)) {
        if (w && !seen.has(w)) { seen.add(w); merged.push(w); }
      }
      // systag 补充词
      for (const w of systagKw.split(/\s+/)) {
        if (w && !seen.has(w) && merged.length < MAX_ENHANCE_KW) { seen.add(w); merged.push(w); }
      }
      // AI 增强词
      for (const w of aiKw.split(/\s+/)) {
        if (w && !seen.has(w) && merged.length < MAX_ENHANCE_KW) { seen.add(w); merged.push(w); }
      }
      enhanceKeywords = merged.join(" ");
    }

    const queryTexts = ragMultiQuery()
      ? buildRagQueryVariants(
          opts.category,
          opts.categoryPrompt,
          opts.astrolabeData,
          opts.horoscopeData,
          opts.userSupplement,
          enhanceKeywords
        )
      : [
          buildRagQueryText(
            opts.category,
            opts.categoryPrompt,
            opts.astrolabeData,
            opts.horoscopeData,
            opts.userSupplement,
            enhanceKeywords
          ),
        ];

    const subTopk = ragMultiQuery()
      ? Math.max(10, Math.ceil(topkFull * 0.7))
      : topkFull;

    // 第一轮：只用分类专有标签过滤（排除 always/通用），优先召回主题匹配块
    let merged: ZvecHit[] = [];
    for (const qt of queryTexts) {
      const vec = await getOrEmbedQueryVector(cfg, qt, dimension);
      const part = applyMinScoreFilter(
        runVectorQuery(col, vec, subTopk, strictBizFilter)
      );
      merged = mergeRowsPreferScore(merged, part);
    }

    merged = applyMinScoreFilter(merged);
    merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    merged = merged.slice(0, Math.max(topkFull * 2, 24));
    filterSteps.push({
      label: ragMultiQuery() ? "严格 biz（multi-query 合并）" : "严格 biz 过滤",
      hitCount: merged.length,
    });

    let rows = merged;

    if (ragRelaxAlwaysPool() && rows.length > 0) {
      const poolK = Math.min(8, Math.max(4, Math.ceil(topkFull / 2)));
      const mainVec = await getOrEmbedQueryVector(
        cfg,
        queryTexts[0] ?? "",
        dimension
      );
      const alwaysFilter = attachMingPalaceFilter(
        buildBizModulesFilter(["always", "通用"]),
        opts.category
      );
      const poolRows = applyMinScoreFilter(
        runVectorQuery(col, mainVec, poolK, alwaysFilter)
      );
      const before = rows.length;
      rows = mergeRowsPreferScore(rows, poolRows);
      rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      rows = rows.slice(0, Math.max(topkFull * 2, 24));
      filterSteps.push({
        label: "合并 always/通用 补充池",
        hitCount: poolRows.length,
      });
      if (process.env.LOGICDOC_RAG_DEBUG === "1") {
        console.log(
          `[logicdoc-rag] always 池合并: 主命中 ${before} → 合并后 ${rows.length}`
        );
      }
    }

    if (rows.length < relaxMin && !strictOn) {
      const mainVec = await getOrEmbedQueryVector(
        cfg,
        queryTexts[0] ?? "",
        dimension
      );
      const broad = attachMingPalaceFilter(
        buildBizModulesFilter(["always", "通用"]),
        opts.category
      );
      const broadRows = applyMinScoreFilter(
        runVectorQuery(col, mainVec, topkFull, broad)
      );
      filterSteps.push({ label: "宽泛 biz（通用+always）", hitCount: broadRows.length });
      if (broadRows.length > rows.length) {
        rows = broadRows;
      }
    }

    if (rows.length < relaxMin && !strictOn && process.env.LOGICDOC_RAG_FILTER_MING === "1") {
      const mainVec = await getOrEmbedQueryVector(
        cfg,
        queryTexts[0] ?? "",
        dimension
      );
      const bizOnly = runVectorQuery(
        col,
        mainVec,
        topkFull,
        buildBizModulesFilter(tags)
      );
      filterSteps.push({
        label: "仅 biz 过滤（去 ming）",
        hitCount: bizOnly.length,
      });
      if (bizOnly.length > rows.length) rows = applyMinScoreFilter(bizOnly);
    }

    if (rows.length < relaxMin && !strictOn && ragAllowNoFilter()) {
      const mainVec = await getOrEmbedQueryVector(
        cfg,
        queryTexts[0] ?? "",
        dimension
      );
      rows = applyMinScoreFilter(runVectorQuery(col, mainVec, topkFull));
      filterSteps.push({ label: "无标量过滤", hitCount: rows.length });
    }

    const kwTerms = ragKeywordSupplement()
      ? extractKeywordSupplementTerms(
          opts.userSupplement,
          opts.categoryPrompt,
          palaceNames,
          opts.category
        )
      : [];
    const likeFilter = buildTextLikeOrFilter(kwTerms);
    if (likeFilter && kwTerms.length && !strictOn) {
      try {
        const mainVec = await getOrEmbedQueryVector(
          cfg,
          queryTexts[0] ?? "",
          dimension
        );
        const combinedFilter = `(${strictBizFilter}) and ${likeFilter}`;
        const kwRows = runVectorQuery(
          col,
          mainVec,
          Math.min(10, topkFull),
          combinedFilter
        );
        filterSteps.push({
          label: "关键词 text like 补充",
          hitCount: kwRows.length,
        });
        rows = mergeRowsPreferScore(rows, applyMinScoreFilter(kwRows));
        rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        rows = rows.slice(0, topkFull * 2);
      } catch (e) {
        console.warn("[logicdoc-rag] 关键词补充检索跳过:", e);
      }
    }

    rows = rows.slice(0, Math.min(rows.length, topkFull * 3));

    const primaryQueryText =
      queryTexts[0] ??
      buildRagQueryText(
        opts.category,
        opts.categoryPrompt,
        opts.astrolabeData,
        opts.horoscopeData,
        opts.userSupplement
      );
    rows = rerankRowsByLexical(rows, primaryQueryText, ragLexicalWeight());
    rows = rows.slice(0, topkFull * 2);
    /** 源文件多样性：限制每个文件最多 maxPerFile 块，避免单文件霸占结果；
     *  当源文件数 <=1 时跳过，否则最多取 ceil(topk/文件数) */
    const uniqueFiles = new Set(rows.map((r) => String(r.fields?.source_file ?? "")));
    if (uniqueFiles.size > 1) {
      rows = diversifyBySourceFile(rows, Math.max(3, Math.ceil(topkFull / uniqueFiles.size)));
    }
    rows = rows.slice(0, topkFull);
    /** 先截断再置底 always/通用，避免弱基线块在向量序中本可进 TopK 却被整池后移挤出 */
    rows = sortWeakBaselineLast(rows);

    if (ragNeighborChunks()) {
      const maxN = Number(process.env.LOGICDOC_RAG_NEIGHBOR_MAX_CHARS ?? "450") || 450;
      rows = appendNeighborChunks(col, rows, 1, maxN);
      rows = rows.slice(0, topkFull + 6);
    }

    const emptyKnowledge =
      "（向量库无匹配片段：① 请确认 `sysfiles/sysknowledge/` 下有 .md/.docx 且已在后台或执行 `npm run sysknowledge:index-zvec` 成功完成重建；" +
      "② 若只使用 1536 或只使用 1024 维对话模型，请至少配置**同维度**的 embedding 并成功索引；" +
      "③ 若设置了 LOGICDOC_RAG_FILTER_MING=1，感情类模块需条文含命宫/夫妻宫等宫位词，或暂时关闭该变量后重建。）";

    if (!rows.length) {
      return {
        knowledgeText: emptyKnowledge,
        queryTexts,
        meta: {
          hits: [],
          totalHits: 0,
          totalChars: 0,
          topk: topkFull,
          truncated: false,
          filterSteps,
        },
      };
    }

    if (process.env.LOGICDOC_RAG_DEBUG === "1") {
      console.log(
        `[logicdoc-rag] category=${opts.category} topk=${topkFull} steps=` +
          filterSteps.map((s) => `${s.label}:${s.hitCount}`).join("|")
      );
    }

    const hits: LogicdocHitDetail[] = rows.map((r, i) => {
      const text = String(r.fields?.text ?? "");
      const sourceFile = String(r.fields?.source_file ?? "");
      return {
        index: i + 1,
        sourceFile,
        textLength: text.length,
        preview: text.slice(0, 200),
        score: Number.isFinite(r.score) ? r.score : 0,
        bizModules: parseBizModulesField(r.fields?.biz_modules),
      };
    });

    let joined = rows
      .map(
        (r, i) =>
          `### 片段${i + 1}（${String(r.fields?.source_file ?? "")}）\n${String(r.fields?.text ?? "")}`
      )
      .join("\n\n---\n\n");

    const max =
      opts.maxChars ?? (Number(process.env.LOGICDOC_RAG_MAX_CHARS ?? "14000") || 14000);
    const truncated = joined.length > max;
    if (truncated) {
      joined =
        joined.slice(0, max) +
        `\n\n[…… RAG 检索结果已按 LOGICDOC_RAG_MAX_CHARS=${max} 截断]`;
    }

    return {
      knowledgeText: joined,
      queryTexts,
      meta: {
        hits,
        totalHits: rows.length,
        totalChars: joined.length,
        topk: topkFull,
        truncated,
        filterSteps,
      },
    };
  } finally {
    col.closeSync();
  }
}

export async function retrieveLogicdocForAnalysis(
  prisma: PrismaClient,
  opts: {
    family: EmbeddingDimensionFamily;
    category: AnalysisCategory;
    astrolabeData: Record<string, unknown>;
    horoscopeData?: Record<string, unknown>;
    categoryPrompt: string;
    userSupplement?: string;
  }
): Promise<string> {
  const detail = await retrieveLogicdocForAnalysisDetailed(prisma, opts);
  return detail.knowledgeText;
}

export async function retrieveLogicdocQueryTexts(
  prisma: PrismaClient,
  opts: {
    family: EmbeddingDimensionFamily;
    category: AnalysisCategory;
    astrolabeData: Record<string, unknown>;
    horoscopeData?: Record<string, unknown>;
    categoryPrompt: string;
    userSupplement?: string;
  }
): Promise<string[]> {
  const detail = await retrieveLogicdocForAnalysisDetailed(prisma, opts);
  return detail.queryTexts;
}

const CHAT_KEYWORD_TO_CATEGORY: Array<{ keywords: string[]; category: AnalysisCategory }> = [
  { keywords: ["性格", "人格", "为人", "特点", "脾气", "行为模式"], category: "PERSONALITY" },
  { keywords: ["运势", "运程", "运气", "流年", "大限", "走限", "十年", "年运"], category: "FORTUNE" },
  { keywords: ["感情", "婚姻", "恋爱", "桃花", "对象", "另一半", "老公", "老婆", "配偶", "复合", "分手", "离婚"], category: "EMOTION" },
  { keywords: ["亲子", "孩子", "子女", "父母", "家庭", "婆媳", "教育"], category: "PARENT_CHILD" },
  { keywords: ["事业", "工作", "职业", "升职", "升官", "升迁", "跳槽", "创业", "职场", "合作"], category: "CAREER" },
  { keywords: ["财运", "赚钱", "投资", "理财", "财富", "收入", "正财", "偏财"], category: "CAREER" },
  { keywords: ["学业", "考试", "升学", "读书", "成绩", "考研", "考公"], category: "FORTUNE" },
  { keywords: ["健康", "身体", "疾病", "养生", "体检"], category: "HEALTH" },
  { keywords: ["名声", "名气", "声誉", "口碑", "影响力"], category: "FORTUNE" },
];

export function inferAnalysisCategory(question: string): AnalysisCategory {
  const q = question.toLowerCase();
  for (const mapping of CHAT_KEYWORD_TO_CATEGORY) {
    if (mapping.keywords.some((kw) => q.includes(kw))) {
      return mapping.category;
    }
  }
  return "PERSONALITY";
}

export async function retrieveLogicdocForChat(
  prisma: PrismaClient,
  opts: {
    family: EmbeddingDimensionFamily;
    userQuestion: string;
    astrolabeData: Record<string, unknown>;
    horoscopeData?: Record<string, unknown>;
  }
): Promise<string> {
  const category = inferAnalysisCategory(opts.userQuestion);
  console.log(`[logicdoc] 对话向量检索，推断分类: ${category}，问题: ${opts.userQuestion.slice(0, 60)}`);

  const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
    family: opts.family,
    category,
    astrolabeData: opts.astrolabeData,
    horoscopeData: opts.horoscopeData,
    categoryPrompt: opts.userQuestion.slice(0, 900),
    userSupplement: opts.userQuestion.trim(),
    topk: 8,
    maxChars: 8000,
  });

  console.log(
    `[logicdoc] 对话检索完成: ${detail.meta.totalHits} 条命中, ${detail.meta.totalChars} 字, ` +
      `过滤链: ${detail.meta.filterSteps.map((s) => `${s.label}(${s.hitCount})`).join(" → ")}`
  );

  return detail.knowledgeText;
}
