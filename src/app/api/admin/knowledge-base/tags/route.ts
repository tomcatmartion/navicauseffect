import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getTagDefinitions, resolveFileId } from "@/lib/logicdoc/registry";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** GET: 获取文件的手动标签 + 可用标签列表 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const fileName = request.nextUrl.searchParams.get("file");

  // 获取可用标签列表（从 systag 目录）
  const availableTags = (await getTagDefinitions()).map((t) => t.name);

  if (!fileName) {
    return NextResponse.json({ tags: [], availableTags });
  }

  // 将文件名解析为 file_id，优先用 file_id 查 DB
  const fileId = await resolveFileId(fileName);

  try {
    // 先查 file_id key
    let config = await prisma.adminConfig.findUnique({
      where: { configKey: `logicdoc_tags_${fileId}` },
    });
    // 未命中则 fallback 到旧 fileName key（向后兼容）
    if (!config?.configValue && fileId !== fileName) {
      config = await prisma.adminConfig.findUnique({
        where: { configKey: `logicdoc_tags_${fileName}` },
      });
    }
    const tags = config?.configValue ? JSON.parse(config.configValue as string) : [];
    return NextResponse.json({ tags, availableTags });
  } catch {
    return NextResponse.json({ tags: [], availableTags });
  }
}

/** PUT: 保存文件的手动标签（使用 file_id 作为 DB key） */
export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const { file, tags } = await request.json();
    if (!file || !Array.isArray(tags)) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // 用 file_id 作为 DB key，解耦文件名
    const fileId = await resolveFileId(file);

    await prisma.adminConfig.upsert({
      where: { configKey: `logicdoc_tags_${fileId}` },
      update: { configValue: JSON.stringify(tags) },
      create: { configKey: `logicdoc_tags_${fileId}`, configValue: JSON.stringify(tags) },
    });

    return NextResponse.json({ ok: true, message: "标签已保存。如需更新向量库中的标签，请执行「重新打标」。" });
  } catch (error) {
    console.error("[knowledge-base/tags] error:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
