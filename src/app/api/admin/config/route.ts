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

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const key = request.nextUrl.searchParams.get("key");

  if (key) {
    const config = await prisma.adminConfig.findUnique({
      where: { configKey: key },
    });
    return NextResponse.json(config?.configValue ?? null);
  }

  const configs = await prisma.adminConfig.findMany();
  const result: Record<string, unknown> = {};
  for (const c of configs) {
    result[c.configKey] = c.configValue;
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  const { key, value } = body as { key?: string; value?: unknown };

  if (!key || typeof key !== "string" || !/^[a-z_][a-z0-9_]*$/i.test(key)) {
    return NextResponse.json({ error: "key 必须为合法标识符（字母/数字/下划线）" }, { status: 400 });
  }
  if (value === undefined) {
    return NextResponse.json({ error: "缺少 value" }, { status: 400 });
  }
  // 允许的 value 类型：标量 / 数组 / 对象（会序列化为 JSON 存 JSON 字段）
  const allowedTypes = ["string", "number", "boolean", "object"];
  if (!allowedTypes.includes(typeof value)) {
    return NextResponse.json({ error: "value 类型不合法" }, { status: 400 });
  }

  await prisma.adminConfig.upsert({
    where: { configKey: key },
    update: { configValue: value as object },
    create: { configKey: key, configValue: value as object },
  });

  return NextResponse.json({ success: true });
}
