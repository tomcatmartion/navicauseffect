import type { EmbeddingRuntimeConfig } from "./embedding-config";
import { enrichOpenAiStyleEmbeddingErrorMessage } from "./embedding-errors";
import {
  buildEmbeddingPostBody,
  type EmbeddingCallRole,
} from "./embedding-request-format";
import { buildEmbeddingsRequestUrl } from "./embedding-url";
import {
  extractEmbeddingVectorFromJson,
  summarizeEmbeddingResponseShape,
  throwIfEmbeddingBaseRespError,
} from "./parse-embedding-response";

interface OpenAiEmbeddingErrorBody {
  error?: { message?: string };
}

function embeddingFetchTimeoutMs(): number {
  const n = Number(process.env.EMBEDDING_FETCH_TIMEOUT_MS ?? "120000");
  return Number.isFinite(n) && n > 0 ? n : 120000;
}

export type FetchEmbeddingOptions = {
  /** 与 Zvec collection 一致时必须校验，避免「有向量但维度错」静默损坏检索 */
  expectedDimension?: number;
  /**
   * MiniMax：`document`→type=db（索引入库），`query`→type=query（RAG 检索句）。
   * 其它厂商忽略。
   */
  callRole?: EmbeddingCallRole;
};

export async function fetchEmbeddingVector(
  cfg: EmbeddingRuntimeConfig,
  input: string,
  opts?: FetchEmbeddingOptions
): Promise<number[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Embedding 输入文本为空，无法请求向量。");
  }

  const url = buildEmbeddingsRequestUrl(cfg.baseUrl);
  const role: EmbeddingCallRole = opts?.callRole ?? "document";
  const body = buildEmbeddingPostBody(cfg, trimmed, role, opts?.expectedDimension);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(embeddingFetchTimeoutMs()),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error(
        `Embedding 请求超时（${embeddingFetchTimeoutMs()}ms）。请检查 Base URL 是否可达，或增大环境变量 EMBEDDING_FETCH_TIMEOUT_MS。`
      );
    }
    throw e;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    throwIfEmbeddingBaseRespError(json);
    const errBody = json as OpenAiEmbeddingErrorBody;
    const raw = errBody?.error?.message ?? res.statusText;
    const msg = enrichOpenAiStyleEmbeddingErrorMessage(raw);
    throw new Error(`Embedding 请求失败 (${res.status}): ${msg}`);
  }

  throwIfEmbeddingBaseRespError(json);

  const vec = extractEmbeddingVectorFromJson(json);
  if (!vec?.length) {
    const hint = summarizeEmbeddingResponseShape(json);
    throw new Error(
      `Embedding 响应中无可用向量数据（${hint}）。请检查 Base URL 是否指向 …/v1 等根路径、` +
        `Model ID 是否为 embedding 模型，以及厂商是否要求其它请求字段。`
    );
  }

  if (
    opts?.expectedDimension != null &&
    vec.length !== opts.expectedDimension
  ) {
    throw new Error(
      `Embedding 返回维度为 ${vec.length}，本系统 ${opts.expectedDimension} 维 Zvec 集合要求严格一致。` +
        `请在后台更换对应维度的 embedding 模型，或修改集合维度后全量重建索引。`
    );
  }

  return vec;
}
