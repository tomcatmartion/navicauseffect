/**
 * 流式解盘超时：须与前端 `READING_TIMEOUT_MS`（默认 480s）同量级，避免 AI 长回答被 120s 掐断。
 */
export const AI_STREAM_TIMEOUT_MS = Math.max(
  120_000,
  Number.parseInt(process.env.AI_STREAM_TIMEOUT_MS ?? '480000', 10) || 480_000,
)
