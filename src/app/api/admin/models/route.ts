import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** 列表与编辑用：不返回密钥原文，仅标记是否已配置 */
function toSafeModel(m: { id: string; name: string; provider: string; modelId: string; baseUrl: string; isActive: boolean; isDefault: boolean; apiKeyEncrypted: string }) {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    modelId: m.modelId,
    baseUrl: m.baseUrl,
    isActive: m.isActive,
    isDefault: m.isDefault,
    hasApiKey: !!m.apiKeyEncrypted,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const one = await prisma.aIModelConfig.findUnique({
      where: { id },
    });
    if (!one) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json(toSafeModel(one));
  }

  const models = await prisma.aIModelConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(models.map(toSafeModel));
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json();
  const { name, provider, apiKey, baseUrl, modelId, isDefault } = body;

  if (!name || !provider || !modelId || !baseUrl) {
    return NextResponse.json({ error: "缺少必填项：name、provider、modelId、baseUrl" }, { status: 400 });
  }
  if (!apiKey || String(apiKey).trim() === "") {
    return NextResponse.json({ error: "新建模型必须填写 API Key" }, { status: 400 });
  }

  if (isDefault) {
    await prisma.aIModelConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const model = await prisma.aIModelConfig.create({
    data: {
      name: String(name).trim(),
      provider: String(provider).trim(),
      apiKeyEncrypted: String(apiKey).trim(),
      baseUrl: String(baseUrl).trim(),
      modelId: String(modelId).trim(),
      isActive: true,
      isDefault: !!isDefault,
    },
  });

  return NextResponse.json(toSafeModel(model));
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault } = body;

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof name === "string") update.name = name.trim();
  if (typeof provider === "string") update.provider = provider.trim();
  if (typeof modelId === "string") update.modelId = modelId.trim();
  if (typeof baseUrl === "string") update.baseUrl = baseUrl.trim();
  if (typeof apiKey === "string" && apiKey.trim() !== "") update.apiKeyEncrypted = apiKey.trim();
  if (typeof isActive === "boolean") update.isActive = isActive;
  if (isDefault === true) {
    await prisma.aIModelConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    update.isDefault = true;
  }

  const model = await prisma.aIModelConfig.update({
    where: { id },
    data: update,
  });

  return NextResponse.json(toSafeModel(model));
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  await prisma.aIModelConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
