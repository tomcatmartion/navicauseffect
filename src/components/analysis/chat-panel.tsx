"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RAG_DEBUG_STORAGE_KEY,
  type RagDebugStoredData,
} from "@/lib/rag/rag-debug-shared";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
}

interface ChatPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  astrolabeData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  horoscopeData?: any;
  modelId?: string;
}

export function ChatPanel({
  astrolabeData,
  horoscopeData,
  modelId,
}: ChatPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamReasoning, setStreamReasoning] = useState("");
  const [ragDebugMode, setRagDebugMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检查是否有待执行的对话调试确认（从 debug 页面返回）
  useEffect(() => {
    const chatExecuteMarker = sessionStorage.getItem("rag_chat_debug_execute");
    if (!chatExecuteMarker) return;

    sessionStorage.removeItem("rag_chat_debug_execute");
    const storedMessagesRaw = sessionStorage.getItem("rag_chat_debug_messages");
    sessionStorage.removeItem("rag_chat_debug_messages");

    try {
      const { contextId } = JSON.parse(chatExecuteMarker);
      const storedMessages: ChatMessage[] = storedMessagesRaw ? JSON.parse(storedMessagesRaw) : [];

      if (storedMessages.length === 0) return;

      // 设置消息状态
      setMessages(storedMessages);
      setStreaming(true);
      setStreamContent("");

      // 直接调用 chat API
      fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: storedMessages,
          astrolabeData,
          horoscopeData,
          modelId,
          contextId,
        }),
      }).then(response => {
        if (!response.ok) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `[错误] 请求失败` },
          ]);
          setStreaming(false);
          return;
        }
        // 流式处理
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
        let accumulatedReasoning = "";
        let sseCarry = "";

        const processStream = async () => {
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
                  choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
                };
                const delta = parsed.choices?.[0]?.delta;
                const reasoningPiece = typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "";
                const contentPiece = typeof delta?.content === "string" ? delta.content : "";
                if (reasoningPiece) {
                  accumulatedReasoning += reasoningPiece;
                  setStreamReasoning(accumulatedReasoning);
                }
                if (contentPiece) {
                  accumulated += contentPiece;
                  setStreamContent(accumulated);
                }
              } catch {
                // 半行 JSON，跳过
              }
            }
            if (done) break;
          }

          // 流结束，追加 assistant 消息
          if (accumulated) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: accumulated, reasoning: accumulatedReasoning || undefined },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "未收到回复内容，请重试。" },
            ]);
          }
          setStreamContent("");
          setStreamReasoning("");
          setStreaming(false);
        };

        processStream().catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "网络错误" },
          ]);
          setStreaming(false);
        });
      }).catch(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "网络错误" },
        ]);
        setStreaming(false);
      });
    } catch {
      // ignore
    }
  }, [astrolabeData, horoscopeData, modelId]);

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

  const sendMessage = useCallback(async (text: string) => {
    if (!text || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];

    // RAG 调试模式：先获取上下文，不调 LLM
    if (ragDebugMode) {
      setInput("");
      setStreaming(true);
      try {
        const response = await fetch("/api/analysis/chat-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            astrolabeData,
            horoscopeData,
            modelId,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          setMessages(newMessages); // 调试模式失败也显示用户消息
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `获取上下文失败: ${err.error || "请稍后重试"}` },
          ]);
          setStreaming(false);
          return;
        }
        const data = await response.json();
        // 存入 sessionStorage 并导航到调试页面（消息也存进去，确认后使用）
        const stored: RagDebugStoredData = {
          contextId: data.contextId,
          queryTexts: data.queryTexts ?? [],
          promptMessages: data.promptMessages ?? [],
          ragMeta: data.ragMeta ?? null,
          category: "CHAT",
          categoryLabel: "AI 对话",
        };
        sessionStorage.setItem(RAG_DEBUG_STORAGE_KEY, JSON.stringify(stored));
        // 同时存储用户消息，等确认后使用
        sessionStorage.setItem("rag_chat_debug_messages", JSON.stringify(newMessages));
        setStreaming(false);
        router.push("/chart/debug");
        return;
      } catch (err) {
        console.error("RAG context error:", err);
        setMessages(newMessages);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "获取上下文时出现错误，请稍后重试。" },
        ]);
        setStreaming(false);
        return;
      }
    }

    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamContent("");

    try {
      const response = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          astrolabeData,
          horoscopeData,
          modelId,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setStreamContent(`[错误] ${err.error || "请求失败，请重试"}`);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `[错误] ${err.error || "请求失败"}`,
          },
        ]);
        setStreaming(false);
        return;
      }

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
      let accumulatedReasoning = "";
      let sseCarry = "";

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
              choices?: Array<{
                delta?: { content?: string; reasoning_content?: string };
              }>;
            };
            const delta = parsed.choices?.[0]?.delta;
            const reasoningPiece = typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "";
            const contentPiece = typeof delta?.content === "string" ? delta.content : "";
            if (reasoningPiece) {
              accumulatedReasoning += reasoningPiece;
              setStreamReasoning(accumulatedReasoning);
            }
            if (contentPiece) {
              accumulated += contentPiece;
              setStreamContent(accumulated);
            }
          } catch {
            // 半行 JSON，跳过
          }
        }

        if (done) break;
      }

      // 流结束，追加 assistant 消息
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated, reasoning: accumulatedReasoning || undefined },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "未收到回复内容，请重试。" },
        ]);
      }
      setStreamContent("");
      setStreamReasoning("");
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络错误，请检查连接后重试。" },
      ]);
      setStreamContent("");
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, ragDebugMode, router, astrolabeData, horoscopeData, modelId]);

  /** 从输入框发送（包装 sendMessage） */
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
    <Card className="flex flex-col border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <MessageCircle className="h-4 w-4" />
            AI 命理对话
          </CardTitle>
          <button
            type="button"
            onClick={() => setRagDebugMode(!ragDebugMode)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
              ragDebugMode
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            title={ragDebugMode ? "调试模式已开启" : "开启调试模式"}
          >
            <Bug className="h-3 w-3" />
            {ragDebugMode ? "调试" : "调试"}
          </button>
        </div>
        {ragDebugMode && (
          <Badge variant="outline" className="mt-1 text-[10px] text-green-600 border-green-200">
            调试模式：发送消息前会先显示 RAG 检索词
          </Badge>
        )}
        {!ragDebugMode && (
          <p className="text-xs text-muted-foreground">
            基于当前命盘与 AI 自由对话，深入探讨命理问题
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-primary/10 bg-muted/20 p-3"
          style={{ minHeight: "200px", maxHeight: "400px" }}
        >
          {messages.length === 0 && !streamContent && (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-4">
              <p className="text-xs text-muted-foreground">点击问题快速开始对话</p>
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
              {msg.reasoning && <ReasoningBlock reasoning={msg.reasoning} />}
              <div className="whitespace-pre-wrap leading-relaxed">
                {renderContent(msg.content)}
              </div>
            </div>
          ))}
          {/* 流式输出 */}
          {streamReasoning && !streamContent && (
            <div className="mb-3 mr-4 rounded-lg border border-blue-200/60 bg-blue-50/40 px-3 py-2 dark:border-blue-800/40 dark:bg-blue-950/20">
              <div className="mb-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                AI 深度思考中...
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground max-h-40 overflow-y-auto">
                {streamReasoning}
              </div>
            </div>
          )}
          {streamContent && (
            <div className="mb-3 mr-4 rounded-lg bg-card px-3 py-2 text-sm">
              <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                AI 解读
              </div>
              {streamReasoning && <ReasoningBlock reasoning={streamReasoning} />}
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
                : "登录后可使用 AI 对话功能"
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
  );
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

/** 可折叠的 AI 思考过程展示 */
function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded border border-blue-200/60 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-950/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded transition-colors"
      >
        <span className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        AI 深度思考过程
        <span className="ml-auto text-[10px] text-muted-foreground">{reasoning.length} 字</span>
      </button>
      {open && (
        <div className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}
