import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { isSupportedFile } from "@/lib/logicdoc/file-parser";

const SYSKNOWLEDGE_DIR = "sysfiles/sysknowledge";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** POST: 上传知识库文档到 sysfiles/sysknowledge/ 目录 */
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
    if (!isSupportedFile(safeName)) {
      return NextResponse.json(
        { error: `不支持的文件格式。支持：.md, .docx, .pdf, .xlsx, .xls` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件过大（上限 20MB），当前 ${Math.round(file.size / 1024 / 1024)}MB` },
        { status: 400 }
      );
    }

    // 文件名安全校验：白名单字符
    if (!/^[\w\u4e00-\u9fff.\-()（）]+$/.test(safeName)) {
      return NextResponse.json({ error: "文件名含非法字符" }, { status: 400 });
    }

    // 文件内容 magic bytes 校验
    const bytes = await file.arrayBuffer();
    const header = Buffer.from(bytes.slice(0, 8));
    const ext = path.extname(safeName).toLowerCase();
    if (ext === ".pdf" && !header.toString("ascii").startsWith("%PDF")) {
      return NextResponse.json({ error: "文件内容不是有效的 PDF" }, { status: 400 });
    }
    if ((ext === ".docx" || ext === ".xlsx" || ext === ".xls") && header[0] !== 0x50) {
      return NextResponse.json({ error: `文件内容不是有效的 ${ext.toUpperCase()} 格式` }, { status: 400 });
    }

    // 确保 sysknowledge 目录存在
    const knowledgePath = path.join(process.cwd(), SYSKNOWLEDGE_DIR);
    await mkdir(knowledgePath, { recursive: true });

    const destPath = path.join(knowledgePath, safeName);
    await writeFile(destPath, Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      file: {
        name: safeName,
        size: file.size,
        type: path.extname(safeName).toLowerCase(),
      },
    });
  } catch (error) {
    console.error("[knowledge-base/upload] error:", error);
    const msg = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
