import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { withLogicdocIndexFileLock } from "@/lib/zvec/index-lock";
import { runLogicdocZvecIndex } from "@/lib/zvec/logicdoc-indexer";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** POST：重建 logicdoc Zvec 索引（已配置的 1536/1024 维各写一套；单线程文件锁，勿并发触发） */
export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const stats = await withLogicdocIndexFileLock(() =>
      runLogicdocZvecIndex(prisma)
    );
    return NextResponse.json({ ok: true, stats });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("另一项 sysknowledge 索引任务")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("[admin/logicdoc-reindex]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
