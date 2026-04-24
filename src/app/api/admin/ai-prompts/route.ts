import { NextRequest, NextResponse } from "next/server";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  AI_PROMPTS_CONFIG_KEY,
  getBuiltinAnalysisPromptsPayload,
  mergeAnalysisPromptsFromStored,
  type AnalysisPromptsPayload,
} from "@/lib/ai/prompts";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** GET：内置默认 + 当前库中已保存片段 + 合并后的生效值 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const defaults = getBuiltinAnalysisPromptsPayload();
  const row = await prisma.adminConfig.findUnique({
    where: { configKey: AI_PROMPTS_CONFIG_KEY },
  });
  const stored = row?.configValue ?? null;
  const effective = mergeAnalysisPromptsFromStored(stored, defaults);

  return NextResponse.json({
    defaults,
    stored,
    effective,
  });
}

function validatePayload(body: unknown): AnalysisPromptsPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.systemPrompt !== "string") return null;
  const rawCats = b.categoryPrompts;
  if (!rawCats || typeof rawCats !== "object" || Array.isArray(rawCats)) {
    return null;
  }
  const rc = rawCats as Record<string, unknown>;
  const categoryPrompts = {} as Record<AnalysisCategory, string>;
  for (const cat of Object.values(AnalysisCategory)) {
    const v = rc[cat];
    if (typeof v !== "string") return null;
    categoryPrompts[cat] = v;
  }
  return {
    systemPrompt: b.systemPrompt,
    categoryPrompts,
  };
}

/** PUT：整包保存（须包含 system + 全部 7 类） */
export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const payload = validatePayload(body);
  if (!payload) {
    return NextResponse.json({ error: "无效的 prompt 结构" }, { status: 400 });
  }

  await prisma.adminConfig.upsert({
    where: { configKey: AI_PROMPTS_CONFIG_KEY },
    update: { configValue: payload as object },
    create: { configKey: AI_PROMPTS_CONFIG_KEY, configValue: payload as object },
  });

  return NextResponse.json({ success: true });
}

/** DELETE：清除库中配置，回退为代码默认 */
export async function DELETE() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  await prisma.adminConfig.deleteMany({
    where: { configKey: AI_PROMPTS_CONFIG_KEY },
  });

  return NextResponse.json({ success: true });
}
