"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bug, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineDebugInfo } from "@/lib/ziwei/rag/types";
import { SkillDebugInfo } from "@/lib/ziwei/rag/pipeline";
import type { HybridDebugInfo } from "@/lib/ziwei/rag/pipeline.hybrid";
import { HybridDebugPanel } from "./hybrid-debug-panel";
import { serializeAstrolabeForReading } from "@/lib/ziwei/serialize-chart-for-reading";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  debugInfo?: PipelineDebugInfo | SkillDebugInfo | HybridDebugInfo;
}

interface DualChatPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  astrolabeData: any;
  birthData?: {
    gender: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAstrolabe(astrolabe: any, birthDataParam?: DualChatPanelProps["birthData"]): Record<string, unknown> {
  if (!birthDataParam) return serializeAstrolabeForReading(astrolabe);
  return serializeAstrolabeForReading(astrolabe, {
    year: birthDataParam.year,
    month: birthDataParam.month,
    day: birthDataParam.day,
    hour: birthDataParam.hour,
    gender: birthDataParam.gender,
    solar: birthDataParam.solar ?? true,
  });
}

export function DualChatPanel({ astrolabeData, birthData }: DualChatPanelProps) {
  const { data: session } = useSession();

  // ── Hybrid（程序模型混合）状态 ─────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [activeDebug, setActiveDebug] = useState<PipelineDebugInfo | SkillDebugInfo | HybridDebugInfo | null>(null);
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

    const chartPayload = astrolabeData ? serializeAstrolabe(astrolabeData, birthData) : null;

    const body: Record<string, unknown> = { question: text, stream: true, architecture: "hybrid" };
    if (sessionId) {
      body.sessionId = sessionId;
    } else if (chartPayload) {
      body.chartData = chartPayload;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let currentDebugInfo: any;

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed = JSON.parse(payload) as any;

            if (parsed.sessionId && !sessionId) {
              setSessionId(parsed.sessionId);
            }

            if (parsed.type === "debug" && parsed.debugInfo) {
              currentDebugInfo = parsed.debugInfo;
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
  }, [streaming, astrolabeData, birthData, sessionId]);

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
      <Card className="flex h-full flex-col border-primary/15">
        <CardHeader className="pb-0 shrink-0">
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <MessageCircle className="h-4 w-4" />
            AI 精准解盘
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-3 overflow-hidden">
          {/* 流式输出状态提示 */}
          {streaming && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary/80">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>正在调动各类知识，结合科学与玄学全面分析，请稍候...</span>
            </div>
          )}

          {/* 消息列表 */}
          <div ref={messagesContainerRef} onScroll={handleContainerScroll}
            className="flex-1 overflow-y-auto rounded-lg border border-primary/10 bg-muted/20 p-3"
            style={{ minHeight: "200px", maxHeight: "min(400px, 50vh)" }}
          >
            {messages.length === 0 && !streamContent && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-4">
                <p className="text-xs text-muted-foreground">点击问题快速开始解盘</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {presetQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      disabled={streaming || !session?.user}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "mb-3 rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-8 bg-primary/10 text-foreground"
                    : "mr-4 bg-card text-foreground"
                )}
              >
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {msg.role === "user" ? "你" : "AI 解读"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {renderContent(msg.content)}
                </div>
                {/* 调试按钮 */}
                {msg.role === "assistant" && msg.debugInfo && (
                  <div className="mt-2 flex justify-end border-t border-border/30 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveDebug(msg.debugInfo ?? null)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Bug className="h-3 w-3" />
                      查看调试信息
                    </button>
                  </div>
                )}
              </div>
            ))}
            {/* 流式输出 */}
            {streamContent && (
              <div className="mb-3 mr-4 rounded-lg bg-card px-3 py-2 text-sm">
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                  AI 解读
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {renderContent(streamContent)}
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                session?.user
                  ? "输入你的命理问题..."
                  : "登录后可使用 AI 解盘功能"
              }
              disabled={streaming || !session?.user}
              rows={1}
              className="flex-1 resize-none rounded-md border border-primary/20 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={streaming || !input.trim() || !session?.user}
              size="sm"
              className="h-auto bg-primary px-4 hover:bg-primary/90"
            >
              {streaming ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">正在分析中...</span>
                </span>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 调试面板 — 仅 hybrid */}
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
      return <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
