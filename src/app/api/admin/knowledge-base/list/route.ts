import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readdir, stat } from "fs/promises";
import path from "path";
import { isSupportedFile, getFileExt } from "@/lib/logicdoc/file-parser";

const SYSKNOWLEDGE_DIR = "sysfiles/sysknowledge";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export interface KnowledgeBaseFile {
  name: string;
  ext: string;
  size: number;
  modifiedAt: string;
  /** 是否已向量化（Zvec 中有该文件的记录） */
  indexed: boolean;
}

/** GET: 列出 sysfiles/sysknowledge/ 目录下的所有知识库文件 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const dir = path.join(process.cwd(), SYSKNOWLEDGE_DIR);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      // 目录不存在，返回空列表
      return NextResponse.json({ files: [] });
    }

    // 获取已向量化的文件列表（从进度文件中读取，或简单检查）
    const indexedFiles = await getIndexedFiles();

    const files: KnowledgeBaseFile[] = [];
    for (const name of names) {
      if (!isSupportedFile(name)) continue;
      const filePath = path.join(dir, name);
      try {
        const info = await stat(filePath);
        files.push({
          name,
          ext: getFileExt(name),
          size: info.size,
          modifiedAt: info.mtime.toISOString(),
          indexed: indexedFiles.has(name),
        });
      } catch {
        // 跳过无法读取的文件
      }
    }

    // 按文件名排序
    files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[knowledge-base/list] error:", error);
    return NextResponse.json({ error: "读取文件列表失败" }, { status: 500 });
  }
}

/** 从 Zvec 中读取已有 source_file 的集合（用于判断哪些文件已索引） */
async function getIndexedFiles(): Promise<Set<string>> {
  try {
    const { ZVecOpen } = await import("@zvec/zvec");
    const { ensureZvecInitialized } = await import("@/lib/zvec/init-zvec");
    const { getLogicdocCollectionPath } = await import("@/lib/zvec/paths");
    const { readdir } = await import("fs/promises");

    ensureZvecInitialized();
    const files = new Set<string>();

    for (const dim of ["1536", "1024"] as const) {
      try {
        const colPath = getLogicdocCollectionPath(dim);
        // 检查目录是否存在
        try {
          await readdir(colPath);
        } catch {
          continue; // 目录不存在，跳过
        }
        const col = ZVecOpen(colPath, { readOnly: true });
        try {
          // 用 query 扫描所有记录，提取 source_file 字段（topk 默认 20，需放大）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = col.querySync({ filter: "source_file != ''", topk: 1024 } as any) as any[];
          if (Array.isArray(rows)) {
            for (const row of rows) {
              const sf = row.fields?.source_file;
              if (typeof sf === "string") files.add(sf);
            }
          }
        } finally {
          col.closeSync();
        }
      } catch {
        // 该维度未配置，跳过
      }
    }

    return files;
  } catch {
    return new Set();
  }
}
