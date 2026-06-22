"use client";

import type { ThreeDimensionAnalysis } from "@/core/types";

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

const blockStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--line-light)",
  background: "var(--soft)",
  padding: 12,
};

const blockTitleStyle: React.CSSProperties = {
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--brand)",
};

const blockListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 11,
  color: "var(--text-muted)",
  listStyleType: "disc",
  listStylePosition: "inside",
  paddingLeft: 0,
};

function DimensionBlock({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; text: string }[];
}) {
  return (
    <div style={blockStyle}>
      <div style={blockTitleStyle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
        {lines.map((line) => (
          <p key={line.label}>
            <span style={{ fontWeight: 500, color: "var(--ink)" }}>{line.label}：</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span className="chip" style={{ fontSize: 10 }}>
          {result.mode === "full" ? "太岁入卦 · 双人" : "单方 · 关系宫"}
        </span>
        {result.mode === "full" && result.partnerYear && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            对方 {result.partnerYear} 年生（{result.partnerGan}
            {result.partnerZhi}）
          </span>
        )}
        {result.mode === "solo" && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            未填对方生年，已降级为夫妻/迁移/三合关系宫分析
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
        <div style={{
          ...blockStyle,
          borderColor: "var(--warning)",
          background: "var(--warning-soft, var(--soft))",
        }}>
          <div style={{ ...blockTitleStyle, color: "var(--warning)" }}>
            核心张力点
          </div>
          <ul style={blockListStyle}>
            {result.tensionPoints.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {result.adjustableAdvice.length > 0 && (
        <div style={{
          ...blockStyle,
          borderColor: "var(--brand)",
        }}>
          <div style={blockTitleStyle}>可调整建议</div>
          <ul style={blockListStyle}>
            {result.adjustableAdvice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {result.fixedRisks.length > 0 && (
        <div style={{
          ...blockStyle,
          borderColor: "var(--danger)",
          background: "var(--danger-soft, var(--soft))",
        }}>
          <div style={{ ...blockTitleStyle, color: "var(--danger)" }}>结构性风险</div>
          <ul style={blockListStyle}>
            {result.fixedRisks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.mode === "full" && result.virtualChart && (
        <details style={{
          ...blockStyle,
          borderStyle: "dashed",
        }}>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
            虚拟命盘结构（调试）
          </summary>
          <pre style={{ marginTop: 8, maxHeight: 200, overflow: "auto", fontSize: 10, color: "var(--text-muted)" }}>
            {JSON.stringify(result.virtualChart, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
