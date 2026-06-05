"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RouteQuestion } from "@/core/router/decision-tree";

type RouterBranch = {
  firstQuestion: string;
  questions: Record<string, RouteQuestion>;
  pre_analysis?: { type: string; source: string; description: string };
};

interface MatterRouterQuestionnaireProps {
  matterType: string;
  answers: Record<string, string>;
  onAnswersChange: (answers: Record<string, string>) => void;
  partnerBirthYear?: string;
  onPartnerBirthYearChange?: (value: string) => void;
  onCompleteChange?: (complete: boolean) => void;
}

function walkToQuestion(
  branch: RouterBranch,
  answers: Record<string, string>,
): string | "result" {
  let cursor: string | "result" = branch.firstQuestion;
  const guard = new Set<string>();

  while (cursor !== "result") {
    if (guard.has(cursor)) return cursor;
    guard.add(cursor);

    const q = branch.questions[cursor];
    if (!q) return cursor;

    const picked = answers[cursor];
    if (!picked) return cursor;

    const opt = q.options.find((o) => o.value === picked);
    if (!opt) return cursor;
    cursor = opt.next;
  }

  return "result";
}

export function MatterRouterQuestionnaire({
  matterType,
  answers,
  onAnswersChange,
  partnerBirthYear = "",
  onPartnerBirthYearChange,
  onCompleteChange,
}: MatterRouterQuestionnaireProps) {
  const [branch, setBranch] = useState<RouterBranch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ziwei/router-tree");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "加载问诊树失败");
        if (cancelled) return;
        const b = json.data?.branches?.[matterType] as RouterBranch | undefined;
        setBranch(b ?? null);
        setLoadError(b ? null : "该事项暂无问诊配置");
      } catch (e) {
        if (!cancelled) {
          setBranch(null);
          setLoadError(e instanceof Error ? e.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matterType]);

  const cursor = useMemo(() => {
    if (!branch) return null;
    return walkToQuestion(branch, answers);
  }, [branch, answers]);

  const currentQuestion =
    branch && cursor && cursor !== "result" ? branch.questions[cursor] : null;

  const isComplete = cursor === "result";

  useEffect(() => {
    onCompleteChange?.(isComplete);
  }, [isComplete, onCompleteChange]);

  const handlePick = useCallback(
    (questionId: string, value: string, next: string | "result") => {
      const nextAnswers = { ...answers, [questionId]: value };
      onAnswersChange(nextAnswers);
      if (questionId === "wealth_3b" && value === "none" && onPartnerBirthYearChange) {
        onPartnerBirthYearChange("");
      }
      void next;
    },
    [answers, onAnswersChange, onPartnerBirthYearChange],
  );

  const handleReset = () => {
    onAnswersChange({});
    onPartnerBirthYearChange?.("");
  };

  if (loadError) {
    return (
      <p className="text-xs text-muted-foreground">{loadError}</p>
    );
  }

  if (!branch) {
    return <p className="text-xs text-muted-foreground">加载问诊树…</p>;
  }

  const answeredIds = Object.keys(answers).filter((k) => branch.questions[k]);

  return (
    <div className="space-y-2 rounded-md border border-primary/10 bg-muted/20 p-2">
      {branch.pre_analysis && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {branch.pre_analysis.description}
        </p>
      )}

      {answeredIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {answeredIds.map((id) => {
            const q = branch.questions[id];
            const val = answers[id];
            const label = q?.options.find((o) => o.value === val)?.label ?? val;
            return (
              <Badge key={id} variant="secondary" className="text-[10px] font-normal">
                {q?.question.slice(0, 12) ?? id}：{label}
              </Badge>
            );
          })}
        </div>
      )}

      {isComplete ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
            问诊已完成
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs cursor-pointer"
            onClick={handleReset}
          >
            重新问诊
          </Button>
        </div>
      ) : currentQuestion ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">{currentQuestion.question}</p>
          <div className="flex flex-col gap-1.5">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePick(currentQuestion.id, opt.value, opt.next)}
                className="cursor-pointer rounded-md border border-primary/15 bg-card px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {currentQuestion.id === "wealth_3b" && answers.wealth_3b === "has" && (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground" htmlFor="partner-birth-year">
                合伙人生年（1900–2100）
              </label>
              <input
                id="partner-birth-year"
                type="number"
                min={1900}
                max={2100}
                value={partnerBirthYear}
                onChange={(e) => onPartnerBirthYearChange?.(e.target.value)}
                className="h-8 w-full rounded-md border px-2 text-sm"
                placeholder="例如 1985"
              />
            </div>
          )}
        </div>
      ) : null}

      {!isComplete && answeredIds.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs cursor-pointer"
          onClick={handleReset}
        >
          清空重来
        </Button>
      )}
    </div>
  );
}
