"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { HybridDebugInfo } from "@/types/hybrid-debug";
import { HybridDebugPanel } from "./hybrid-debug-panel";
import { usePaywall } from "@/components/shared/paywall-dialog";
import { ErrorRetryCard } from "@/components/shared/error-retry-card";
import { generatePresetQuestions } from "@/lib/ziwei/preset-questions";
import { useRequirePhoneBinding } from "@/lib/auth/use-require-phone-binding";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  debugInfo?: HybridDebugInfo;
  /** O-09：失败时携带结构化错误信息，渲染为重试 Card */
  error?: {
    title: string;
    detail?: string;
    code?: string | number;
    /** 失败前用户发送的文本（用于一键重试） */
    retryText?: string;
  };
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
  /** 已保存命盘 ID，用于本地持久化对话历史（O-10） */
  chartRecordId?: string | null;
}

function hashChartData(chartData: Record<string, unknown> | null): string {
  if (!chartData) return "guest";
  try {
    const keys = ["gender", "year", "month", "day", "hour", "birthCity"];
    const parts = keys.map((k) => String((chartData as Record<string, unknown>)[k] ?? ""));
    return parts.join("-").replace(/\s+/g, "");
  } catch {
    return "guest";
  }
}

function getChatStorageKey(chartRecordId?: string | null, sessionId?: string | null, chartData?: Record<string, unknown> | null): string {
  const suffix = chartRecordId || sessionId || hashChartData(chartData ?? null);
  return `zw-chat-${suffix}`;
}

