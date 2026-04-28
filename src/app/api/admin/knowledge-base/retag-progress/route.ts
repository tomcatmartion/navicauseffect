import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readRetagProgress, writeRetagProgress } from "@/lib/logicdoc/retag-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** 打标任务超时阈值（毫秒），超过此时间仍为 running 视为卡死 */
const STALE_RUNNING_MS = 30 * 60 * 1000; // 30 分钟

/** GET: 获取打标任务进度 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const progress = await readRetagProgress();

  // 检测卡住的 running 状态：超过阈值自动标记为 error
  if (progress.status === "running" && progress.startedAt) {
    const elapsed = Date.now() - new Date(progress.startedAt).getTime();
    if (elapsed > STALE_RUNNING_MS) {
      await writeRetagProgress({
        status: "error",
        error: `任务超时（已运行 ${Math.round(elapsed / 60000)} 分钟），可能已被中断`,
      });
      progress.status = "error";
      progress.error = `任务超时（已运行 ${Math.round(elapsed / 60000)} 分钟），可能已被中断`;
    }
  }

  return NextResponse.json(progress);
}
