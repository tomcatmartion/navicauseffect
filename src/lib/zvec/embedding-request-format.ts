import type { EmbeddingRuntimeConfig } from "./embedding-config";

/** MiniMax 文档：建库/入库用 db，检索 query 用 query */
export type EmbeddingCallRole = "document" | "query";

/**
 * MiniMax 原生 Embedding 使用 `texts` + `type`，与 OpenAI 的 `input` 不同。
 * 可通过 `EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY=1` 强制走 OpenAI 形态（经网关转义时用）。
 */
/** 是否按 MiniMax 原生协议发 texts+type（函数名避免 use 前缀以免误触 react-hooks 规则） */
export function isMinimaxEmbeddingBaseUrl(baseUrl: string): boolean {
  if (process.env.EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY === "1") {
    return false;
  }
  return /minimax|minimaxi\.com/i.test(baseUrl);
}

export function buildEmbeddingPostBody(
  cfg: EmbeddingRuntimeConfig,
  input: string,
  role: EmbeddingCallRole,
  targetDimension?: number
): Record<string, unknown> {
  if (isMinimaxEmbeddingBaseUrl(cfg.baseUrl)) {
    const body: Record<string, unknown> = {
      model: cfg.modelId,
      texts: [input],
      type: role === "query" ? "query" : "db",
    };
    const gid =
      cfg.groupId?.trim() || process.env.EMBEDDING_MINIMAX_GROUP_ID?.trim();
    if (gid) {
      body.group_id = gid;
    }
    return body;
  }

  const body: Record<string, unknown> = {
    model: cfg.modelId,
    input,
  };
  if (process.env.EMBEDDING_OMIT_ENCODING_FORMAT !== "1") {
    body.encoding_format = "float";
  }
  // 智谱 embedding-3 等支持 dimensions 参数控制输出维度
  if (targetDimension) {
    body.dimensions = targetDimension;
  }
  return body;
}
