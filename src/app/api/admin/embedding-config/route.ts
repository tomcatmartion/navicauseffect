import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  EMBEDDING_CONFIG_KEY_1024,
  EMBEDDING_CONFIG_KEY_1536,
} from "@/lib/zvec/constants";
import {
  getEmbeddingConfigStoredShape,
  readPrevEmbeddingFieldsFromStoredJson,
} from "@/lib/zvec/embedding-config";

export const dynamic = "force-dynamic";

const noStoreJson = (body: unknown, init?: { status?: number }) =>
  NextResponse.json(body, {
    status: init?.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

type DimPayload = {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  /** 未传该键时表示沿用库内旧 groupId */
  groupId?: string;
};

/** 允许字段为空：空串会与库中旧值合并；仅要求块为对象 */
function parseDim(body: unknown, key: string): DimPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const block = b[key];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const o = block as Record<string, unknown>;
  const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
  const modelId = typeof o.modelId === "string" ? o.modelId.trim() : "";
  const apiKey = typeof o.apiKey === "string" ? o.apiKey.trim() : "";
  const groupId =
    "groupId" in o && typeof o.groupId === "string" ? o.groupId.trim() : undefined;
  return { baseUrl, modelId, apiKey, groupId };
}

function mergeWithPrev(
  p: DimPayload,
  prev: { baseUrl: string; modelId: string; apiKey: string; groupId: string }
) {
  return {
    baseUrl: p.baseUrl || prev.baseUrl,
    modelId: p.modelId || prev.modelId,
    apiKey: p.apiKey.length > 0 ? p.apiKey : prev.apiKey,
    groupId: p.groupId !== undefined ? p.groupId : prev.groupId,
  };
}

function isComplete(m: {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  groupId: string;
}): boolean {
  return !!(m.baseUrl && m.modelId && m.apiKey);
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return noStoreJson({ error: "无权限" }, { status: 403 });
  }

  const [d1536, d1024] = await Promise.all([
    getEmbeddingConfigStoredShape(prisma, "1536"),
    getEmbeddingConfigStoredShape(prisma, "1024"),
  ]);

  return noStoreJson({
    dim1536: d1536 ?? {
      baseUrl: "",
      modelId: "",
      hasApiKey: false,
      groupId: "",
    },
    dim1024: d1024 ?? {
      baseUrl: "",
      modelId: "",
      hasApiKey: false,
      groupId: "",
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return noStoreJson({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const p1536 = parseDim(body, "dim1536");
  const p1024 = parseDim(body, "dim1024");
  if (!p1536 || !p1024) {
    return noStoreJson(
      { error: "请求体需包含 dim1536、dim1024 对象（字段可留空以沿用库中旧值）" },
      { status: 400 }
    );
  }

  const row1536 = await prisma.adminConfig.findUnique({
    where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
  });
  const row1024 = await prisma.adminConfig.findUnique({
    where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
  });

  const prev1536 = readPrevEmbeddingFieldsFromStoredJson(row1536?.configValue);
  const prev1024 = readPrevEmbeddingFieldsFromStoredJson(row1024?.configValue);

  const m1536 = mergeWithPrev(p1536, prev1536);
  const m1024 = mergeWithPrev(p1024, prev1024);

  const complete1536 = isComplete(m1536);
  const complete1024 = isComplete(m1024);

  const ops = [];
  if (complete1536) {
    ops.push(
      prisma.adminConfig.upsert({
        where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
        update: {
          configValue: {
            baseUrl: m1536.baseUrl,
            modelId: m1536.modelId,
            apiKey: m1536.apiKey,
            groupId: m1536.groupId,
          },
        },
        create: {
          configKey: EMBEDDING_CONFIG_KEY_1536,
          configValue: {
            baseUrl: m1536.baseUrl,
            modelId: m1536.modelId,
            apiKey: m1536.apiKey,
            groupId: m1536.groupId,
          },
        },
      })
    );
  }
  if (complete1024) {
    ops.push(
      prisma.adminConfig.upsert({
        where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
        update: {
          configValue: {
            baseUrl: m1024.baseUrl,
            modelId: m1024.modelId,
            apiKey: m1024.apiKey,
            groupId: m1024.groupId,
          },
        },
        create: {
          configKey: EMBEDDING_CONFIG_KEY_1024,
          configValue: {
            baseUrl: m1024.baseUrl,
            modelId: m1024.modelId,
            apiKey: m1024.apiKey,
            groupId: m1024.groupId,
          },
        },
      })
    );
  }

  if (ops.length === 0) {
    return noStoreJson(
      {
        error:
          "本次没有任何一套配置可写入：每一套须同时具备 Base URL、Model ID、API Key。" +
          " 可只填 1536 或只填 1024（另一套留空且库中无旧值时不会写入该套）；API Key 留空时沿用库内已存密钥。",
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(ops);

  const dim1536 = await getEmbeddingConfigStoredShape(prisma, "1536");
  const dim1024 = await getEmbeddingConfigStoredShape(prisma, "1024");

  return noStoreJson({
    ok: true,
    dim1536: dim1536 ?? {
      baseUrl: "",
      modelId: "",
      hasApiKey: false,
      groupId: "",
    },
    dim1024: dim1024 ?? {
      baseUrl: "",
      modelId: "",
      hasApiKey: false,
      groupId: "",
    },
  });
}
