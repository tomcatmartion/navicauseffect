/**
 * 打标（retag）进度跟踪模块。
 * 使用 JSON 文件记录进度，供前端轮询展示。
 * 模式与 index-progress.ts 一致。
 */

import { readFile, writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { join } from "path";

export type RetagProgressStatus = "idle" | "running" | "completed" | "error";

export interface RetagLogEntry {
  /** 日志类型 */
  type: "start" | "file" | "batch" | "chunk" | "done" | "error";
  /** 日志文本 */
  text: string;
  /** 旧标签（chunk 类型时） */
  oldTags?: string[];
  /** 新标签（chunk 类型时） */
  newTags?: string[];
}

export interface RetagProgress {
  status: RetagProgressStatus;
  /** 打标模式 */
  mode: string;
  /** 任务类型：full / retagFailed / chunkIds */
  type: string;
  /** 使用模型 */
  model: string;
  /** 总片段数 */
  totalChunks: number;
  /** 已处理片段数 */
  processedChunks: number;
  /** AI 更新成功的片段数 */
  updatedChunks: number;
  /** AI 无有效结果，保留原标签的片段数 */
  skippedChunks: number;
  /** AI 调用次数 */
  aiCalls: number;
  /** 涉及文件数 */
  files: number;
  /** 当前正在处理的文件 */
  currentFile: string;
  /** 详细日志（最多保留 300 条） */
  logs: RetagLogEntry[];
  /** 错误信息 */
  error?: string;
  /** 开始时间 ISO */
  startedAt?: string;
  /** 完成时间 ISO */
  completedAt?: string;
}

const PROGRESS_DIR = "data/zvec";
const PROGRESS_FILE = ".retag-progress.json";

const DEFAULT_PROGRESS: RetagProgress = {
  status: "idle",
  mode: "system",
  type: "full",
  model: "",
  totalChunks: 0,
  processedChunks: 0,
  updatedChunks: 0,
  skippedChunks: 0,
  aiCalls: 0,
  files: 0,
  currentFile: "",
  logs: [],
};

function progressFilePath(): string {
  return path.join(process.cwd(), PROGRESS_DIR, PROGRESS_FILE);
}

/** 读取进度（文件不存在时返回 idle 状态） */
export async function readRetagProgress(): Promise<RetagProgress> {
  try {
    const raw = await readFile(progressFilePath(), "utf-8");
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

/** 写入进度（部分更新，合并现有值）。使用原子写入防止文件损坏。 */
export async function writeRetagProgress(update: Partial<RetagProgress>): Promise<void> {
  const current = await readRetagProgress();
  const merged = { ...current, ...update };
  const filePath = progressFilePath();
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  // 原子写入：先写临时文件，再 rename，防止写入一半时断电导致 JSON 损坏
  const tmpPath = join(dir, ".retag-progress.tmp");
  await writeFile(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
  await rename(tmpPath, filePath);
}
