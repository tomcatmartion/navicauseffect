/**
 * 解盘知识库（sysknowledge）：从项目根目录 sysfiles/sysknowledge 文件夹读取紫微斗数解盘逻辑与规则，
 * 在调用大模型解盘时注入到 system prompt，使输出严格参照知识库。
 * 支持 .md 与 .docx（Word）文件。
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";

const LOGICDOC_DIR = "sysfiles/sysknowledge";

/** 默认上限：约 3.2 万字符，为命盘 JSON + system/user 留出余量，避免 200K 级知识库导致上下文超限、流式无正文 */
const DEFAULT_MAX_CHARS = 32_000;

const MD_EXT = ".md";
const DOCX_EXT = ".docx";

/**
 * 从环境变量读取知识库注入的最大字符数。
 * - 未设置：使用 DEFAULT_MAX_CHARS
 * - LOGICDOC_MAX_CHARS=0：不截断（仅适合小库或超大上下文模型自测）
 */
function getLogicdocMaxChars(): number | null {
  const raw = process.env.LOGICDOC_MAX_CHARS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_MAX_CHARS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_CHARS;
  if (n === 0) return null;
  return n;
}

function isMd(name: string): boolean {
  return name.toLowerCase().endsWith(MD_EXT);
}
function isDocx(name: string): boolean {
  return name.toLowerCase().endsWith(DOCX_EXT);
}

/** 从单个文件读取文本：.md 直接 UTF-8，.docx 用 mammoth 提取正文 */
async function readFileText(filePath: string, name: string): Promise<string> {
  if (isDocx(name)) {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }
  const content = await readFile(filePath, "utf-8");
  return content.trim();
}

/**
 * 读取项目根目录下 logicdoc 目录中所有 .md 与 .docx 文件内容并拼接为一段文本。
 * 若目录不存在或为空，返回空字符串（不报错，解盘仍可进行）。
 */
export async function loadLogicdocKnowledge(): Promise<string> {
  const dir = path.join(process.cwd(), LOGICDOC_DIR);

  try {
    const names = await readdir(dir);
    const docFiles = names
      .filter((n) => isMd(n) || isDocx(n))
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
    if (docFiles.length === 0) return "";

    const parts: string[] = [];
    for (const name of docFiles) {
      const filePath = path.join(dir, name);
      try {
        const content = await readFileText(filePath, name);
        if (content) parts.push(`### ${name}\n${content}`);
      } catch (e) {
        console.warn("[logicdoc] skip file:", name, e);
      }
    }
    let combined = parts.join("\n\n---\n\n");
    const maxChars = getLogicdocMaxChars();
    if (maxChars !== null && combined.length > maxChars) {
      const fullLen = combined.length;
      combined =
        combined.slice(0, maxChars) +
        `\n\n[…… 解盘知识库已按长度上限截断：原文约 ${fullLen} 字，当前上限 ${maxChars} 字。可将核心规则放在排序靠前的文件中，或设置环境变量 LOGICDOC_MAX_CHARS 调大（需模型上下文足够）。]`;
      console.warn(
        `[logicdoc] knowledge truncated: ${fullLen} -> ${maxChars} chars (LOGICDOC_MAX_CHARS=${maxChars})`,
      );
    }
    return combined;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return "";
    console.warn("[logicdoc] load failed:", err);
    return "";
  }
}
