"use client";

import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-3 rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-3">
      {(matterType || affairText) && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{matterType ?? "事项"}</span>
          {affairText ? ` · ${affairText}` : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {compositeScore !== undefined && (
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {compositeScore.toFixed(1)}
          </span>
        )}
        {scoreLabel && (
          <Badge variant="secondary" className="text-xs">{scoreLabel}</Badge>
        )}
        {directionWindow && (
          <Badge variant="outline" className="text-xs">{directionWindow}</Badge>
        )}
        {liuYueDataAvailable === false && (
          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
            流月未接入
          </Badge>
        )}
        {resilienceStrategy && (
          <Badge
            variant="outline"
            className={
              resilienceStrategy === "危机干预"
                ? "border-destructive/40 text-destructive"
                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            }
          >
            {resilienceStrategy}
          </Badge>
        )}
      </div>

      {scoreAction && (
        <p className="text-sm font-medium text-foreground">{scoreAction}</p>
      )}

      {directionMatrix && (
        <div className="inline-grid grid-cols-2 gap-1 text-[10px]">
          <div className="text-center text-muted-foreground col-span-2">流年 ↓ / 大限 →</div>
          {MATRIX_CELLS.map((cell) => {
            const active = cell.key === directionMatrix;
            return (
              <div
                key={cell.key}
                className={`rounded border px-2 py-1 text-center ${
                  active
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-primary/10 text-muted-foreground"
                }`}
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
