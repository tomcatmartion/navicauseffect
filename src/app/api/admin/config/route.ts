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

  const body = await request.json();
  const { key, value } = body;

  if (!key) {
    return NextResponse.json({ error: "缺少 key" }, { status: 400 });
  }

  await prisma.adminConfig.upsert({
    where: { configKey: key },
    update: { configValue: value },
    create: { configKey: key, configValue: value },
  });

  return NextResponse.json({ success: true });
}
