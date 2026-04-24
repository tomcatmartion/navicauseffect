"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, X, FileText, Cpu } from "lucide-react";

/** RAG 命中片段 */
export type RagHitItem = {
  index: number;
  sourceFile: string;
  textLength: number;
  preview: string;
};

/** 过滤链单步 */
export type FilterStep = {
  label: string;
  hitCount: number;
};

/** 从 /api/analysis/context 返回的 ragMeta */
export type RagMeta = {
  knowledgeLength: number;
  topk: number;
  truncated: boolean;
  filterSteps: FilterStep[];
  hits: RagHitItem[];
  totalHits: number;
  provider: string;
  modelId: string;
};

/** prompt 消息 */
export type PromptMessageLite = { role: string; content: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  promptMessages: PromptMessageLite[];
  ragMeta: RagMeta | null;
};

/** 单个片段的展开/折叠 */
function HitItem({ hit }: { hit: RagHitItem }) {
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

/** 可折叠的消息区块 */
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
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
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
        <div className="border-t border-border/40 px-3 py-3">
          <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
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

export function RagDebugPanel({
  open,
  onClose,
  onConfirm,
  promptMessages,
  ragMeta,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="RAG 调试面板"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="relative z-[301] flex h-[min(90vh,960px)] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* 标题栏 */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 text-left">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              RAG 调试面板
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              以下为发给大模型的完整上下文。确认无误后点击「确认调用」。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 [scrollbar-gutter:stable] sm:px-6 sm:py-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="space-y-4 pb-1">
            {/* RAG 检索结果 */}
            {ragMeta && (
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/30 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-blue-700">
                  <Cpu className="h-4 w-4" />
                  <span>
                    RAG 检索结果：{ragMeta.totalHits} 片段，共{" "}
                    {ragMeta.knowledgeLength} 字
                  </span>
                  {ragMeta.truncated && (
                    <Badge variant="destructive" className="text-[10px]">
                      已截断
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    topk={ragMeta.topk}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {ragMeta.provider}/{ragMeta.modelId}
                  </Badge>
                </div>

                {/* 过滤链 */}
                {ragMeta.filterSteps.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      过滤链：
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ragMeta.filterSteps.map((step, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60"
                        >
                          {step.label}
                          <span className="font-medium text-foreground">
                            {step.hitCount} 条
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 命中片段列表 */}
                <div className="space-y-1.5">
                  {ragMeta.hits.map((hit) => (
                    <HitItem key={hit.index} hit={hit} />
                  ))}
                </div>
              </div>
            )}

            {/* Prompt 消息 */}
            {promptMessages.map((m, i) => (
              <MessageBlock
                key={i}
                label={roleLabel[m.role] ?? m.role}
                content={m.content}
              />
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={onConfirm}>
            确认调用 AI 分析
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
