/**
 * AI 对话流式响应 —— 小程序 SSE 替代方案
 *
 * 小程序不支持 EventSource（fetch + ReadableStream）。
 * 替代方案：
 *   方案 A（推荐）：WebSocket
 *     wx.connectSocket → 后端 /api/ziwei/reading-ws（需后端新增）
 *   方案 B：短轮询
 *     每 500ms 调 /api/ziwei/reading-poll?sessionId=xxx 增量拉取
 *
 * 本文件实现方案 A（WebSocket），方案 B 作为 fallback 注释。
 */

import Taro from "@tarojs/taro";

const WS_URL = "wss://ziwei.app/api/ziwei/reading-ws";

export interface ChatStreamCallbacks {
  onMessage: (text: string) => void;
  onError: (err: Error) => void;
  onClose: () => void;
}

export function openChatStream(
  payload: { question: string; chartData?: Record<string, unknown>; sessionId?: string },
  callbacks: ChatStreamCallbacks,
) {
  const socket = Taro.connectSocket({ url: WS_URL, header: { "content-type": "application/json" } });

  socket.onOpen(() => {
    socket.send({ data: JSON.stringify(payload) });
  });

  socket.onMessage((res) => {
    try {
      const parsed = JSON.parse(res.data as string) as {
        type?: string;
        text?: string;
        error?: string;
        sessionId?: string;
      };
      if (parsed.error) {
        callbacks.onError(new Error(parsed.error));
        return;
      }
      if (parsed.text) {
        callbacks.onMessage(parsed.text);
      }
    } catch {
      // 非 JSON，按纯文本处理
      callbacks.onMessage(res.data as string);
    }
  });

  socket.onError((err) => {
    callbacks.onError(new Error(err.errMsg || "WebSocket 错误"));
  });

  socket.onClose(() => {
    callbacks.onClose();
  });

  return {
    close: () => socket.close({}),
  };
}

/*
// 方案 B（短轮询 fallback）—— 当 WebSocket 不可用时使用
export async function pollChatStream(
  sessionId: string,
  lastOffset: number,
): Promise<{ text: string; offset: number; done: boolean }> {
  const res = await api.get<{ text: string; offset: number; done: boolean }>(
    `/api/ziwei/reading-poll?sessionId=${sessionId}&offset=${lastOffset}`,
  );
  return res;
}
*/
