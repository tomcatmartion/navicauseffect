import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readRetagProgress, writeRetagProgress } from "@/lib/logicdoc/retag-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** 打标任务超时阈值（毫秒），超过此时间仍为 running 视为卡死。
 * 批量 AI 打标任务耗时长，默认 2 小时。生产环境知识库规模大时，可调大此值。 */
const STALE_RUNNING_MS = Number(process.env.RETAG_STALE_TIMEOUT_MS ?? 2 * 60 * 60 * 1000); // 默认 2 小时

/** GET: 获取打标任务进度 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const progress = await readRetagProgress();

  // 检测卡住的 running 状态：超过阈值自动标记为中断错误
  if (progress.status === "running" && progress.startedAt) {
    const elapsed = Date.now() - new Date(progress.startedAt).getTime();
    if (elapsed > STALE_RUNNING_MS) {
      await writeRetagProgress({
        status: "error",
        error: `[中断] 任务已中断（运行时长 ${Math.round(elapsed / 60000)} 分钟），请重新执行打标`,
      });
      progress.status = "error";
      progress.error = `[中断] 任务已中断（运行时长 ${Math.round(elapsed / 60000)} 分钟），请重新执行打标`;
    }
  }

  return NextResponse.json(progress);
}
