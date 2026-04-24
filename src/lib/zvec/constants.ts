/** 与块内 payload 一致；变更后需全量重建索引 */
export const LOGICDOC_ZVEC_INDEX_VERSION = "sysknowledge-v3";

export const EMBEDDING_CONFIG_KEY_1536 = "embedding_config_dim1536";
export const EMBEDDING_CONFIG_KEY_1024 = "embedding_config_dim1024";

export type EmbeddingDimensionFamily = "1536" | "1024";

/** 与 Zvec sysknowledge collection 的向量维度一致 */
export function embeddingCollectionDimension(
  family: EmbeddingDimensionFamily
): 1536 | 1024 {
  return family === "1536" ? 1536 : 1024;
}
