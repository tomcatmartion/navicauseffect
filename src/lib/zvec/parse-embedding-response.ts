import { enrichEmbeddingBusinessMessage } from "./embedding-errors";

/**
 * 从各厂商 OpenAI 兼容或近似 JSON 中提取 float 向量。
 * 部分服务在默认 encoding 下返回 base64，此处一并尝试解码。
 */

function isNumberArray(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

/** OpenAI base64 embedding：float32 little-endian */
function decodeBase64Float32Vector(b64: string): number[] | null {
  try {
    const buf = Buffer.from(b64.trim(), "base64");
    if (buf.length < 4 || buf.length % 4 !== 0) return null;
    const floats = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.length / 4
    );
    return Array.from(floats);
  } catch {
    return null;
  }
}

function pickFromItem(item: unknown): number[] | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const emb = o.embedding;
  if (isNumberArray(emb)) return emb;
  if (typeof emb === "string") return decodeBase64Float32Vector(emb);
  return null;
}

/**
 * 自响应 JSON 中提取第一条 embedding；无法解析时返回 null。
 */
export function extractEmbeddingVectorFromJson(json: unknown): number[] | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;

  // 少数接口顶层单数组字段名 vector
  if (isNumberArray(j.vector)) return j.vector;

  // MiniMax 等：{ vectors: number[][], base_resp: { status_code: 0 } }
  const vectors = j.vectors;
  if (Array.isArray(vectors) && vectors.length > 0) {
    const first = vectors[0];
    if (isNumberArray(first)) return first;
    if (typeof first === "string") {
      const dec = decodeBase64Float32Vector(first);
      if (dec) return dec;
    }
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const o = first as Record<string, unknown>;
      for (const key of ["embedding", "vector", "values"] as const) {
        const v = o[key];
        if (isNumberArray(v)) return v;
        if (typeof v === "string") {
          const dec = decodeBase64Float32Vector(v);
          if (dec) return dec;
        }
      }
    }
  }

  // OpenAI: { data: [{ embedding: number[] }] }
  const data = j.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const v = pickFromItem(item);
      if (v) return v;
    }
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    const v = pickFromItem(data);
    if (v) return v;
  }

  // 顶层 { embedding: [...] }
  if (isNumberArray(j.embedding)) return j.embedding;
  if (typeof j.embedding === "string") {
    const v = decodeBase64Float32Vector(j.embedding);
    if (v) return v;
  }

  // 通义 / 部分网关: { output: { embeddings: [{ embedding }] } }
  const output = j.output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const out = output as Record<string, unknown>;
    const embs = out.embeddings;
    if (Array.isArray(embs)) {
      for (const item of embs) {
        const v = pickFromItem(item);
        if (v) return v;
      }
    }
    const v = pickFromItem(out);
    if (v) return v;
  }

  // result / payload 包裹
  for (const key of ["result", "payload", "body"] as const) {
    const nested = j[key];
    if (nested && typeof nested === "object") {
      const v = extractEmbeddingVectorFromJson(nested);
      if (v) return v;
    }
  }

  return null;
}

/** 用于错误信息，避免把整段向量打进日志 */
export function summarizeEmbeddingResponseShape(json: unknown): string {
  if (json === null || json === undefined) return "响应体为空";
  if (typeof json !== "object") return `类型: ${typeof json}`;
  const j = json as Record<string, unknown>;
  if (Array.isArray((j as { choices?: unknown }).choices)) {
    return "含 choices 字段（多为对话补全接口响应），请确认 Base URL 为 …/v1 根路径且使用 embedding 模型";
  }
  if (Array.isArray(j.vectors) && j.vectors.length === 0) {
    return "含 vectors 字段但为空数组，请检查模型与输入文本";
  }
  const keys = Object.keys(j).slice(0, 14);
  return keys.length ? `JSON 顶层字段: ${keys.join(", ")}` : "空对象";
}

/**
 * MiniMax / 部分火山系接口：HTTP 200 但业务失败写在 base_resp.status_code（非 0）。
 */
export function throwIfEmbeddingBaseRespError(json: unknown): void {
  if (!json || typeof json !== "object") return;
  const j = json as Record<string, unknown>;
  const br = j.base_resp;
  if (!br || typeof br !== "object" || Array.isArray(br)) return;
  const o = br as Record<string, unknown>;
  const code = o.status_code;
  if (code === undefined || code === null) return;
  const n = typeof code === "number" ? code : Number(code);
  if (!Number.isFinite(n) || n === 0) return;
  const msg =
    typeof o.status_msg === "string" && o.status_msg.trim()
      ? o.status_msg.trim()
      : `status_code=${n}`;
  const enriched = enrichEmbeddingBusinessMessage(n, msg);
  throw new Error(`Embedding 业务错误: ${enriched}`);
}
