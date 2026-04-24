import { ZVecInitialize, ZVecLogLevel, ZVecLogType } from "@zvec/zvec";

let inited = false;

/** 进程内只初始化一次，压低 Zvec 日志噪音 */
export function ensureZvecInitialized(): void {
  if (inited) return;
  inited = true;
  try {
    ZVecInitialize({
      logType: ZVecLogType.CONSOLE,
      logLevel: ZVecLogLevel.WARN,
    });
  } catch {
    /* 重复初始化等可忽略 */
  }
}
