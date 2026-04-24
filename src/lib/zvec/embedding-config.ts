import { Prisma, type PrismaClient } from "@prisma/client";
import {
  EMBEDDING_CONFIG_KEY_1024,
  EMBEDDING_CONFIG_KEY_1536,
  type EmbeddingDimensionFamily,
} from "./constants";

export interface EmbeddingRuntimeConfig {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  /** MiniMax 等：请求体 `group_id`（后台可配，优先于环境变量） */
  groupId?: string;
}

/** MySQL/驱动偶发把 Json 列以字符串形式返回时，先解一层 */
function normalizeConfigJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Json 列在库中可能为 null / JsonNull；字符串时需先 normalize */
function isAbsentConfigValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (raw === Prisma.JsonNull || raw === Prisma.DbNull) return true;
  return false;
}

/** PUT 时从旧行合并（与 GET 同源解析；空字段表示沿用库中值） */
export function readPrevEmbeddingFieldsFromStoredJson(raw: unknown): {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  groupId: string;
} {
  if (isAbsentConfigValue(raw)) {
    return { baseUrl: "", modelId: "", apiKey: "", groupId: "" };
  }
  const n = normalizeConfigJson(raw);
  if (!n || typeof n !== "object" || Array.isArray(n)) {
    return { baseUrl: "", modelId: "", apiKey: "", groupId: "" };
  }
  const o = n as Record<string, unknown>;
  return {
    baseUrl: pickStr(o, "baseUrl", "base_url"),
    modelId: pickStr(o, "modelId", "model_id"),
    apiKey: pickStr(o, "apiKey", "api_key"),
    groupId: pickStr(o, "groupId", "group_id"),
  };
}

export function readPrevApiKeyFromStoredJson(raw: unknown): string {
  return readPrevEmbeddingFieldsFromStoredJson(raw).apiKey;
}

function parseJsonConfig(raw: unknown): EmbeddingRuntimeConfig | null {
  const n = normalizeConfigJson(raw);
  if (!n || typeof n !== "object" || Array.isArray(n)) return null;
  const o = n as Record<string, unknown>;
  const baseUrl = pickStr(o, "baseUrl", "base_url");
  const modelId = pickStr(o, "modelId", "model_id");
  const apiKey = pickStr(o, "apiKey", "api_key");
  if (!baseUrl || !modelId || !apiKey) return null;
  const groupId = pickStr(o, "groupId", "group_id");
  return {
    baseUrl,
    modelId,
    apiKey,
    ...(groupId ? { groupId } : {}),
  };
}

function envFallback(family: EmbeddingDimensionFamily): EmbeddingRuntimeConfig | null {
  const prefix = family === "1536" ? "EMBEDDING_1536" : "EMBEDDING_1024";
  const baseUrl = process.env[`${prefix}_BASE_URL`]?.trim() ?? "";
  const modelId = process.env[`${prefix}_MODEL`]?.trim() ?? "";
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim() ?? "";
  if (!baseUrl || !modelId || !apiKey) return null;
  const groupId =
    process.env[`${prefix}_GROUP_ID`]?.trim() ||
    process.env.EMBEDDING_MINIMAX_GROUP_ID?.trim() ||
    "";
  return {
    baseUrl,
    modelId,
    apiKey,
    ...(groupId ? { groupId } : {}),
  };
}

export async function getEmbeddingConfigForFamily(
  prisma: PrismaClient,
  family: EmbeddingDimensionFamily
): Promise<EmbeddingRuntimeConfig> {
  const key =
    family === "1536" ? EMBEDDING_CONFIG_KEY_1536 : EMBEDDING_CONFIG_KEY_1024;
  const row = await prisma.adminConfig.findUnique({ where: { configKey: key } });
  const fromDb = parseJsonConfig(row?.configValue);
  if (fromDb) return fromDb;
  /**
   * 库中已有行但解析失败时，禁止静默回退到 .env，否则表现为「后台保存不生效」。
   */
  if (row) {
    console.error(
      `[embedding] AdminConfig ${key} 存在但 config_value 无法解析为有效 embedding（需 baseUrl/modelId/apiKey）:`,
      row.configValue
    );
    throw new Error(
      `${family} 维 embedding 在数据库中格式异常或缺少字段。请打开「Embedding」页重新填写并保存；若曾手工改库请改回 JSON 对象。`
    );
  }
  const fromEnv = envFallback(family);
  if (fromEnv) return fromEnv;
  throw new Error(
    `未配置 ${family} 维 embedding：请在管理后台「Embedding / 向量库」填写，或设置环境变量 ` +
      (family === "1536"
        ? "EMBEDDING_1536_BASE_URL / EMBEDDING_1536_MODEL / EMBEDDING_1536_API_KEY"
        : "EMBEDDING_1024_BASE_URL / EMBEDDING_1024_MODEL / EMBEDDING_1024_API_KEY")
  );
}

/** 管理端展示用（脱敏 apiKey）；允许仅有 baseUrl/modelId 以便提示补全 Key */
export async function getEmbeddingConfigStoredShape(
  prisma: PrismaClient,
  family: EmbeddingDimensionFamily
): Promise<{
  baseUrl: string;
  modelId: string;
  hasApiKey: boolean;
  groupId: string;
} | null> {
  const key =
    family === "1536" ? EMBEDDING_CONFIG_KEY_1536 : EMBEDDING_CONFIG_KEY_1024;
  const row = await prisma.adminConfig.findUnique({ where: { configKey: key } });
  if (!row || isAbsentConfigValue(row.configValue)) return null;
  const n = normalizeConfigJson(row.configValue);
  if (!n || typeof n !== "object" || Array.isArray(n)) return null;
  const o = n as Record<string, unknown>;
  const baseUrl = pickStr(o, "baseUrl", "base_url");
  const modelId = pickStr(o, "modelId", "model_id");
  const apiKey = pickStr(o, "apiKey", "api_key");
  const groupId = pickStr(o, "groupId", "group_id");
  if (!baseUrl && !modelId && !apiKey && !groupId) return null;
  return {
    baseUrl,
    modelId,
    hasApiKey: !!apiKey,
    groupId,
  };
}