export function DualChatPanel({ chartData, parentBirthYears, chartRecordId }: DualChatPanelProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { showPaywall } = usePaywall();
  const requirePhoneBinding = useRequirePhoneBinding();

  // ── Hybrid（程序模型混合）状态 ─────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [activeDebug, setActiveDebug] = useState<HybridDebugInfo | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // O-10：对话历史本地持久化（刷新后恢复）
  const storageKey = useMemo(
    () => getChatStorageKey(chartRecordId, sessionId, chartData),
    [chartRecordId, sessionId, chartData],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { messages: ChatMessage[]; sessionId?: string | null };
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          if (parsed.sessionId) setSessionId(parsed.sessionId);
        }
      }
    } catch {
      // 解析失败忽略
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ messages, sessionId }));
    } catch {
      // 存储失败忽略（例如超出容量）
    }
  }, [messages, sessionId, storageKey]);

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

    // B-17：微信登录用户使用 AI 对话前强制绑定手机
    if (requirePhoneBinding()) return;

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
        // S-08：402 触发统一付费前置弹层
        if (res.status === 402) {
          showPaywall({
            reason: (err as Record<string, string>).code,
            message: (err as Record<string, string>).error,
            resource: "READING",
          });
          setMessages((prev) => prev.slice(0, -1)); // 撤回用户消息（保留输入）
          setInput(text);
          setStreaming(false);
          return;
        }
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "",
          error: {
            title: "AI 回复失败",
            detail: (err as Record<string, string>).error || "请求失败，请稍后重试",
            code: res.status,
            retryText: text,
          },
        }]);
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
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "",
        error: {
          title: "网络错误",
          detail: "无法连接到 AI 服务，请检查网络后重试",
          code: "NETWORK_ERROR",
          retryText: text,
        },
      }]);
      setStreamContent("");
    } finally {
      setStreaming(false);
      setUserScrolled(false);
    }
  }, [streaming, chartData, sessionId, parentBirthYears, requirePhoneBinding]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  const handleSend = () => sendMessage(input.trim());

  // S-03：新建对话（清空消息 + sessionId，开启新会话）
  const handleNewChat = useCallback(() => {
    if (streaming) return;
    if (messages.length > 0 && !window.confirm("确定要新建对话吗？当前对话将不会保留。")) {
      return;
    }
    setMessages([]);
    setSessionId(null);
    setInput("");
    setStreamContent("");
    setUserScrolled(false);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [streaming, messages.length, storageKey]);

  // S-17：根据命盘数据动态生成预设问题；无 chartData 时 fallback 5 个静态
  const presetQuestions = useMemo(() => generatePresetQuestions(chartData), [chartData]);

  return (
    <>
      <div className="chat-shell">
        {/* S-03：顶部工具栏（仅在有对话时显示「新建对话」） */}
        {messages.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "6px 8px",
              borderBottom: "1px solid var(--line-light)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleNewChat}
              disabled={streaming}
              title="清空当前对话，开始新的咨询"
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              <i className="ti ti-plus" /> 新建对话
            </button>
          </div>
        )}

        {/* 流式输出状态提示（用 testUI .tool-call 风格） */}
        {streaming && (
          <div
            className="tool-call"
            style={{ margin: "8px 2px 0" }}
          >
            <i
              className="ti ti-loader-2 ti-spin"
              style={{ marginRight: 6, fontSize: 12 }}
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
                {msg.error ? (
                  <ErrorRetryCard
                    title={msg.error.title}
                    detail={msg.error.detail}
                    code={msg.error.code}
                    retrying={streaming}
                    onRetry={() => {
                      const retryText = msg.error?.retryText;
                      if (!retryText) return;
                      // 移除失败消息后重发
                      setMessages((prev) => prev.filter((_, k) => k !== i));
                      sendMessage(retryText);
                    }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {renderContent(msg.content)}
                  </div>
                )}
                {msg.role === "assistant" && msg.debugInfo && isAdmin && (
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
                      <i className="ti ti-bug" style={{ fontSize: 12, marginRight: 4 }} />
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
          {/* 未登录：登录引导 banner */}
          {!session?.user && (
            <Link
              href="/auth/login?callbackUrl=%2Fchart"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                marginBottom: 8,
                background: "var(--soft)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                color: "inherit",
                fontSize: 12,
                transition: "background .15s",
              }}
            >
              <i
                className="ti ti-login"
                style={{ color: "var(--brand)", fontSize: 16 }}
              />
              <div style={{ flex: 1, color: "var(--text-muted)" }}>
                登录后即可开启 <strong style={{ color: "var(--brand)" }}>AI 智能解盘</strong>
                ，新用户注册即得 10 星币
              </div>
              <span
                style={{
                  background: "var(--brand)",
                  color: "#fff",
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                去登录
              </span>
            </Link>
          )}
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
                <i className="ti ti-loader-2 ti-spin" />
              ) : (
                <i className="ti ti-send" />
              )}
            </button>
          </div>
          <div className="composer-hint">
            {session?.user ? (
              <>
                {(session.user as { membershipPlan?: string }).membershipPlan &&
                (session.user as { membershipPlan?: string }).membershipPlan !== "FREE" ? (
                  <>
                    <i className="ti ti-crown" style={{ color: "var(--brand)" }} /> 您是
                    <strong style={{ color: "var(--brand)" }}>
                      {(session.user as { membershipPlan?: string }).membershipPlan === "YEARLY"
                        ? "年度"
                        : (session.user as { membershipPlan?: string }).membershipPlan === "QUARTERLY"
                          ? "季度"
                          : "月度"}
                      会员
                    </strong>
                    ，AI 对话<strong style={{ color: "var(--brand)" }}>免费</strong>
                  </>
                ) : (
                  <>
                    每次 AI 解盘消耗 <strong style={{ color: "var(--brand)" }}>2 星币</strong> ·{" "}
                    <Link
                      href="/pricing"
                      style={{ color: "var(--brand)", textDecoration: "underline" }}
                    >
                      开通会员免费
                    </Link>
                  </>
                )}
              </>
            ) : (
              <>
                每次 AI 解盘消耗 <strong style={{ color: "var(--brand)" }}>2 星币</strong> · 年卡会员 7 折
              </>
            )}
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
