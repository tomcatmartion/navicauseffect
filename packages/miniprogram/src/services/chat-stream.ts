/**
 * AI 对话流式响应 —— 小程序 HTTP 长轮询实现
 *
 * 小程序不支持 EventSource / fetch + ReadableStream（SSE 不可用）。
 * 后端方案：HTTP 长轮询（POST 启动后台 AI 流 + Redis stream 缓存 + GET 轮询消费）
 * 端点：POST /api/ziwei/reading-poll + GET /api/ziwei/reading-poll
 *
 * 本文件实现长轮询客户端：
 *   1. POST 启动对话 → 拿 sessionId
 *   2. 每 600ms GET 轮询 → 增量拉取 text/error/done
 *   3. done=true 时停止轮询
 */

import Taro from "@tarojs/taro";
import { api } from "./api";

const POLL_INTERVAL_MS = 600;
const MAX_POLL_DURATION_MS = 120_000; // 2 分钟超时
const MAX_CONSECUTIVE_EMPTY = 50; // 连续 50 次空响应（30s）后超时

export interface ChatStreamCallbacks {
  onMessage: (text: string) => void;
  onError: (err: Error) => void;
  onClose: () => void;
}

export interface ChatStreamPayload {
  question: string;
  chartData?: Record<string, unknown>;
  chartRecordId?: string;
  sessionId?: string;
}

/**
 * 打开 AI 对话流（长轮询版）
 *
 * @returns 控制器：含 close() 方法停止轮询
 */
export function openChatStream(
  payload: ChatStreamPayload,
  callbacks: ChatStreamCallbacks,
): { close: () => void } {
  let closed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const startPolling = async (sessionId: string) => {
    if (closed) return;
    let offset = 0;
    const startedAt = Date.now();
    let consecutiveEmpty = 0;

    const pollOnce = async () => {
      if (closed) return;

      // 超时保护
      if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
        callbacks.onError(new Error("AI 响应超时（>2 分钟）"));
        callbacks.onClose();
        return;
      }

      try {
        const res = await api.get<{
          items: Array<{ text?: string; error?: string; type?: string; ts: number }>;
          nextOffset: number;
          done: boolean;
        }>(`/api/ziwei/reading-poll?sessionId=${sessionId}&offset=${offset}`);

        if (closed) return;

        if (res.items.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty > MAX_CONSECUTIVE_EMPTY) {
            callbacks.onError(new Error("AI 响应超时（连续 30s 无增量）"));
            callbacks.onClose();
            return;
          }
        } else {
          consecutiveEmpty = 0;
          for (const item of res.items) {
            if (item.error) {
              callbacks.onError(new Error(item.error));
              callbacks.onClose();
              return;
            }
            if (item.text) {
              callbacks.onMessage(item.text);
            }
          }
          offset = res.nextOffset;
        }

        if (res.done) {
          callbacks.onClose();
          return;
        }

        // 继续下一轮
        pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
      } catch (err) {
        if (!closed) {
          callbacks.onError(err instanceof Error ? err : new Error(String(err)));
          callbacks.onClose();
        }
      }
    };

    pollOnce();
  };

  // 启动：POST 创建 session
  api
    .post<{ sessionId: string }>("/api/ziwei/reading-poll", payload)
    .then((res) => {
      if (closed) return;
      startPolling(res.sessionId);
    })
    .catch((err) => {
      if (!closed) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
        callbacks.onClose();
      }
    });

  return {
    close: () => {
      closed = true;
      if (pollTimer) clearTimeout(pollTimer);
    },
  };
}
