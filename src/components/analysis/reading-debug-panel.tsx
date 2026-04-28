"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, X, Cpu, Clock, Target, BookOpen, Wrench, FileText } from "lucide-react";
import type { PipelineDebugInfo } from "@/lib/ziwei/rag/types";

type Props = {
  open: boolean;
  onClose: () => void;
  debugInfo: PipelineDebugInfo;
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

/** JSON 预览 */
function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

/** 标签列表 */
function TagList({ items, color = "text-blue-600 bg-blue-50" }: { items: string[]; color?: string }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">（无）</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function ReadingDebugPanel({ open, onClose, debugInfo }: Props) {
  if (!open) return null;

  const { step1, step2, step3, step4, yearResolution, timing } = debugInfo;

  // 耗时排序
  const timingEntries = Object.entries(timing).sort((a, b) => a[1] - b[1]);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="读取调试面板"
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
              RAG 读取调试面板
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              四步精准召回流水线的完整过程数据
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
          <div className="space-y-3 pb-1">
            {/* 耗时概览 */}
            <Section label="耗时分析" icon={Clock} defaultOpen={true}>
              <div className="flex flex-wrap gap-2">
                {timingEntries.map(([label, ms]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] ring-1 ring-border/60"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{ms}ms</span>
                  </span>
                ))}
              </div>
            </Section>

            {/* 年份解析 */}
            <Section
              label="年份解析"
              icon={Target}
              badge={yearResolution.targetYear ? `${yearResolution.targetYear}年` : "未指定"}
            >
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">原始问题：</span>
                  <span className="text-foreground">{yearResolution.originalQuestion}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">澄清问题：</span>
                  <span className="text-foreground">{yearResolution.clarifiedQuestion}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目标年份：</span>
                  <span className="font-medium text-primary">
                    {yearResolution.targetYear ?? "未检测到"}
                  </span>
                </div>
              </div>
            </Section>

            {/* Step 1：意图路由 */}
            <Section
              label="Step 1：意图路由 + 硬加载"
              icon={Target}
              badge={`规则${step1.rulesLength}字 · 技法${step1.techsLength}字`}
            >
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">领域：</span>
                  <TagList items={step1.domain.domains} color="text-green-600 bg-green-50" />
                </div>
                <div>
                  <span className="text-muted-foreground">时间范围：</span>
                  <Badge variant="outline" className="text-[10px]">{step1.domain.timeScope}</Badge>
                </div>
              </div>
            </Section>

            {/* Step 2：要素提取 */}
            <Section
              label="Step 2：要素提取"
              icon={Cpu}
              badge={`${step2.elements.palaces.length}宫 · ${step2.elements.stars.length}星`}
            >
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">追问：</span>
                  <span>{step2.isFollowUp ? "是" : "否"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">宫位：</span>
                  <TagList items={step2.elements.palaces} color="text-purple-600 bg-purple-50" />
                </div>
                <div>
                  <span className="text-muted-foreground">星曜：</span>
                  <TagList items={step2.elements.stars} color="text-blue-600 bg-blue-50" />
                </div>
                <div>
                  <span className="text-muted-foreground">四化：</span>
                  <TagList
                    items={step2.elements.sihua.map(s => `${s.star}${s.type}入${s.palace}(${s.source})`)}
                    color="text-orange-600 bg-orange-50"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground">格局：</span>
                  <TagList items={step2.elements.patterns} color="text-amber-600 bg-amber-50" />
                </div>
                <div>
                  <span className="text-muted-foreground">分析要点：</span>
                  <ul className="mt-1 space-y-0.5">
                    {step2.elements.analysisPoints.map((p, i) => (
                      <li key={i} className="text-foreground/80">· {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>

            {/* Step 3：知识召回 */}
            <Section
              label="Step 3：知识召回"
              icon={BookOpen}
              badge={`${step3.knowledgeCount} 条`}
            >
              {step3.knowledgeCount === 0 ? (
                <p className="text-xs text-muted-foreground">未命中知识片段</p>
              ) : (
                <div className="space-y-2">
                  {step3.knowledge.map((k, i) => (
                    <KnowledgeHitItem key={k.id} index={i + 1} chunk={k} />
                  ))}
                </div>
              )}
            </Section>

            {/* 运限信息 */}
            {step4.horoscopeSummary && (
              <Section label="运限信息" icon={Wrench} defaultOpen={true}>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                  {step4.horoscopeSummary}
                </pre>
              </Section>
            )}

            {/* Step 4：完整 Prompt */}
            <Section
              label="Step 4：完整上下文（Prompt）"
              icon={FileText}
              badge={`${step4.context.length} 字`}
            >
              <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
                {step4.context}
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
    </div>,
    document.body,
  );
}

/** 知识片段展示 */
function KnowledgeHitItem({
  index,
  chunk,
}: {
  index: number;
  chunk: { id: number; title: string; content: string; score?: number; domains: string[] };
}) {
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
          {index}. {chunk.title}
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {chunk.content.length} 字
        </Badge>
        {chunk.score !== undefined && (
          <Badge variant="outline" className="text-[10px]">
            {chunk.score === 1 ? "精确" : `${(chunk.score * 100).toFixed(0)}%`}
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2">
          <div className="mb-2 flex gap-1">
            {chunk.domains.map(d => (
              <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
            ))}
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
            {chunk.content}
          </pre>
        </div>
      )}
    </div>
  );
}
