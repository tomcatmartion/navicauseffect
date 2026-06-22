"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{loadError}</p>
    );
  }

  if (!branch) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>加载问诊树…</p>;
  }

  const answeredIds = Object.keys(answers).filter((k) => branch.questions[k]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      borderRadius: 8,
      border: "1px solid var(--line-light)",
      background: "var(--soft)",
      padding: 8,
    }}>
      {branch.pre_analysis && (
        <p style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-muted)" }}>
          {branch.pre_analysis.description}
        </p>
      )}

      {answeredIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {answeredIds.map((id) => {
            const q = branch.questions[id];
            const val = answers[id];
            const label = q?.options.find((o) => o.value === val)?.label ?? val;
            return (
              <span key={id} className="chip" style={{ fontSize: 10, fontWeight: 400 }}>
                {q?.question.slice(0, 12) ?? id}：{label}
              </span>
            );
          })}
        </div>
      )}

      {isComplete ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="chip" style={{ fontSize: 10, color: "var(--success)", borderColor: "var(--success)" }}>
            问诊已完成
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ height: 28, fontSize: 12, cursor: "pointer" }}
            onClick={handleReset}
          >
            重新问诊
          </button>
        </div>
      ) : currentQuestion ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>{currentQuestion.question}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {currentQuestion.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePick(currentQuestion.id, opt.value, opt.next)}
                className="btn btn-ghost"
                style={{ cursor: "pointer", textAlign: "left", fontSize: 12 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {currentQuestion.id === "wealth_3b" && answers.wealth_3b === "has" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }} htmlFor="partner-birth-year">
                合伙人生年（1900–2100）
              </label>
              <input
                id="partner-birth-year"
                type="number"
                min={1900}
                max={2100}
                value={partnerBirthYear}
                onChange={(e) => onPartnerBirthYearChange?.(e.target.value)}
                className="input"
                placeholder="例如 1985"
              />
            </div>
          )}
        </div>
      ) : null}

      {!isComplete && answeredIds.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ height: 28, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}
          onClick={handleReset}
        >
          清空重来
        </button>
      )}
    </div>
  );
}
