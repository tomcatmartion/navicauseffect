import type { EmbeddingDimensionFamily } from "./constants";

/**
 * 与后台「AI 模型」provider 对齐，选用对应 Zvec collection + Embedding 配置。
 *
 * - **1024**：智谱 GLM、DeepSeek、通义千问、豆包（及火山引擎等同类）
 * - **1536**：MiniMax、OpenAI/GPT、Google（Gemini/Gemma 等）、Claude、以及未列入 1024 的其它厂商
 */
export function getEmbeddingFamilyForProvider(provider: string): EmbeddingDimensionFamily {
  const p = provider.trim().toLowerCase();

  const dim1024 = new Set([
    "zhipu",
    "deepseek",
    "qwen",
    "doubao",
    "volcengine",
    "ark", // 火山方舟等豆包系常见 id
    "moonshot",
    "baichuan",
  ]);

  if (dim1024.has(p)) return "1024";

  /* MiniMax / OpenAI(GPT) / Google(Gemini·Gemma) / Claude 等 → 1536；未知 id 默认 1536，避免误配 1024 */
  return "1536";
}
