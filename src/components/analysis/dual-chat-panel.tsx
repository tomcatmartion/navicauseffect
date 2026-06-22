"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Bug } from "lucide-react";
import type { HybridDebugInfo } from "@/types/hybrid-debug";
import { HybridDebugPanel } from "./hybrid-debug-panel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  debugInfo?: HybridDebugInfo;
}

interface DualChatPanelProps {
  /**
   * 序列化后的命盘数据（由父组件统一生成，确保含 horoscope 与 birthInfo）
   *
   * 注意：此数据应与 ZiweiAnalysisPanel 使用的 chartData 同源，
   * 避免对话侧与分析侧因序列化参数不同导致结果不一致。
   */
  chartData: Record<string, unknown> | null;
  /** 父母出生年份（可选，影响父母四化评分） */
  parentBirthYears?: { father?: number; mother?: number };
}

export function DualChatPanel({ chartData, parentBirthYears }: DualChatPanelProps) {
  const { data: session } = useSession();

  // ── Hybrid（程序模型混合）状态 ─────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [activeDebug, setActiveDebug] = useState<HybridDebugInfo | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检测用户是否手动滚动过消息容器
  const handleContainerScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || streaming) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolled(distanceFromBottom > 50 && messages.length > 0);
  }, [streaming, messages.length]);

  // 自动定位：仅在新消息追加且用户未手动滚动时定位
  useEffect(() => {
    if (!streaming && !userScrolled && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streaming, userScrolled]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // ── 发送消息（仅 hybrid 程序混合模式）────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamContent("");
    setUserScrolled(false);

    const body: Record<string, unknown> = { question: text, stream: true };
    if (sessionId) {
      body.sessionId = sessionId;
    } else if (chartData) {
      body.chartData = chartData;
    }
    if (parentBirthYears) {
      body.parentBirthYears = parentBirthYears;
    }

    try {
      const res = await fetch("/api/ziwei/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: `[错误] ${(err as Record<string, string>).error || "请求失败"}` }]);
        setStreaming(false);
        return;
      }

      // 非 SSE 响应（同步模式兜底）
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json() as { reply?: string; sessionId?: string };
        if (data.sessionId) setSessionId(data.sessionId);
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "未收到回复" }]);
        setStreaming(false);
        return;
      }

      // SSE 流式处理
      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) => [...prev, { role: "assistant", content: "无法读取响应流" }]);
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let sseCarry = "";
      let currentDebugInfo: HybridDebugInfo | undefined;

      while (true) {
        const { done, value } = await reader.read();
        sseCarry += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const lines = sseCarry.split("\n");
        sseCarry = done ? "" : (lines.pop() ?? "");

        for (const raw of lines) {
          const line = raw.replace(/\r$/, "").trimStart();
          if (!line.toLowerCase().startsWith("data:")) continue;
          const payload = line.slice(5).trimStart();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as Record<string, unknown>;

            if (parsed.sessionId && !sessionId) {
              setSessionId(String(parsed.sessionId));
            }

            if (parsed.type === "debug" && parsed.debugInfo) {
              currentDebugInfo = parsed.debugInfo as HybridDebugInfo;
              continue;
            }

            if (parsed.error) {
              accumulated += `\n[错误] ${parsed.error}`;
              setStreamContent(accumulated);
            } else if (parsed.text) {
              accumulated += parsed.text;
              setStreamContent(accumulated);
            }
          } catch {
            // 半行 JSON，跳过
          }
        }

        if (done) break;
      }

      setStreamContent("");
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated, debugInfo: currentDebugInfo },
        ]);
      } else if (currentDebugInfo) {
        // 有调试信息但无内容，可能是 AI 返回空或流中断
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "AI 未返回有效内容，请查看调试信息或重试。", debugInfo: currentDebugInfo },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "未收到回复内容，请重试。" }]);
      }
    } catch (err) {
      console.error("Reading error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "网络错误，请检查连接后重试。" }]);
      setStreamContent("");
    } finally {
      setStreaming(false);
      setUserScrolled(false);
    }
  }, [streaming, chartData, sessionId, parentBirthYears]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  const handleSend = () => sendMessage(input.trim());

  const presetQuestions = [
    "我的事业运如何？",
    "我明年的财运怎么样？",
    "我后年能结婚吗？",
    "我最适合的职业方向有哪些？",
    "我的家庭关系怎么样？",
  ];

  return (
    <>
      <div className="chat-shell">
        {/* 流式输出状态提示（用 testUI .tool-call 风格） */}
        {streaming && (
          <div
            className="tool-call"
            style={{ margin: "8px 2px 0" }}
          >
            <Loader2
              className="size-3 animate-spin"
              style={{ marginRight: 6 }}
            />
            正在调动各类知识，结合科学与玄学全面分析，请稍候...
          </div>
        )}

        {/* 消息列表 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleContainerScroll}
          className="chat-stream"
        >
          {messages.length === 0 && !streamContent && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                padding: "20px 0",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              <i
                className="ti ti-message-2"
                style={{ fontSize: 32, opacity: 0.4 }}
              />
              <p>输入你的命理问题，或点击下方事项快速开始</p>
              <div className="suggest-chips" style={{ margin: 0 }}>
                {presetQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chip"
                    onClick={() => sendMessage(q)}
                    disabled={streaming || !session?.user}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role === "user" ? "user" : "ai"}`}>
              {msg.role === "assistant" && (
                <div className="msg-avatar" aria-hidden>
                  紫
                </div>
              )}
              <div className="msg-bubble">
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  {msg.role === "user" ? "你" : "AI 解读"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {renderContent(msg.content)}
                </div>
                {msg.role === "assistant" && msg.debugInfo && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 6,
                      borderTop: "1px dashed var(--line-light)",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDebug(msg.debugInfo ?? null)}
                      className="iconbtn"
                      style={{ width: "auto", height: "auto", padding: "4px 10px", fontSize: 11 }}
                      title="查看调试信息"
                    >
                      <Bug style={{ width: 12, height: 12, marginRight: 4 }} />
                      调试
                    </button>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="msg-avatar" aria-hidden>
                  我
                </div>
              )}
            </div>
          ))}

          {/* 流式输出 */}
          {streamContent && (
            <div className="msg ai">
              <div className="msg-avatar">紫</div>
              <div className="msg-bubble">
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  AI 解读
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {renderContent(streamContent)}
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 14,
                      background: "var(--brand)",
                      marginLeft: 2,
                      verticalAlign: "middle",
                      animation: "pulse 1s infinite",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="chat-composer">
          <div className="composer-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                session?.user
                  ? "输入你的命理问题，Shift+Enter 换行..."
                  : "登录后可使用 AI 解盘功能"
              }
              disabled={streaming || !session?.user}
              rows={1}
              className="composer-input"
            />
            <button
              type="button"
              className="composer-send"
              onClick={handleSend}
              disabled={streaming || !input.trim() || !session?.user}
              title="发送（Enter）"
              aria-label="发送"
            >
              {streaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <i className="ti ti-send" />
              )}
            </button>
          </div>
          <div className="composer-hint">
            每次 AI 解盘消耗 <strong style={{ color: "var(--brand)" }}>2 星币</strong> · 年卡会员 7 折
          </div>
        </div>
      </div>

      {/* 调试面板 */}
      {activeDebug && (
        <HybridDebugPanel
          open={!!activeDebug}
          onClose={() => setActiveDebug(null)}
          debugInfo={activeDebug as HybridDebugInfo}
        />
      )}
    </>
  );
}

// ── 工具函数 ─────────────────────────────────────────────

function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "var(--brand)", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
