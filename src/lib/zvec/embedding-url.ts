/**
 * Base URL 应为 OpenAI 兼容根路径（如 https://api.openai.com/v1），
 * 实际请求会 POST 到 .../embeddings。若用户已填完整 .../v1/embeddings 则不再重复拼接。
 */
export function buildEmbeddingsRequestUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "/embeddings";
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("/embeddings")) return trimmed;
  return `${trimmed}/embeddings`;
}
