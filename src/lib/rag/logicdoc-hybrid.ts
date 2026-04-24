/**
 * Zvec 标量过滤：关键词 OR（text like），与向量检索结果并集去重。
 * 依赖 Zvec 支持的 `text like '%…%'` 语法（已在本机 querySync 验证）。
 */

import { PALACE_NAMES, STAR_NAMES } from "@/lib/logicdoc/chunk-metadata";

/** 分类特定补充关键词，增强 text like 补充检索的分类聚焦能力 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  HEALTH: ["健康", "疾厄", "身体", "疾病", "养生", "体质", "疾厄宫", "福德宫", "命宫", "凶限", "凶格"],
  PARENT_CHILD: ["亲子", "子女", "父母", "家庭", "教育", "子女宫", "父母宫", "入卦", "互动", "太岁"],
  MARRIAGE: ["感情", "婚姻", "夫妻", "恋爱", "配偶", "桃花", "夫妻宫", "入卦", "互动", "红鸾", "天喜"],
  EMOTION: ["感情", "恋爱", "婚姻", "夫妻宫", "桃花", "对象", "另一半", "入卦", "互动"],
};

function escapeLikeLiteral(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

/**
 * 从用户补充、分类说明、命盘宫位名中抽取少量关键词用于 text like 补充检索。
 */
export function extractKeywordSupplementTerms(
  userSupplement: string | undefined,
  categoryPrompt: string,
  palaceNamesFromChart: string[],
  category?: string
): string[] {
  const out = new Set<string>();
  const scan = (s: string) => {
    const t = s.trim();
    if (!t) return;
    for (const star of STAR_NAMES) {
      if (t.includes(star)) out.add(star);
    }
    for (const p of PALACE_NAMES) {
      if (t.includes(p)) out.add(p);
    }
  };
  scan(userSupplement ?? "");
  scan(categoryPrompt);
  for (const p of palaceNamesFromChart) scan(p);

  // 加入分类特定关键词
  if (category && CATEGORY_KEYWORDS[category]) {
    for (const kw of CATEGORY_KEYWORDS[category]) {
      out.add(kw);
    }
  }

  /** 去掉过短词，控制 filter 长度 */
  return [...out].filter((k) => k.length >= 2).slice(0, 12);
}

/**
 * 构造 `(text like '%a%' or text like '%b%')`，无词时返回空串。
 */
export function buildTextLikeOrFilter(terms: string[]): string {
  if (!terms.length) return "";
  const parts = terms.map(
    (t) => `text like '%${escapeLikeLiteral(t)}%'`
  );
  return `(${parts.join(" or ")})`;
}
