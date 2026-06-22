"use client";

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
    <div style={{
      borderRadius: 8,
      border: "1px solid var(--line-light)",
      background: "var(--soft)",
      padding: 8,
      fontSize: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--text-muted)" }}>主看</span>
        <span className="chip" style={{ fontSize: 10 }}>{primaryPalace}</span>
        {secondaryPalaces.map((p) => (
          <span key={p} className="chip" style={{ fontSize: 10 }}>兼看 {p}</span>
        ))}
      </div>

      {Object.entries(routingAnswers).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(routingAnswers).map(([k, v]) => {
            const qLabel = questionLabels[k] ?? k
            const vLabel = optionLabels[k]?.[v] ?? v
            return (
              <span key={k} className="chip" style={{ fontSize: 10, fontWeight: 400 }}>
                {qLabel}：{vLabel}
              </span>
            )
          })}
        </div>
      )}

      {specialConditions.length > 0 && (
        <p style={{ color: "var(--text-muted)" }}>特殊条件：{specialConditions.join("；")}</p>
      )}

      {needInteraction && (
        <p style={{ color: "var(--warning)" }}>
          本事项建议进入互动关系分析（Stage4），可点击下方按钮继续。
        </p>
      )}
    </div>
  );
}
