/**
 * 与项目 ClaudeProvider / DeepSeek Anthropic 端一致：POST {baseUrl}/v1/messages（非流式）
 * 解析 content 中 type 为 text 的块（跳过 thinking）。
 * 用法: READING_QUESTION='…' npx tsx --tsconfig tsconfig.json scripts/ds-reply-via-createProvider.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts.join("");
}

void (async () => {
  try {
    const userQ =
      process.env.READING_QUESTION?.trim() || "我明年的财运怎么样？";

    const row =
      (await prisma.aIModelConfig.findFirst({
        where: { isActive: true, isDefault: true },
      })) ??
      (await prisma.aIModelConfig.findFirst({ where: { isActive: true } }));

    if (!row) {
      console.error("无激活 AI 模型");
      process.exit(1);
    }

    const base = row.baseUrl.replace(/\/$/, "");
    const url = `${base}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": row.apiKeyEncrypted,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: row.modelId,
        max_tokens: 2048,
        temperature: 0.6,
        system:
          "你是一位紫微斗数命理师。用户会提问运势；请结合命理常识给出**明年**财运方面的分析，语气自然，避免绝对化断言，800 字以内。",
        messages: [{ role: "user", content: userQ }],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error("HTTP", res.status, raw.slice(0, 500));
      process.exit(1);
    }

    let data: unknown;
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      console.error("非 JSON 响应:", raw.slice(0, 400));
      process.exit(1);
    }

    const text = extractAssistantText(data).trim();
    if (!text) {
      console.error("未解析到 assistant text 块:", raw.slice(0, 800));
      process.exit(1);
    }

    await prisma.$disconnect();
    console.log(text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
