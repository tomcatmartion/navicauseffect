import type { PrismaClient } from "@prisma/client";
import { AnalysisCategory } from "@prisma/client";
import {
  AI_PROMPTS_CONFIG_KEY,
  type AnalysisPromptsPayload,
  getBuiltinAnalysisPromptsPayload,
} from "./defaults";

function pickNonEmptyText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/** 将 AdminConfig 中的 JSON 与内置默认合并（空串视为未配置） */
export function mergeAnalysisPromptsFromStored(
  stored: unknown,
  builtin: AnalysisPromptsPayload = getBuiltinAnalysisPromptsPayload()
): AnalysisPromptsPayload {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return {
      systemPrompt: builtin.systemPrompt,
      categoryPrompts: { ...builtin.categoryPrompts },
    };
  }
  const s = stored as Record<string, unknown>;
  const systemPrompt = pickNonEmptyText(s.systemPrompt, builtin.systemPrompt);
  const categoryPrompts = { ...builtin.categoryPrompts };
  const rawCats = s.categoryPrompts;
  if (rawCats && typeof rawCats === "object" && !Array.isArray(rawCats)) {
    const rc = rawCats as Record<string, unknown>;
    for (const cat of Object.values(AnalysisCategory)) {
      const v = rc[cat];
      categoryPrompts[cat] = pickNonEmptyText(v, builtin.categoryPrompts[cat]);
    }
  }
  return { systemPrompt, categoryPrompts };
}

export async function getResolvedAnalysisPrompts(
  prisma: PrismaClient
): Promise<AnalysisPromptsPayload> {
  const row = await prisma.adminConfig.findUnique({
    where: { configKey: AI_PROMPTS_CONFIG_KEY },
  });
  return mergeAnalysisPromptsFromStored(row?.configValue ?? null);
}
