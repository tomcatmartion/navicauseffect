import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readIndexProgress, writeIndexProgress } from "@/lib/zvec/index-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** 向量化任务超时阈值（毫秒），超过此时间仍为 running 视为卡死 */
const STALE_RUNNING_MS = 30 * 60 * 1000; // 30 分钟

/** GET: 查询向量化进度 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const progress = await readIndexProgress();

    // 检测卡住的 running 状态：超过阈值自动标记为 error
    if (progress.status === "running" && progress.startedAt) {
      const elapsed = Date.now() - new Date(progress.startedAt).getTime();
      if (elapsed > STALE_RUNNING_MS) {
        progress.status = "error";
        progress.error = `任务超时（已运行 ${Math.round(elapsed / 60000)} 分钟），可能已被中断`;
        await writeIndexProgress(progress);
      }
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error("[knowledge-base/index-progress] error:", error);
    return NextResponse.json({ status: "idle" }, { status: 500 });
  }
}
