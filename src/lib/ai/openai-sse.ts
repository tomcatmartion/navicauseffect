/**
 * OpenAI 兼容的流式 chat/completions SSE 解析（智谱 / DeepSeek / 通义 等）。
 * 与脆弱实现相比：处理 CRLF、跳过 event: 行、读取每条 data:、解析 error 与 reasoning_content。
 */

export interface ParsedChunk {
  /** 应计入正文的增量（content + reasoning_content 等） */
  deltaText: string;
  /** 上游返回的错误（若有则应在 UI 展示，而非静默空流） */
  providerError: string | null;
}

export function extractFromOpenAiStreamJson(parsed: unknown): ParsedChunk {
  if (!parsed || typeof parsed !== "object") {
    return { deltaText: "", providerError: null };
  }
  const o = parsed as Record<string, unknown>;

  const err = o.error;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; code?: unknown };
    const msg = typeof e.message === "string" ? e.message : JSON.stringify(err);
    const code = e.code;
    const providerError =
      code !== undefined && code !== null && String(code) !== ""
        ? `${code}: ${msg}`
        : msg;
    return { deltaText: "", providerError };
  }

  const choices = o.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { deltaText: "", providerError: null };
  }

  const delta = (choices[0] as { delta?: unknown })?.delta;
  if (!delta || typeof delta !== "object") {
    return { deltaText: "", providerError: null };
  }

  const d = delta as Record<string, unknown>;
  let deltaText = "";

  const content = d.content;
  if (typeof content === "string" && content.length > 0) {
    deltaText += content;
  }

  // DeepSeek 思考链、部分模型推理阶段
  const reasoning = d.reasoning_content;
  if (typeof reasoning === "string" && reasoning.length > 0) {
    deltaText += reasoning;
  }

  return { deltaText, providerError: null };
}

/** 从一段 SSE event 块中提取所有 data 行负载（忽略 event:、id: 等） */
export function collectDataPayloadsFromSseEvent(eventBlock: string): string[] {
  const lines = eventBlock.split(/\n/);
  const payloads: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    const trimmedStart = line.trimStart();
    if (!trimmedStart.toLowerCase().startsWith("data:")) continue;
    let rest = trimmedStart.slice(5);
    if (rest.startsWith(" ") || rest.startsWith("\t")) {
      rest = rest.trimStart();
    }
    if (rest === "[DONE]") continue;
    if (rest.length === 0) continue;
    payloads.push(rest);
  }

  return payloads;
}

/**
 * 尝试解析 event 块中的所有 JSON payload，汇总 delta 与错误。
 * 单行 JSON 失败时会记录 optional 日志。
 */
export function parseOpenAiSseEventBlock(
  eventBlock: string,
  onParseError?: (payload: string, err: unknown) => void
): ParsedChunk {
  const payloads = collectDataPayloadsFromSseEvent(eventBlock);
  let deltaText = "";
  let providerError: string | null = null;

  for (const payload of payloads) {
    if (!payload.trim()) continue;
    try {
      const parsed = JSON.parse(payload) as unknown;
      const part = extractFromOpenAiStreamJson(parsed);
      if (part.providerError) {
        providerError = part.providerError;
        break;
      }
      deltaText += part.deltaText;
    } catch (e) {
      onParseError?.(payload, e);
    }
  }

  return { deltaText, providerError };
}
