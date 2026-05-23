"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, X, Cpu, Layers, Timer, MessageSquare } from "lucide-react";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  label?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  debugInfo: {
    architecture: "hybrid";
    stage: number;
    question: string;
    matterType?: string;
    palaceCount?: number;
    patternCount?: number;
    intentDetected?: string;
    fullPromptLength?: number;
    timing: Record<string, number>;
    promptMessages?: PromptMessage[];
  };
};

/** 可折叠的区块 */
function Section({
  label,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
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
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {label}
        </span>
        {badge && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {badge}
          </Badge>
        )}
      </button>
      {open && (
        <div className="border-t border-border/40 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** 阶段名称映射 */
const STAGE_NAMES: Record<number, string> = {
  1: "宫位评分",
  2: "性格定性 + 事项问诊",
  3: "事项分析",
  4: "互动关系分析",
};

/** 角色颜色映射 */
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  system: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-100",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  user: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  assistant: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-100",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
};

/** 单条 Prompt 消息卡片 */
function PromptMessageCard({ message, index }: { message: PromptMessage; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = ROLE_COLORS[message.role] ?? ROLE_COLORS.system;
  const displayLabel = message.label ?? message.role;
  const contentPreview = message.content.slice(0, 200);
  const hasMore = message.content.length > 200;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* 头部：角色标签 + 序号 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colors.badge}`}>
          #{index + 1}
        </span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {displayLabel}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {message.content.length} 字符
        </span>
      </div>

      {/* 内容区 */}
      <div className="px-3 py-2">
        <pre
          className={`text-[11px] leading-relaxed whitespace-pre-wrap font-mono ${colors.text} ${
            expanded ? "" : "line-clamp-6"
          }`}
          style={{ wordBreak: "break-word" }}
        >
          {expanded ? message.content : contentPreview}
          {!expanded && hasMore && "…"}
        </pre>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            {expanded ? "收起" : `展开全部 (${message.content.length} 字符)`}
          </button>
        )}
      </div>
    </div>
  );
}

export function HybridDebugPanel({ open, onClose, debugInfo }: Props) {
  if (!open) return null;

  const {
    stage,
    question,
    matterType,
    palaceCount,
    patternCount,
    intentDetected,
    fullPromptLength,
    timing,
    promptMessages,
  } = debugInfo;

  // 计算总耗时
  const timingEntries = Object.entries(timing);
  const totalMs = timingEntries.length > 0
    ? Math.max(...Object.values(timing))
    : 0;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-3 sm:p-4">
        <div className="relative flex h-[min(90vh,960px)] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          {/* 标题栏 */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 text-left">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                程序模型混合架构调试面板
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                确定性计算代码化 + LLM 只做表达 | 总耗时 {totalMs}ms
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
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="space-y-3 pb-1">
              {/* 阶段与问题 */}
              <Section label="阶段与问题" icon={Layers} defaultOpen={true}>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="mr-2 text-muted-foreground">用户问题：</span>
                    <span className="font-medium text-foreground">{question}</span>
                  </div>
                  <div>
                    <span className="mr-2 text-muted-foreground">当前阶段：</span>
                    <Badge variant="outline" className="text-[10px]">
                      阶段{stage} — {STAGE_NAMES[stage] ?? "未知"}
                    </Badge>
                  </div>
                  {matterType && (
                    <div>
                      <span className="mr-2 text-muted-foreground">事项类型：</span>
                      <Badge variant="outline" className="text-[10px]">
                        {matterType}
                      </Badge>
                    </div>
                  )}
                </div>
              </Section>

              {/* 计算结果 */}
              <Section label="确定性计算结果" icon={Cpu} defaultOpen={true}>
                <div className="space-y-2 text-xs">
                  {palaceCount !== undefined && (
                    <div>
                      <span className="mr-2 text-muted-foreground">宫位评分：</span>
                      <span className="font-medium">{palaceCount} 宫完成</span>
                    </div>
                  )}
                  {patternCount !== undefined && (
                    <div>
                      <span className="mr-2 text-muted-foreground">格局匹配：</span>
                      <span className="font-medium">{patternCount} 个格局</span>
                    </div>
                  )}
                  {intentDetected && (
                    <div>
                      <span className="mr-2 text-muted-foreground">意图识别：</span>
                      <Badge variant="outline" className="text-[10px]">
                        {intentDetected}
                      </Badge>
                    </div>
                  )}
                  {fullPromptLength !== undefined && (
                    <div>
                      <span className="mr-2 text-muted-foreground">Prompt 长度：</span>
                      <span className="font-medium">{fullPromptLength} 字符</span>
                    </div>
                  )}
                </div>
              </Section>

              {/* 耗时分析 */}
              <Section
                label="耗时分析"
                icon={Timer}
                badge={`${timingEntries.length} 步`}
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {timingEntries.map(([label, ms]) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-foreground">{ms}ms</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 组装后的 Prompt 消息 */}
              {promptMessages && promptMessages.length > 0 && (
                <Section
                  label="组装后的 Prompt 消息"
                  icon={MessageSquare}
                  badge={`${promptMessages.length} 条`}
                  defaultOpen={false}
                >
                  <div className="space-y-2">
                    {promptMessages.map((msg, index) => (
                      <PromptMessageCard key={index} message={msg} index={index} />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex shrink-0 items-center justify-end border-t bg-background px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
