import { chunkLogicdocText } from "@/lib/logicdoc/chunk-text";

/**
 * 按 Markdown 标题（# / ## / ###）切段，再对各段使用与 legacy 相同的字数窗口分块。
 * 减少「同一标题下长规则被与无关段落硬拼成一块」的情况。
 *
 * 由 `LOGICDOC_CHUNK_STRATEGY=markdown` 在索引时选用；变更后须重建 Zvec。
 */
const MIN_SECTION_CHARS = 120;

export function chunkLogicdocMarkdown(fullText: string): string[] {
  const raw = fullText.trim();
  if (!raw) return [];

  const lines = raw.split("\n");
  const sections: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    const s = buf.join("\n").trim();
    if (s) sections.push(s);
    buf = [];
  };

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
    }
    buf.push(line);
  }
  flush();

  // 合并过短的 section 到下一个 section，避免只有标题无内容的碎片块
  const merged: string[] = [];
  for (const sec of sections) {
    if (merged.length > 0 && sec.length < MIN_SECTION_CHARS) {
      merged[merged.length - 1] += "\n\n" + sec;
    } else {
      merged.push(sec);
    }
  }

  const out: string[] = [];
  for (const sec of merged) {
    out.push(...chunkLogicdocText(sec));
  }
  return out.filter(Boolean);
}
