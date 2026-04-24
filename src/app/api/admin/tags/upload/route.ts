import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

const SYSTAG_DIR = "sysfiles/systag";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** POST: 上传标签体系文件到 sysfiles/systag/ 目录 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    }

    // 安全检查：取 basename 防路径遍历
    const safeName = path.basename(file.name);
    const ext = path.extname(safeName).toLowerCase();
    if (ext !== ".json") {
      return NextResponse.json({ error: "仅支持 .json 格式的标签文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大（上限 5MB）` }, { status: 400 });
    }

    // 文件名安全校验
    if (!/^[\w\u4e00-\u9fff.\-()（）]+$/.test(safeName)) {
      return NextResponse.json({ error: "文件名含非法字符" }, { status: 400 });
    }

    // 解析并校验 JSON 内容
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder().decode(bytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "文件内容不是有效的 JSON" }, { status: 400 });
    }

    // 校验格式：必须有 tags 数组
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).tags)) {
      return NextResponse.json({ error: "标签文件格式不正确：必须包含 tags 数组" }, { status: 400 });
    }

    const tags = (parsed as { tags: unknown[] }).tags;
    for (const tag of tags) {
      if (!tag || typeof tag !== "object" || typeof (tag as Record<string, unknown>).name !== "string") {
        return NextResponse.json({ error: "标签定义格式不正确：每个标签必须有 name 字段" }, { status: 400 });
      }
    }

    const systagPath = path.join(process.cwd(), SYSTAG_DIR);
    const destPath = path.join(systagPath, safeName);
    await writeFile(destPath, Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      file: {
        name: safeName,
        size: file.size,
        tagCount: tags.length,
      },
    });
  } catch (error) {
    console.error("[tags/upload] error:", error);
    const msg = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
