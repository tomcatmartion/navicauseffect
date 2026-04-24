import { mkdir, open, unlink } from "fs/promises";
import path from "path";
import { getLogicdocIndexLockPath } from "./paths";

/**
 * 跨进程互斥：避免 Next 多路由 / CLI 同时写 Zvec 导致文件锁问题。
 * 使用 O_EXCL 创建锁文件；任务结束删除。
 */
export async function withLogicdocIndexFileLock<T>(
  fn: () => Promise<T>
): Promise<T> {
  const lockPath = getLogicdocIndexLockPath();
  await mkdir(path.dirname(lockPath), { recursive: true });
  let fh;
  try {
    fh = await open(lockPath, "wx");
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "EEXIST") {
      throw new Error("另一项 sysknowledge 索引任务正在执行，请稍后再试");
    }
    throw e;
  }
  try {
    return await fn();
  } finally {
    try {
      await fh.close();
    } finally {
      await unlink(lockPath).catch(() => {});
    }
  }
}
