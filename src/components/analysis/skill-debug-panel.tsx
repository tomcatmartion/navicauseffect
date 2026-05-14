"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, X, Sparkles, Database, BookOpen, FileText, Wrench, Cpu } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  debugInfo: {
    architecture: string;
    question: string;
    domain: string;
    queryTasks: Array<{ category: string; name: string; subKey?: string }>;
    rulesContext: string;
    knowledgeResults: Array<{ category: string; name: string; subKey?: string; result: string }>;
    fullPrompt: string;
    fallbackCallCount: number;
    fallbackCalls: Array<{ round: number; tool: string; args: Record<string, unknown>; result: string }>;
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

export function SkillDebugPanel({ open, onClose, debugInfo }: Props) {
  if (!open) return null;

  const {
    question,
    domain,
    queryTasks,
    rulesContext,
    knowledgeResults,
    fullPrompt,
    fallbackCallCount,
    fallbackCalls,
  } = debugInfo;

  return open ? createPortal(
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
                Skill 混合架构调试面板
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                知识直灌 + 5% 兜底调用
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
              {/* 问题与领域 */}
              <Section label="问题与领域" icon={Cpu} defaultOpen={true}>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="mr-2 text-muted-foreground">用户问题：</span>
                    <span className="font-medium text-foreground">{question}</span>
                  </div>
                  <div>
                    <span className="mr-2 text-muted-foreground">识别领域：</span>
                    <Badge variant="outline" className="text-[10px]">
                      {domain}
                    </Badge>
                  </div>
                  <div>
                    <span className="mr-2 text-muted-foreground">架构：</span>
                    <Badge variant="outline" className="text-[10px]">
                      {debugInfo.architecture}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">（
                      {fallbackCallCount === 0 ? (
                        <span className="text-green-600">无兜底调用</span>
                      ) : (
                        <span className="text-orange-600">{fallbackCallCount} 轮兜底调用</span>
                      )}
                    ）</span>
                  </div>
                </div>
              </Section>

              {/* 查询任务清单 */}
              <Section
                label="查询任务清单"
                icon={Database}
                badge={`${queryTasks.length} 个`}
                defaultOpen={true}
              >
                <div className="space-y-2">
                  {queryTasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
                      <div className="flex-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        <Badge variant="outline" className="mr-1 text-[10px]">
                          {task.category}
                        </Badge>
                        {task.name}
                        {task.subKey && (
                          <span className="text-muted-foreground">（{task.subKey}）</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 知识库查询结果 */}
              <Section
                label="知识库查询结果"
                icon={BookOpen}
                badge={`${knowledgeResults.length} 条`}
              >
                {knowledgeResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">无命中知识</p>
                ) : (
                  <div className="space-y-2">
                    {knowledgeResults.map((kr, i) => (
                      <div key={i} className="rounded border border-border/60 bg-muted/20 p-2">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{i + 1}.</span>
                          <Badge variant="outline" className="text-[10px]">
                            {kr.category}
                          </Badge>
                          <span className="text-xs font-medium">
                            {kr.name}
                          </span>
                          {kr.subKey && (
                            <span className="text-xs text-muted-foreground">（{kr.subKey}）</span>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-foreground/80">
                          {kr.result.slice(0, 200)}
                          {kr.result.length > 200 && "..."}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* 兜底调用详情 */}
              {fallbackCalls.length > 0 && (
                <Section
                  label="兜底调用"
                  icon={Wrench}
                  badge={`${fallbackCalls.length} 次`}
                >
                  <div className="space-y-2 text-xs">
                    {fallbackCalls.map((fc, i) => (
                      <div key={i} className="rounded border border-orange-200 bg-orange-50 p-2">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="destructive" className="text-[10px]">
                            第 {fc.round} 轮
                          </Badge>
                          <span className="font-medium">{fc.tool}</span>
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                          {JSON.stringify(fc.args, null, 2)}
                        </pre>
                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-green-600">
                          {fc.result.slice(0, 100)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 完整 Prompt */}
              <Section
                label="完整 Prompt"
                icon={FileText}
                badge={`${fullPrompt.length} 字`}
                defaultOpen={false}
              >
                <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
                  {fullPrompt}
                </pre>
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
  ) : null;
}
