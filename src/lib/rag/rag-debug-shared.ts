/** sessionStorage key */
export const RAG_DEBUG_STORAGE_KEY = "rag_debug_context";

/** 从 context 端点返回的完整数据 */
export type RagDebugStoredData = {
  contextId: string;
  /** 实际发给向量库的检索词（可能有多条，multi-query 时） */
  queryTexts: string[];
  promptMessages: { role: string; content: string }[];
  ragMeta: {
    knowledgeLength: number;
    topk: number;
    truncated: boolean;
    filterSteps: { label: string; hitCount: number }[];
    hits: { index: number; sourceFile: string; textLength: number; preview: string }[];
    totalHits: number;
    provider: string;
    modelId: string;
  } | null;
  category: string;
  categoryLabel: string;
};
