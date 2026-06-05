"use client";

import { Badge } from "@/components/ui/badge";
import type { SihuaLandingReport } from "@/core/types";

const PALACE_QUALITY_LABELS: Record<string, string> = {
  good: "好宫",
  bad: "坏宫",
  neutral: "中性",
  unknown: "未入盘",
};

function palaceQualityBadgeClass(quality: string): string {
  if (quality === "good") return "border-emerald-500/40 text-emerald-800 dark:text-emerald-300";
  if (quality === "bad") return "border-destructive/40 text-destructive";
  if (quality === "neutral") return "border-amber-500/30 text-amber-800 dark:text-amber-300";
  return "border-muted-foreground/30 text-muted-foreground";
}

interface SihuaLandingTableProps {
  report: SihuaLandingReport;
  compact?: boolean;
}

export function SihuaLandingTable({ report, compact = false }: SihuaLandingTableProps) {
  return (
    <div className={`space-y-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          事项焦点：<span className="text-foreground">{report.focusPalaces.join("、")}</span>
        </span>
        <Badge variant="outline" className="text-[10px]">
          方向矩阵 {report.directionMatrix}
        </Badge>
      </div>

      {report.layers.map((layer) => (
        <div
          key={`${layer.layer}-${layer.stemLabel}`}
          className="rounded-md border border-primary/10 bg-muted/20 p-2 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground">{layer.stemLabel}</span>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                layer.direction === "吉"
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/40 text-destructive"
              }`}
            >
              层向 {layer.direction}
            </Badge>
            <span className="text-[11px] text-muted-foreground">层分 {layer.layerScore.toFixed(2)}</span>
            <span className="text-[11px] text-muted-foreground">
              规则 {layer.ruleKey}
              {layer.ruleAdjustment !== 0 && (
                <>（{layer.ruleAdjustment > 0 ? "+" : ""}{layer.ruleAdjustment.toFixed(2)}）</>
              )}
            </span>
          </div>

          {layer.rows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">无落宫数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-primary/10 text-left text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">四化</th>
                    <th className="py-1 pr-2 font-medium">星曜</th>
                    <th className="py-1 pr-2 font-medium">落宫</th>
                    <th className="py-1 pr-2 font-medium">焦点</th>
                    <th className="py-1 pr-2 font-medium">宫质</th>
                    <th className="py-1 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {layer.rows.map((row) => {
                    const notes: string[] = [];
                    if (row.triggersShaPalace) notes.push("煞/忌");
                    if (row.hasAuspiciousPattern) notes.push("吉格");
                    return (
                      <tr
                        key={`${layer.layer}-${row.sihuaType}-${row.star}`}
                        className={`border-b border-primary/5 ${row.inMatterFocus ? "bg-primary/5" : ""}`}
                      >
                        <td className="py-1 pr-2">{row.sihuaType}</td>
                        <td className="py-1 pr-2 font-medium text-foreground">{row.star}</td>
                        <td className="py-1 pr-2">{row.palace ?? "—"}</td>
                        <td className="py-1 pr-2">{row.inMatterFocus ? "是" : "否"}</td>
                        <td className="py-1 pr-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${palaceQualityBadgeClass(row.palaceQuality)}`}
                          >
                            {PALACE_QUALITY_LABELS[row.palaceQuality] ?? row.palaceQuality}
                          </Badge>
                        </td>
                        <td className="py-1 text-muted-foreground">{notes.length ? notes.join(" · ") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
