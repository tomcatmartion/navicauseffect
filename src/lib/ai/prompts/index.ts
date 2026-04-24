import { AnalysisCategory } from "@prisma/client";
import {
  getBuiltinAnalysisPromptsPayload,
  type AnalysisPromptsPayload,
} from "./defaults";
import { formatChartCnJson, formatHoroscopeCnJson } from "@/lib/ai/format-chart-cn";

export {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_CATEGORY_PROMPTS,
  AI_PROMPTS_CONFIG_KEY,
  getBuiltinAnalysisPromptsPayload,
  type AnalysisPromptsPayload,
} from "./defaults";

export {
  mergeAnalysisPromptsFromStored,
  getResolvedAnalysisPrompts,
} from "./resolve";

export type AnalysisChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * 组装发给大模型的 messages。prompts 为已合并后的配置（来自 DB + 默认）。
 * knowledge：logicdoc 注入到 system 末尾。
 */
export function buildAnalysisPrompt(
  category: AnalysisCategory,
  astrolabeData: Record<string, unknown>,
  horoscopeData?: Record<string, unknown>,
  options?: { knowledge?: string; prompts?: AnalysisPromptsPayload }
): AnalysisChatMessage[] {
  const effective = options?.prompts ?? getBuiltinAnalysisPromptsPayload();
  const categoryPrompt = effective.categoryPrompts[category] ?? "";
  let systemContent = effective.systemPrompt;
  if (options?.knowledge?.trim()) {
    systemContent += `\n\n## 解盘逻辑与规则（请严格参照执行）\n\n${options.knowledge.trim()}`;
  }

  const messages: AnalysisChatMessage[] = [
    { role: "system", content: systemContent },
    {
      role: "user",
      content: `${categoryPrompt}

## 命盘数据
${formatChartCnJson(astrolabeData)}

${horoscopeData ? `## 当前运限数据\n${formatHoroscopeCnJson(horoscopeData, astrolabeData)}` : ""}`,
    },
  ];

  return messages;
}

/** 流式 / JSON 里下发的可序列化消息（供前端展示） */
export function serializePromptMessagesForClient(
  messages: AnalysisChatMessage[]
): { role: string; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
