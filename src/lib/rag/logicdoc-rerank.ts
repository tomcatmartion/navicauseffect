/**
 * 轻量词面重合打分 + 与向量分合并排序（不调用外网模型）。
 */

/** 从中文与常见符号中抽「可匹配片段」：长度>=2 的子串及整词 */
function extractQueryTerms(query: string, maxTerms: number): string[] {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q) return [];
  const terms = new Set<string>();
  /** 连续中文、数字、字母串 */
  const re = /[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q)) !== null) {
    terms.add(m[0]);
    if (terms.size >= maxTerms) break;
  }
  return [...terms];
}

/**
 * 词面分：query 中若干 term 在 chunk 中的命中比例（0~1）。
 */
export function lexicalOverlapScore(query: string, chunkText: string): number {
  const terms = extractQueryTerms(query, 48);
  if (!terms.length) return 0;
  let hit = 0;
  for (const t of terms) {
    if (chunkText.includes(t)) hit += 1;
  }
  return hit / terms.length;
}

export type RerankableRow = {
  id: string;
  score: number;
  fields?: {
    text?: unknown;
    source_file?: unknown;
    biz_modules?: unknown;
  };
};

/**
 * 合并向量相似度（Zvec score，越高越好）与词面分，降序排序。
 * @param lexicalWeight 0~1，越大越看重词面
 */
export function rerankRowsByLexical(
  rows: RerankableRow[],
  queryText: string,
  lexicalWeight: number
): RerankableRow[] {
  const w = Math.min(1, Math.max(0, lexicalWeight));
  const scored = rows.map((r) => {
    const text = String(r.fields?.text ?? "");
    const lex = lexicalOverlapScore(queryText, text);
    const vec = Number.isFinite(r.score) ? r.score : 0;
    const combined = (1 - w) * vec + w * lex;
    return { r, combined };
  });
  scored.sort((a, b) => b.combined - a.combined);
  return scored.map((s) => s.r);
}
