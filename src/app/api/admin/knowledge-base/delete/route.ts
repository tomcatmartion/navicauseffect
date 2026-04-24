import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

const SYSKNOWLEDGE_DIR = "sysfiles/sysknowledge";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** DELETE: 删除 sysfiles/sysknowledge/ 下的指定文件 */
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "缺少文件名" }, { status: 400 });
    }

    // 安全校验：白名单校验文件名字符
    const safeName = path.basename(name);
    if (safeName !== name || !/^[\w\u4e00-\u9fff.\-()（）]+$/.test(safeName)) {
      return NextResponse.json({ error: "无效文件名" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), SYSKNOWLEDGE_DIR, safeName);
    await unlink(filePath);

    return NextResponse.json({
      ok: true,
      message: `已删除 ${safeName}。如需更新向量库，请重新执行向量化。`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除失败";
    if (msg.includes("ENOENT")) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    console.error("[knowledge-base/delete] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
