/**
 * 向量化索引维护工具。
 * 清理中断任务残留的锁文件和过期进度，避免卡死。
 */

import { unlink } from "fs/promises";
import path from "path";
import { readIndexProgress, writeIndexProgress } from "./index-progress";
import { readRetagProgress, writeRetagProgress } from "@/lib/logicdoc/retag-progress";
import { getLogicdocIndexLockPath } from "./paths";

/** 任务超时阈值：超过此时间仍为 running 视为残留 */
const STALE_MS = 10 * 60 * 1000; // 10 分钟（正常向量化应在几分钟内开始处理）

/**
 * 清理中断残留：锁文件 + 过期进度。
 * 在每次启动新向量化任务前调用，确保干净启动。
 */
export async function clearStaleIndexArtifacts(): Promise<void> {
  // 1. 检查并清理卡住的向量化进度
  const idxProgress = await readIndexProgress();
  if (idxProgress.status === "running" && idxProgress.startedAt) {
    const elapsed = Date.now() - new Date(idxProgress.startedAt).getTime();
    if (elapsed > STALE_MS) {
      console.warn(
        `[index-housekeeping] 发现残留的向量化进度（已运行 ${Math.round(elapsed / 60000)} 分钟），自动清理`
      );
      // 先清理锁文件（可能残留）
      await unlink(getLogicdocIndexLockPath()).catch(() => {});
      // 将进度标记为 error，让前端停止轮询
      await writeIndexProgress({
        ...idxProgress,
        status: "error",
        error: "上次任务被中断，已自动清理",
      });
    }
  }

  // 2. 检查并清理卡住的打标进度
  const retagProgress = await readRetagProgress();
  if (retagProgress.status === "running" && retagProgress.startedAt) {
    const elapsed = Date.now() - new Date(retagProgress.startedAt).getTime();
    if (elapsed > STALE_MS) {
      console.warn(
        `[index-housekeeping] 发现残留的打标进度（已运行 ${Math.round(elapsed / 60000)} 分钟），自动清理`
      );
      await writeRetagProgress({
        status: "error",
        error: "上次打标任务被中断，已自动清理",
      });
    }
  }
}
