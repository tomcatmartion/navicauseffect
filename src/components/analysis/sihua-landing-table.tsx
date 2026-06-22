"use client";

import type { SihuaLandingReport } from "@/core/types";

const PALACE_QUALITY_LABELS: Record<string, string> = {
  good: "好宫",
  bad: "坏宫",
  neutral: "中性",
  unknown: "未入盘",
};

function palaceQualityChipStyle(quality: string): React.CSSProperties {
  if (quality === "good") return { color: "var(--success)", borderColor: "var(--success)" };
  if (quality === "bad") return { color: "var(--danger)", borderColor: "var(--danger)" };
  if (quality === "neutral") return { color: "var(--warning)", borderColor: "var(--warning)" };
  return { color: "var(--text-muted)" };
}

interface SihuaLandingTableProps {
  report: SihuaLandingReport;
  compact?: boolean;
}

export function SihuaLandingTable({ report, compact = false }: SihuaLandingTableProps) {
  const baseFont = compact ? 12 : 13;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: baseFont }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
        <span>
          事项焦点：<span style={{ color: "var(--ink)" }}>{report.focusPalaces.join("、")}</span>
        </span>
        <span className="chip" style={{ fontSize: 10 }}>
          方向矩阵 {report.directionMatrix}
        </span>
      </div>

      {report.layers.map((layer) => (
        <div
          key={`${layer.layer}-${layer.stemLabel}`}
          style={{
            borderRadius: 8,
            border: "1px solid var(--line-light)",
            background: "var(--soft)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>{layer.stemLabel}</span>
            <span
              className="chip"
              style={{
                fontSize: 10,
                ...(layer.direction === "吉"
                  ? { color: "var(--success)", borderColor: "var(--success)" }
                  : { color: "var(--danger)", borderColor: "var(--danger)" }),
              }}
            >
              层向 {layer.direction}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>层分 {layer.layerScore.toFixed(2)}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              规则 {layer.ruleKey}
              {layer.ruleAdjustment !== 0 && (
                <>（{layer.ruleAdjustment > 0 ? "+" : ""}{layer.ruleAdjustment.toFixed(2)}）</>
              )}
            </span>
          </div>

          {layer.rows.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>无落宫数据</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-light)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>四化</th>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>星曜</th>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>落宫</th>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>焦点</th>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>宫质</th>
                    <th style={{ padding: "4px 0", fontWeight: 500 }}>备注</th>
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
                        style={{
                          borderBottom: "1px solid var(--line-light)",
                          background: row.inMatterFocus ? "var(--soft)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "4px 8px 4px 0" }}>{row.sihuaType}</td>
                        <td style={{ padding: "4px 8px 4px 0", fontWeight: 500, color: "var(--ink)" }}>{row.star}</td>
                        <td style={{ padding: "4px 8px 4px 0" }}>{row.palace ?? "—"}</td>
                        <td style={{ padding: "4px 8px 4px 0" }}>{row.inMatterFocus ? "是" : "否"}</td>
                        <td style={{ padding: "4px 8px 4px 0" }}>
                          <span className="chip" style={{ fontSize: 10, ...palaceQualityChipStyle(row.palaceQuality) }}>
                            {PALACE_QUALITY_LABELS[row.palaceQuality] ?? row.palaceQuality}
                          </span>
                        </td>
                        <td style={{ padding: "4px 0", color: "var(--text-muted)" }}>{notes.length ? notes.join(" · ") : "—"}</td>
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
