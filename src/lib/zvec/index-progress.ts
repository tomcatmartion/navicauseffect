/**
 * 向量化（索引）进度跟踪模块。
 * 使用 JSON 文件记录进度，供前端轮询展示。
 */

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export type IndexProgressStatus = "idle" | "running" | "completed" | "error";

export interface IndexProgress {
  status: IndexProgressStatus;
  /** 总文件数 */
  totalFiles: number;
  /** 已处理文件数 */
  processedFiles: number;
  /** 总块数 */
  totalChunks: number;
  /** 已处理块数 */
  processedChunks: number;
  /** 1536 维 API 调用次数 */
  apiCalls1536: number;
  /** 1024 维 API 调用次数 */
  apiCalls1024: number;
  /** AI 打标批次数 */
  aiTagCalls?: number;
  /** 跳过的未变块数 */
  skippedChunks: number;
  /** 当前正在处理的文件 */
  currentFile: string;
  /** 错误信息 */
  error?: string;
  /** 开始时间 ISO */
  startedAt?: string;
  /** 完成时间 ISO */
  completedAt?: string;
}

const PROGRESS_DIR = "data/zvec";
const PROGRESS_FILE = ".index-progress.json";

const DEFAULT_PROGRESS: IndexProgress = {
  status: "idle", totalFiles: 0, processedFiles: 0, totalChunks: 0, processedChunks: 0,
  apiCalls1536: 0, apiCalls1024: 0, skippedChunks: 0, currentFile: "",
};

function progressFilePath(): string {
  return path.join(process.cwd(), PROGRESS_DIR, PROGRESS_FILE);
}

/** 读取进度（文件不存在时返回 idle 状态） */
export async function readIndexProgress(): Promise<IndexProgress> {
  try {
    const raw = await readFile(progressFilePath(), "utf-8");
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

/** 写入进度（创建目录 + 写入 JSON） */
export async function writeIndexProgress(progress: IndexProgress): Promise<void> {
  const filePath = progressFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(progress), "utf-8");
}

/** 清除进度文件 */
export async function clearIndexProgress(): Promise<void> {
  try {
    await unlink(progressFilePath());
  } catch {
    // 忽略（文件不存在等）
  }
}
