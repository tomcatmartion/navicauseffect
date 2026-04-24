/**
 * AI 解盘接口的长度相关配置（环境变量可覆盖）。
 */

function parseEnvInt(
  name: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

/**
 * 传给大模型的 max_tokens（生成长度上限）。
 * 原先硬编码 2048，中文长文解盘容易「说到一半就停」。
 */
export function getAnalysisMaxOutputTokens(): number {
  return parseEnvInt("ANALYSIS_MAX_OUTPUT_TOKENS", 16_384, 256, 128_000);
}
