import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const SYSTAG_DIR = "sysfiles/systag";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** GET: 列出 sysfiles/systag/ 目录下的标签文件 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const systagPath = path.join(process.cwd(), SYSTAG_DIR);
    const names = await readdir(systagPath);
    const jsonFiles = names.filter((n) => n.endsWith(".json")).sort();

    const files = await Promise.all(
      jsonFiles.map(async (name) => {
        const filePath = path.join(systagPath, name);
        const fileStat = await stat(filePath);
        let tagCount = 0;
        try {
          const raw = await readFile(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.tags)) tagCount = parsed.tags.length;
        } catch { /* 忽略解析错误 */ }
        return {
          name,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          tagCount,
        };
      })
    );

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[tags/list] error:", error);
    return NextResponse.json({ files: [] });
  }
}
