"use client";

import type { DirectionMatrix, DirectionWindow } from "@/core/types";
import { MatterAnalysisHero } from "./matter-analysis-hero";
import { MatterReportSections, type MatterReportData } from "./matter-report-sections";

export interface MatterAffairResult {
  compositeScore?: number;
  scoreLabel?: string;
  scoreAction?: string;
  directionMatrix?: DirectionMatrix;
  directionWindow?: DirectionWindow;
  liuYueDataAvailable?: boolean;
  report: MatterReportData;
}

interface MatterAffairPanelProps {
  result: MatterAffairResult;
  onStage4?: () => void;
}

export function MatterAffairPanel({ result, onStage4 }: MatterAffairPanelProps) {
  const needInteraction = result.report.route?.needInteraction;

  return (
    <div className="space-y-3">
      <MatterAnalysisHero
        matterType={result.report.matterType}
        affairText={result.report.affairText}
        compositeScore={result.compositeScore}
        scoreLabel={result.scoreLabel}
        scoreAction={result.scoreAction}
        directionMatrix={result.directionMatrix}
        directionWindow={result.directionWindow}
        liuYueDataAvailable={result.liuYueDataAvailable}
        resilienceStrategy={result.report.resilience?.strategy}
      />
      <MatterReportSections data={result.report} />
      {needInteraction && onStage4 && (
        <button
          type="button"
          onClick={onStage4}
          className="w-full cursor-pointer rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          进入互动关系分析（Stage4）
        </button>
      )}
    </div>
  );
}
