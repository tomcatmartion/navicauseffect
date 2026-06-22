"use client";

import type { DirectionMatrix, DirectionWindow } from "@/core/types";

const MATRIX_CELLS: Array<{ row: "吉" | "凶"; col: "吉" | "凶"; key: DirectionMatrix }> = [
  { row: "吉", col: "吉", key: "吉吉" },
  { row: "吉", col: "凶", key: "吉凶" },
  { row: "凶", col: "吉", key: "凶吉" },
  { row: "凶", col: "凶", key: "凶凶" },
];

interface MatterAnalysisHeroProps {
  matterType?: string;
  affairText?: string;
  compositeScore?: number;
  scoreLabel?: string;
  scoreAction?: string;
  directionMatrix?: DirectionMatrix;
  directionWindow?: DirectionWindow;
  liuYueDataAvailable?: boolean;
  resilienceStrategy?: string;
}

export function MatterAnalysisHero({
  matterType,
  affairText,
  compositeScore,
  scoreLabel,
  scoreAction,
  directionMatrix,
  directionWindow,
  liuYueDataAvailable,
  resilienceStrategy,
}: MatterAnalysisHeroProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "linear-gradient(135deg, var(--soft) 0%, transparent 100%)",
      padding: 12,
    }}>
      {(matterType || affairText) && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ fontWeight: 500, color: "var(--ink)" }}>{matterType ?? "事项"}</span>
          {affairText ? ` · ${affairText}` : ""}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {compositeScore !== undefined && (
          <span style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
            {compositeScore.toFixed(1)}
          </span>
        )}
        {scoreLabel && (
          <span className="chip" style={{ fontSize: 12 }}>{scoreLabel}</span>
        )}
        {directionWindow && (
          <span className="chip" style={{ fontSize: 12 }}>{directionWindow}</span>
        )}
        {liuYueDataAvailable === false && (
          <span className="chip" style={{ fontSize: 12, color: "var(--warning)", borderColor: "var(--warning)" }}>
            流月未接入
          </span>
        )}
        {resilienceStrategy && (
          <span
            className="chip"
            style={
              resilienceStrategy === "危机干预"
                ? { fontSize: 12, color: "var(--danger)", borderColor: "var(--danger)" }
                : { fontSize: 12, color: "var(--success)", borderColor: "var(--success)" }
            }
          >
            {resilienceStrategy}
          </span>
        )}
      </div>

      {scoreAction && (
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{scoreAction}</p>
      )}

      {directionMatrix && (
        <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(2, auto)", gap: 4, fontSize: 10 }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)", gridColumn: "span 2" }}>流年 ↓ / 大限 →</div>
          {MATRIX_CELLS.map((cell) => {
            const active = cell.key === directionMatrix;
            return (
              <div
                key={cell.key}
                style={
                  active
                    ? {
                        borderRadius: 6,
                        border: "1px solid var(--brand)",
                        background: "var(--soft)",
                        padding: "4px 8px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "var(--brand)",
                      }
                    : {
                        borderRadius: 6,
                        border: "1px solid var(--line-light)",
                        padding: "4px 8px",
                        textAlign: "center",
                        color: "var(--text-muted)",
                      }
                }
              >
                {cell.key}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
