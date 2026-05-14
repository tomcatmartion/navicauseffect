"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, X, Cpu, Layers, Timer, Target, Zap } from "lucide-react";

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
