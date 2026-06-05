"use client";

import { Badge } from "@/components/ui/badge";
import routerConfig from "@/../../data/router.json";

interface MatterRouteSummaryProps {
  primaryPalace: string;
  secondaryPalaces: string[];
  specialConditions: string[];
  needInteraction?: boolean;
  routingAnswers: Record<string, string>;
}

/** 从 router.json 构建 questionId → question, value → label 映射 */
function buildAnswerLabelMap(): {
  questions: Record<string, string>
  options: Record<string, Record<string, string>>
} {
  const questions: Record<string, string> = {}
  const options: Record<string, Record<string, string>> = {}
  const branches = (routerConfig as Record<string, unknown>).branches as
    Record<string, { questions?: Record<string, { question?: string; options?: Array<{ value: string; label: string }> }> }> | undefined
  if (!branches) return { questions, options }
  for (const branch of Object.values(branches)) {
    if (!branch.questions) continue
    for (const [qid, q] of Object.entries(branch.questions)) {
      if (q.question) questions[qid] = q.question
      if (q.options) {
        const optMap: Record<string, string> = {}
        for (const o of q.options) {
          optMap[o.value] = o.label
        }
        options[qid] = optMap
      }
    }
  }
  return { questions, options }
}

const { questions: questionLabels, options: optionLabels } = buildAnswerLabelMap()

export function MatterRouteSummary({
  primaryPalace,
  secondaryPalaces,
  specialConditions,
  needInteraction,
  routingAnswers,
}: MatterRouteSummaryProps) {
  return (
    <div className="rounded-md border border-primary/10 bg-muted/20 p-2 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">主看</span>
        <Badge variant="secondary" className="text-[10px]">{primaryPalace}</Badge>
        {secondaryPalaces.map((p) => (
          <Badge key={p} variant="outline" className="text-[10px]">兼看 {p}</Badge>
        ))}
      </div>

      {Object.entries(routingAnswers).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(routingAnswers).map(([k, v]) => {
            const qLabel = questionLabels[k] ?? k
            const vLabel = optionLabels[k]?.[v] ?? v
            return (
              <Badge key={k} variant="outline" className="text-[10px] font-normal">
                {qLabel}：{vLabel}
              </Badge>
            )
          })}
        </div>
      )}

      {specialConditions.length > 0 && (
        <p className="text-muted-foreground">特殊条件：{specialConditions.join("；")}</p>
      )}

      {needInteraction && (
        <p className="text-amber-800 dark:text-amber-300">
          本事项建议进入互动关系分析（Stage4），可点击下方按钮继续。
        </p>
      )}
    </div>
  );
}
