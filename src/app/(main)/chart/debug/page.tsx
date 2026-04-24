"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileText, Cpu, ArrowLeft, Search } from "lucide-react";
import {
  RAG_DEBUG_STORAGE_KEY,
  type RagDebugStoredData,
} from "@/lib/rag/rag-debug-shared";

/** 片段展开/折叠 */
function HitItem({ hit }: { hit: { index: number; sourceFile: string; textLength: number; preview: string } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded border border-border/60 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        <span className="font-medium">
          片段 {hit.index} — {hit.sourceFile || "(未知来源)"}
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {hit.textLength} 字
        </Badge>
      </button>
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
            {hit.preview}
          </pre>
        </div>
      )}
    </div>
  );
}

/** 消息区块 */
function MessageBlock({
  label,
  content,
  defaultOpen = false,
}: {
  label: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/80 bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {label}
        </span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {content.length} 字
        </Badge>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-4">
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

const roleLabel: Record<string, string> = {
  system: "System（系统 / 人设与规则 + 知识库）",
  user: "User（用户 / 命盘数据 + 任务指令）",
  assistant: "Assistant",
};

export default function RagDebugPage() {
  const router = useRouter();
  const [data, setData] = useState<RagDebugStoredData | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(RAG_DEBUG_STORAGE_KEY);
    if (!raw) {
      router.back();
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      router.back();
    }
  }, [router]);

  /** 确认调用：存标记后返回命盘页，由命盘页读取标记并触发 execute */
  const handleConfirm = () => {
    if (!data) return;
    // CHAT 类型：从 sessionStorage 读取之前存储的消息
    if (data.category === "CHAT") {
      const storedMessagesRaw = sessionStorage.getItem("rag_chat_debug_messages") || "[]";
      const storedMessages = JSON.parse(storedMessagesRaw);
      sessionStorage.setItem("rag_chat_debug_execute", JSON.stringify({
        contextId: data.contextId,
        messages: storedMessages,
      }));
      router.back();
      return;
    }
    // 业务版块：存标记后返回命盘页，由 analysis-panel 处理
    sessionStorage.setItem("rag_debug_execute", JSON.stringify({
      contextId: data.contextId,
      category: data.category,
    }));
    router.back();
  };

  const handleCancel = () => {
    sessionStorage.removeItem(RAG_DEBUG_STORAGE_KEY);
    router.back();
  };

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* 标题 */}
      <div className="mb-6">
        <button
          type="button"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
          返回命盘页
        </button>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          RAG 调试 — {data.categoryLabel}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          以下为发给大模型的完整上下文。确认无误后点击底部「确认调用 AI 分析」。
        </p>
      </div>

      {/* 检索词 */}
      {data.queryTexts && data.queryTexts.length > 0 && (
        <div className="mb-6 rounded-lg border border-green-200/60 bg-green-50/30 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-green-700">
            <Search className="h-4 w-4" />
            <span>向量库检索词（共 {data.queryTexts.length} 条）</span>
          </div>
          <div className="space-y-3">
            {data.queryTexts.map((qt, i) => (
              <div key={i} className="rounded border border-border/40 bg-background/80 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    检索词 {i + 1}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {qt.length} 字
                  </span>
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
                  {qt}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG 检索结果 */}
      {data.ragMeta && (
        <div className="mb-6 rounded-lg border border-blue-200/60 bg-blue-50/30 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-blue-700">
            <Cpu className="h-4 w-4" />
            <span>
              RAG 检索结果：{data.ragMeta.totalHits} 片段，共{" "}
              {data.ragMeta.knowledgeLength} 字
            </span>
            {data.ragMeta.truncated && (
              <Badge variant="destructive" className="text-[10px]">已截断</Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              topk={data.ragMeta.topk}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {data.ragMeta.provider}/{data.ragMeta.modelId}
            </Badge>
          </div>

          {/* 过滤链 */}
          {data.ragMeta.filterSteps.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">过滤链：</div>
              <div className="flex flex-wrap gap-1.5">
                {data.ragMeta.filterSteps.map((step, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60"
                  >
                    {step.label}
                    <span className="font-medium text-foreground">{step.hitCount} 条</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 命中片段 */}
          <div className="space-y-1.5">
            {data.ragMeta.hits.map((hit) => (
              <HitItem key={hit.index} hit={hit} />
            ))}
          </div>
        </div>
      )}

      {/* Prompt 消息 */}
      <div className="space-y-4">
        {data.promptMessages.map((m, i) => (
          <MessageBlock
            key={i}
            label={roleLabel[m.role] ?? m.role}
            content={m.content}
          />
        ))}
      </div>

      {/* 底部操作栏 */}
      <div className="sticky bottom-0 mt-8 flex items-center justify-between border-t bg-background/95 py-4 backdrop-blur">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          取消
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={executing}
          className="bg-primary hover:bg-primary/90"
        >
          确认调用 AI 分析
        </Button>
      </div>
    </div>
  );
}
