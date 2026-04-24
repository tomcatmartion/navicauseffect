"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type PromptMessageLite = { role: string; content: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: PromptMessageLite[];
  title?: string;
};

const roleLabel: Record<string, string> = {
  system: "System（系统 / 人设与规则）",
  user: "User（用户 / 命盘与任务）",
  assistant: "Assistant",
};

/**
 * 使用 Portal + 高层 z-index，避免与顶栏/底栏（多为 z-50）同层被挡住；
 * 与 radix Dialog 解耦，不依赖同文件内 Overlay 的 stacking。
 */
export function PromptPreviewDialog({
  open,
  onOpenChange,
  messages,
  title = "本次调用大模型的 Prompt",
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
      aria-labelledby="prompt-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="关闭预览"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-[301] flex h-[min(88vh,900px)] max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 text-left">
            <h2
              id="prompt-preview-title"
              className="font-[var(--font-serif-sc)] text-base font-semibold text-foreground sm:text-lg"
            >
              {title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              以下为实际发送给模型的消息（含 logicdoc 注入的 system 后缀）。关闭后仍可继续阅读生成结果。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {/*
          flex 子项默认 min-height:auto 会按内容撑满，导致无法出现滚动条。
          flex-1 + min-h-0 占满标题与底部之间的剩余高度，overflow-y-auto 在此区域内滚动。
        */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 [scrollbar-gutter:stable] sm:px-6 sm:py-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="space-y-4 pb-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/80 bg-muted/30 p-3 sm:p-4"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {roleLabel[m.role] ?? m.role}
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground sm:text-xs">
                  {m.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t bg-background px-4 py-3 sm:px-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
