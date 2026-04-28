"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, MessageCircle, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineDebugInfo } from "@/lib/ziwei/rag/types";
import { ReadingDebugPanel } from "./reading-debug-panel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 调试信息（仅 assistant 消息有） */
  debugInfo?: PipelineDebugInfo;
}

interface ChatPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  astrolabeData: any;
  /** 出生数据，用于服务端计算运限（大限/流年/小限） */
  birthData?: {
    gender: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;
  } | null;
}

export function ChatPanel({
  astrolabeData,
  birthData,
}: ChatPanelProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null);
  const [activeDebug, setActiveDebug] = useState<PipelineDebugInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  /**
   * 发送消息 — 调用四步 RAG 精准召回管道
   *
   * 首次发送时携带 chartData，后续通过 sessionId 复用会话
   */
  const sendMessage = useCallback(async (text: string) => {
    if (!text || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setStreamContent("");

    try {
      // 构造请求体：首次带 chartData，后续只带 sessionId
      const requestBody: Record<string, unknown> = {
        question: text,
        stream: true,
      };

      if (readingSessionId) {
        requestBody.sessionId = readingSessionId;
      } else if (astrolabeData) {
        // 首次发送，序列化命盘数据（含出生信息供服务端计算运限）
        requestBody.chartData = serializeAstrolabe(astrolabeData, birthData);
      }

      const response = await fetch("/api/ziwei/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `[错误] ${(err as Record<string, string>).error || "请求失败"}` },
        ]);
        setStreaming(false);
        return;
      }

      // 非 SSE 响应（同步模式兜底）
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json() as { reply?: string; sessionId?: string };
        if (data.sessionId) setReadingSessionId(data.sessionId);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "未收到回复" },
        ]);
        setStreaming(false);
        return;
      }

      // SSE 流式处理
      const reader = response.body?.getReader();
      if (!reader) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "无法读取响应流" },
        ]);
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let sseCarry = "";
      let currentDebugInfo: PipelineDebugInfo | undefined;

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
            const parsed = JSON.parse(payload) as {
              text?: string;
              sessionId?: string;
              error?: string;
              type?: string;
              debugInfo?: PipelineDebugInfo;
            };

            // 从首个事件中提取 sessionId
            if (parsed.sessionId && !readingSessionId) {
              setReadingSessionId(parsed.sessionId);
            }

            // 捕获调试信息
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

      // 流结束，追加 assistant 消息（含调试信息）
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated, debugInfo: currentDebugInfo },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "未收到回复内容，请重试。" },
        ]);
      }
      setStreamContent("");
    } catch (err) {
      console.error("Reading error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络错误，请检查连接后重试。" },
      ]);
      setStreamContent("");
    } finally {
      setStreaming(false);
    }
  }, [streaming, readingSessionId, astrolabeData]);

  /** 从输入框发送 */
  const handleSend = () => sendMessage(input.trim());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  /** 预置问题 */
  const presetQuestions = [
    "我的事业运如何？",
    "我明年的财运怎么样？",
    "我后年能结婚吗？",
    "我最适合的职业方向有哪些？",
    "我的家庭关系怎么样？",
  ];

  return (
    <>
    <Card className="flex flex-col border-primary/15">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          <MessageCircle className="h-4 w-4" />
          AI 精准解盘
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          基于规则库+技法库+知识库的四步精准召回，深入解读命盘
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-primary/10 bg-muted/20 p-3"
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
              {/* 调试按钮：仅 assistant 消息且含调试数据时显示 */}
              {msg.role === "assistant" && msg.debugInfo && (
                <div className="mt-2 flex justify-end border-t border-border/30 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveDebug(msg.debugInfo ?? null)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Bug className="h-3 w-3" />
                    查看 RAG 调试信息
                  </button>
                </div>
              )}
              {/* 无调试数据时的提示 */}
              {msg.role === "assistant" && !msg.debugInfo && i > 0 && (
                <div className="mt-2 flex justify-end border-t border-border/30 pt-1.5">
                  <span className="text-[10px] text-muted-foreground/50">
                    调试数据不可用（重新发送问题可获取）
                  </span>
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
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>

      {/* 调试面板 */}
      {activeDebug && (
        <ReadingDebugPanel
          open={!!activeDebug}
          onClose={() => setActiveDebug(null)}
          debugInfo={activeDebug}
        />
      )}
    </>
  );
}

/**
 * 将 iztro FunctionalAstrolabe 对象序列化为可传输的 JSON
 * 提取命盘核心字段：基本信息 + 各宫星曜 + 出生数据（供服务端计算运限）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAstrolabe(astrolabe: any, birthDataParam?: ChatPanelProps['birthData']): Record<string, unknown> {
  if (!astrolabe) return {};

  // iztro FunctionalAstrolabe 的核心字段
  const result: Record<string, unknown> = {
    name: astrolabe.name ?? "命主",
    gender: astrolabe.gender ?? "male",
    soul: astrolabe.soul ?? "",
    body: astrolabe.body ?? "",
    fiveElementsClass: astrolabe.fiveElementsClass ?? "",
    // 十二宫数据（含主星、辅星、四化）
    palaces: (astrolabe.palaces ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({
        name: p.name ?? "",
        majorStars: (p.majorStars ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s: any) => ({
            name: s.name ?? "",
            type: s.type ?? "",
            mutagen: s.mutagen ?? "",
          })
        ),
        minorStars: (p.minorStars ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s: any) => ({
            name: s.name ?? "",
            type: s.type ?? "",
            mutagen: s.mutagen ?? "",
          })
        ),
      })
    ),
  };

  // 出生数据（供服务端 iztro 重建命盘计算运限）
  if (birthDataParam) {
    result.birthInfo = {
      year: birthDataParam.year,
      month: birthDataParam.month,
      day: birthDataParam.day,
      hour: birthDataParam.hour,
      gender: birthDataParam.gender === "MALE" ? "男" : birthDataParam.gender,
      solar: birthDataParam.solar ?? true,
    };
  }

  return result;
}

/** 简易 Markdown 渲染：加粗 + 换行 */
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
