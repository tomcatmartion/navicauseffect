import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { auth } from "@/lib/auth";
import { ZVecOpen } from "@zvec/zvec";
import { ensureZvecInitialized } from "@/lib/zvec/init-zvec";
import { getLogicdocCollectionPath } from "@/lib/zvec/paths";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export interface ChunkDetail {
  id: string;
  text: string;
  source_file: string;
  content_hash: string;
  index_version: string;
  biz_modules: string[];
  stars: string[];
  palaces: string[];
  energy_levels: string[];
  time_scopes: string[];
}

/** GET: 查看指定文件的向量化分段详情 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("file");
    const family = searchParams.get("family") || "1536";

    if (!fileName) {
      return NextResponse.json({ error: "缺少 file 参数" }, { status: 400 });
    }

    // 安全校验：只允许安全字符
    const safeName = path.basename(fileName);
    if (safeName !== fileName || !/^[\w\u4e00-\u9fff.\-()（）]+$/.test(safeName)) {
      return NextResponse.json({ error: "文件名含非法字符" }, { status: 400 });
    }

    ensureZvecInitialized();

    const colPath = getLogicdocCollectionPath(family as "1536" | "1024");
    let col;
    try {
      col = ZVecOpen(colPath, { readOnly: true });
    } catch {
      return NextResponse.json({ error: "向量库未建立或未配置", chunks: [] }, { status: 404 });
    }

    try {
      // Zvec querySync 默认 topk=20，需显式设置足够大的值
      const filter = `source_file = '${fileName.replace(/'/g, "''")}'`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = col.querySync({ filter, topk: 1024 } as any) as any[];
      if (!Array.isArray(rows)) {
        return NextResponse.json({ fileName, family, totalChunks: 0, chunks: [] });
      }

      const chunks: ChunkDetail[] = rows.map((row) => {
        const fields = row.fields ?? {};
        return {
          id: String(row.id ?? ""),
          text: String(fields.text ?? ""),
          source_file: String(fields.source_file ?? ""),
          content_hash: String(fields.content_hash ?? ""),
          index_version: String(fields.index_version ?? ""),
          biz_modules: Array.isArray(fields.biz_modules) ? fields.biz_modules : [],
          stars: Array.isArray(fields.stars) ? fields.stars : [],
          palaces: Array.isArray(fields.palaces) ? fields.palaces : [],
          energy_levels: Array.isArray(fields.energy_levels) ? fields.energy_levels : [],
          time_scopes: Array.isArray(fields.time_scopes) ? fields.time_scopes : [],
        };
      });

      // 按 id 排序（id 包含 chunk index）
      chunks.sort((a, b) => a.id.localeCompare(b.id));

      return NextResponse.json({ fileName, family, totalChunks: chunks.length, chunks });
    } finally {
      col.closeSync();
    }
  } catch (error) {
    console.error("[knowledge-base/chunks] error:", error);
    const msg = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
