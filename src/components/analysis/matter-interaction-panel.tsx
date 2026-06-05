"use client";

import type { ThreeDimensionAnalysis } from "@/core/types";
import { Badge } from "@/components/ui/badge";

export interface MatterInteractionResult {
  mode: "full" | "solo";
  partnerYear: number | null;
  partnerGan: string;
  partnerZhi: string;
  threeDimension: ThreeDimensionAnalysis;
  tensionPoints: string[];
  adjustableAdvice: string[];
  fixedRisks: string[];
  virtualChart: Record<string, unknown> | null;
}

interface MatterInteractionPanelProps {
  result: MatterInteractionResult;
}

function DimensionBlock({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; text: string }[];
}) {
  return (
    <div className="rounded-md border border-primary/10 bg-muted/20 p-3">
      <div className="mb-2 text-xs font-medium text-primary">{title}</div>
      <div className="space-y-1.5 text-[11px] text-muted-foreground">
        {lines.map((line) => (
          <p key={line.label}>
            <span className="font-medium text-foreground/80">{line.label}：</span>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export function MatterInteractionPanel({ result }: MatterInteractionPanelProps) {
  const { threeDimension: td } = result;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {result.mode === "full" ? "太岁入卦 · 双人" : "单方 · 关系宫"}
        </Badge>
        {result.mode === "full" && result.partnerYear && (
          <span className="text-[11px] text-muted-foreground">
            对方 {result.partnerYear} 年生（{result.partnerGan}
            {result.partnerZhi}）
          </span>
        )}
        {result.mode === "solo" && (
          <span className="text-[11px] text-muted-foreground">
            未填对方生年，已降级为夫妻/迁移/三合关系宫分析
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DimensionBlock
          title="维度 A · 入卦/关系面"
          lines={[
            { label: "早期倾向", text: td.dimensionA.earlyTendency },
            { label: "晚期倾向", text: td.dimensionA.lateTendency },
          ]}
        />
        <DimensionBlock
          title="维度 B · 命主底色"
          lines={[
            { label: "基调", text: td.dimensionB.tone },
            { label: "摘要", text: td.dimensionB.summary },
          ]}
        />
        <DimensionBlock
          title="维度 C · 行运引动"
          lines={[
            { label: "大限", text: td.dimensionC.currentDecadalEffect },
            { label: "流年", text: td.dimensionC.yearlyTrigger },
          ]}
        />
      </div>

      {result.tensionPoints.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            核心张力点
          </div>
          <ul className="list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
            {result.tensionPoints.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {result.adjustableAdvice.length > 0 && (
        <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
          <div className="mb-1.5 text-xs font-medium text-primary">可调整建议</div>
          <ul className="list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
            {result.adjustableAdvice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {result.fixedRisks.length > 0 && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <div className="mb-1.5 text-xs font-medium text-destructive">结构性风险</div>
          <ul className="list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
            {result.fixedRisks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.mode === "full" && result.virtualChart && (
        <details className="rounded-md border border-dashed border-primary/15 bg-muted/10 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
            虚拟命盘结构（调试）
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto text-[10px] text-muted-foreground">
            {JSON.stringify(result.virtualChart, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
