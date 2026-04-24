import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  embeddingCollectionDimension,
  type EmbeddingDimensionFamily,
} from "@/lib/zvec/constants";
import { getEmbeddingConfigForFamily } from "@/lib/zvec/embedding-config";
import { fetchEmbeddingVector } from "@/lib/zvec/fetch-embedding";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** POST body: `{ "family": "1536" | "1024" }` — 拉取库内配置并请求一次 embedding，校验维度与 Zvec 一致 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const fam = (body as { family?: string } | null)?.family;
  if (fam !== "1536" && fam !== "1024") {
    return NextResponse.json(
      { error: '请求体须为 JSON：{ "family": "1536" | "1024" }' },
      { status: 400 }
    );
  }

  const family = fam as EmbeddingDimensionFamily;

  try {
    const cfg = await getEmbeddingConfigForFamily(prisma, family);
    const expected = embeddingCollectionDimension(family);
    const vec = await fetchEmbeddingVector(cfg, "navicauseffect embedding ping", {
      expectedDimension: expected,
      callRole: "query",
    });
    return NextResponse.json({
      ok: true,
      family,
      dimension: vec.length,
      expectedDimension: expected,
      modelId: cfg.modelId,
      baseUrl: cfg.baseUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        family,
        error: msg,
      },
      { status: 502 }
    );
  }
}
