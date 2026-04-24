/**
 * 知识库文件解析器
 * 统一入口：将 .md / .docx / .pdf / .xlsx 文件解析为纯文本/Markdown。
 *
 * .md   — 直接读取
 * .docx — mammoth HTML → Markdown
 * .pdf  — pdf-parse 提取文本
 * .xlsx / .xls — xlsx 库按 sheet 转为 Markdown 表格
 */

import { readFile } from "fs/promises";
import mammoth from "mammoth";

// ─── 类型定义 ───

export const SUPPORTED_EXTENSIONS = [".md", ".docx", ".pdf", ".xlsx", ".xls"] as const;
export type SupportedExt = (typeof SUPPORTED_EXTENSIONS)[number];

/** 判断文件名是否为支持的格式 */
export function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 获取文件扩展名（小写，含点） */
export function getFileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

// ─── HTML → Markdown（从 logicdoc-indexer 提取） ───

function htmlToSimpleMarkdown(html: string): string {
  let md = html;
  for (let i = 1; i <= 6; i++) {
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, "gi");
    md = md.replace(re, (_, content) => {
      const text = content.replace(/<[^>]+>/g, "").trim();
      return `\n${"#".repeat(i)} ${text}\n`;
    });
  }
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const text = content.replace(/<[^>]+>/g, "").trim();
    return text ? `\n${text}\n` : "\n";
  });
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const text = content.replace(/<[^>]+>/g, "").trim();
    return `- ${text}\n`;
  });
  md = md.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowContent) => {
    const cells = [...rowContent.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    return cells.length ? `| ${cells.join(" | ")} |\n` : "";
  });
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

// ─── 各格式解析器 ───

async function parseMarkdown(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  return content.trim();
}

async function parseDocx(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  return htmlToSimpleMarkdown(result.value ?? "");
}

async function parsePdf(filePath: string): Promise<string> {
  // pdf-parse 是 CJS 模块，需要动态 import
  const pdfParse = await import("pdf-parse");
  const fn = typeof pdfParse === "function" ? pdfParse : (pdfParse as Record<string, unknown>).default;
  const buffer = await readFile(filePath);
  const data = await (fn as (buf: Buffer) => Promise<{ text: string }>)(buffer);
  return (data.text ?? "").trim();
}

async function parseExcel(filePath: string): Promise<string> {
  // xlsx 是 CJS 模块
  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Sheet → JSON 数组（每行一个对象）
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    if (rows.length === 0) continue;

    parts.push(`## ${sheetName}`);

    // 提取列头
    const headers = Object.keys(rows[0]);
    parts.push(`| ${headers.join(" | ")} |`);
    parts.push(`| ${headers.map(() => "---").join(" | ")} |`);

    for (const row of rows) {
      const cells = headers.map((h) => String(row[h] ?? ""));
      parts.push(`| ${cells.join(" | ")} |`);
    }
    parts.push(""); // 空行分隔
  }

  return parts.join("\n").trim();
}

// ─── 统一入口 ───

/**
 * 将知识库文件解析为 Markdown/纯文本。
 * @param filePath 文件绝对路径
 * @param fileName 文件名（含扩展名）
 * @returns 解析后的文本内容
 */
export async function parseFileToMarkdown(
  filePath: string,
  fileName: string
): Promise<string> {
  const ext = getFileExt(fileName);

  switch (ext) {
    case ".md":
      return parseMarkdown(filePath);
    case ".docx":
      return parseDocx(filePath);
    case ".pdf":
      return parsePdf(filePath);
    case ".xlsx":
    case ".xls":
      return parseExcel(filePath);
    default:
      throw new Error(`不支持的文件格式: ${ext}（支持: ${SUPPORTED_EXTENSIONS.join(", ")}）`);
  }
}
