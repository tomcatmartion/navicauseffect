/** 快速验证 docx→markdown 提取 + 分块效果 */
import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { chunkLogicdocText } from "../src/lib/logicdoc/chunk-text";
import { chunkLogicdocMarkdown } from "../src/lib/logicdoc/chunk-text-markdown";

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

async function main() {
  const file = "logicdoc/KB_事项宫位知识库_V1.1.docx";
  const buffer = await readFile(file);

  // 旧方式：纯文本
  const rawResult = await mammoth.extractRawText({ buffer });
  const oldText = (rawResult.value ?? "").trim();
  const oldChunks = chunkLogicdocText(oldText);

  // 新方式：HTML→Markdown
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const mdText = htmlToSimpleMarkdown(htmlResult.value ?? "");
  const newChunks = chunkLogicdocMarkdown(mdText);

  console.log(`旧方式（纯文本分块）：${oldChunks.length} 块`);
  console.log(`新方式（Markdown按标题分块）：${newChunks.length} 块`);

  // 对比：看新方式每个块的标题
  console.log(`\n=== 新方式块预览 ===`);
  for (let i = 0; i < newChunks.length; i++) {
    const c = newChunks[i];
    const firstLine = c.split("\n").find(l => l.trim()) ?? "";
    console.log(`块${i + 1} (${c.length}字): ${firstLine.slice(0, 80)}`);
  }

  // 看疾厄宫相关的块
  console.log(`\n=== 含'疾厄'的块 ===`);
  for (let i = 0; i < newChunks.length; i++) {
    if (newChunks[i].includes("疾厄")) {
      console.log(`\n块${i + 1} (${newChunks[i].length}字):`);
      console.log(newChunks[i].slice(0, 300));
    }
  }
}

main().catch(console.error);
