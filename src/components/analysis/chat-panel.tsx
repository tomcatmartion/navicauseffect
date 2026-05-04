"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
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
  const [skeletonText, setSkeletonText] = useState(""); // 骨架屏文本（立即显示）
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null);
  const [activeDebug, setActiveDebug] = useState<PipelineDebugInfo | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检测用户是否手动滚动过消息容器（流式时也检测，便于中途上滑阅读）
  const handleContainerScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolled(distanceFromBottom > 50 && messages.length > 0);
  }, [messages.length]);

  /** 仅在消息列表容器内滚到底，避免 scrollIntoView 带动整页 document 滚动 */
  const scrollMessagesToBottom = useCallback((behavior: "auto" | "smooth" = "auto") => {
    const root = messagesContainerRef.current;
    if (!root) return;
    if (behavior === "smooth" && typeof root.scrollTo === "function") {
      root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
    } else {
      root.scrollTop = root.scrollHeight;
    }
  }, []);

  // 新消息落库后：仅在用户未上滑时滚到底（只动消息区，不滚整页）
  useEffect(() => {
    if (!streaming && !userScrolled && messages.length > 0) {
      scrollMessagesToBottom("smooth");
    }
  }, [messages, streaming, userScrolled, scrollMessagesToBottom]);

  // 流式输出时仅在消息区内跟随到底，不触发整页滚动
  useLayoutEffect(() => {
    if (!streaming || !streamContent) return;
    if (userScrolled) return;
    scrollMessagesToBottom("auto");
  }, [streamContent, streaming, userScrolled, scrollMessagesToBottom]);

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

    // ── 1. 立即显示骨架，让用户立刻看到反馈 ──────────────
    setStreamContent("正在分析您的命盘，请稍候..."); // 骨架文本立即显示
    setStreaming(true);
    setUserScrolled(false);

    // 立即显示用户消息（骨架在 streamContent 区显示，不加入 messages 列表）
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      setInput(""); // 清空输入框
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
        setStreamContent(`[错误] ${(err as Record<string, string>).error || "请求失败"}`);
        setStreaming(false);
        return;
      }

      // 非 SSE 响应（同步模式兜底）
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json() as { reply?: string; sessionId?: string };
        if (data.sessionId) setReadingSessionId(data.sessionId);
        setStreamContent(data.reply || "未收到回复");
        setStreaming(false);
        return;
      }

      // SSE 流式处理
      const reader = response.body?.getReader();
      if (!reader) {
        setStreamContent("无法读取响应流");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let sseCarry: string[] = [];
      let currentDebugInfo: PipelineDebugInfo | undefined;

      while (true) {
        const { done, value } = await reader.read();
        sseCarry.push(decoder.decode(value ?? new Uint8Array(), { stream: !done }));

        // 每次处理所有已接收的行，剩余不完整的保持在校验数组中
        const allReceived = sseCarry.join('');
        const lines = allReceived.split('\n');
        sseCarry = lines.length > 0 ? [lines[lines.length - 1]] : [];
        const lastLineIsComplete = allReceived.endsWith('\n');
        if (!lastLineIsComplete && lines.length > 0) {
          sseCarry = [lines[lines.length - 1]];
        }

        for (let li = 0; li < lines.length - (lastLineIsComplete ? 0 : 1); li++) {
          const raw = lines[li];
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

            if (parsed.sessionId && !readingSessionId) {
              setReadingSessionId(parsed.sessionId);
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

      // 流结束，最终内容写入 messages
      if (accumulated) {
        setMessages((prev) => {
          // 替换骨架消息为真实内容
          const lastIdx = prev.length - 1;
          return [
            ...prev.slice(0, lastIdx),
            { role: "assistant", content: accumulated, debugInfo: currentDebugInfo },
          ];
        });
      } else {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          return [
            ...prev.slice(0, lastIdx),
            { role: "assistant", content: "未收到回复内容，可能是网络超时，请稍后重试。" },
          ];
        });
      }
      setStreamContent("");
    } catch (err) {
      console.error("Reading error:", err);
      setStreamContent("网络错误，请检查连接后重试。");
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
        <div ref={messagesContainerRef} onScroll={handleContainerScroll} className="flex-1 overflow-y-auto rounded-lg border border-primary/10 bg-muted/20 p-3"
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
