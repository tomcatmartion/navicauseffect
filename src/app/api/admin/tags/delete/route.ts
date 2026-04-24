import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

const SYSTAG_DIR = "sysfiles/systag";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** DELETE: 删除指定标签文件 */
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "缺少文件名" }, { status: 400 });
    }

    // 安全检查：basename 防路径遍历
    const safeName = path.basename(name);
    if (!safeName.endsWith(".json")) {
      return NextResponse.json({ error: "只能删除 .json 文件" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), SYSTAG_DIR, safeName);
    await unlink(filePath);

    // 清除 registry 缓存
    const { clearSystagCache } = await import("@/lib/logicdoc/registry");
    clearSystagCache();

    return NextResponse.json({ ok: true, message: `已删除 ${safeName}` });
  } catch (error) {
    console.error("[tags/delete] error:", error);
    const msg = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
