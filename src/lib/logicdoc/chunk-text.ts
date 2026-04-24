/** 目标块长；重叠比例默认 12.5%（落在 10%–15% 建议区间内，可用环境变量微调） */
const TARGET_MIN = 500;
const TARGET_MAX = 800;

/**
 * 与 LangChain `RecursiveCharacterTextSplitter` 同类策略：
 * 优先级 **段落 `\n\n` → 换行 `\n` → 句号 `。`**，并辅以 `！` `？` 减少硬切。
 */
const SEP_PRIORITY = ["\n\n", "\n", "。", "！", "？"] as const;

function overlapRatio(): number {
  const raw = process.env.LOGICDOC_CHUNK_OVERLAP_RATIO?.trim();
  if (raw === undefined || raw === "") return 0.125;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0.1 || n > 0.15) return 0.125;
  return n;
}

function overlapSize(): number {
  return Math.round(TARGET_MIN * overlapRatio());
}

/**
 * 在首段 [TARGET_MIN, TARGET_MAX] 窗口内按优先级找切分点；否则在 TARGET_MAX 硬切并保留重叠。
 */
export function chunkLogicdocText(fullText: string): string[] {
  const out: string[] = [];
  let s = fullText.trim();
  const ov = overlapSize();
  /** 防御性上限：异常输入或未来逻辑错误时避免死循环 */
  const maxOuter = Math.max(5000, Math.ceil(s.length / 200) + 100);
  let outerI = 0;

  while (s.length > 0) {
    outerI += 1;
    if (outerI > maxOuter) {
      console.error(
        "[chunkLogicdocText] 超过安全迭代次数，强制截断剩余文本（请检查 logicdoc 内容或分块逻辑）"
      );
      if (s.length) out.push(s);
      break;
    }
    if (s.length <= TARGET_MAX) {
      out.push(s);
      break;
    }

    const searchEnd = Math.min(TARGET_MAX, s.length);
    let cut = -1;

    outer: for (const sep of SEP_PRIORITY) {
      const window = s.slice(0, searchEnd);
      let pos =
        sep.length === 1
          ? window.lastIndexOf(sep)
          : window.lastIndexOf(sep);
      while (pos >= 0) {
        const endPos = pos + sep.length;
        if (endPos >= TARGET_MIN && endPos <= searchEnd) {
          cut = endPos;
          break outer;
        }
        /**
         * 必须显式结束：在 Node 中 `lastIndexOf(ch, -1)` 会把 fromIndex 当成 0，
         * 若唯一匹配在索引 0，会反复得到 pos=0 → 内层死循环、CPU 100%。
         */
        if (pos === 0) {
          break;
        }
        pos = window.lastIndexOf(sep, pos - 1);
      }
    }

    if (cut < 0) {
      cut = Math.min(TARGET_MAX, s.length);
    }

    const piece = s.slice(0, cut).trim();
    if (!piece) {
      out.push(s.slice(0, TARGET_MIN));
      s = s.slice(Math.max(0, TARGET_MIN - ov)).trim();
      continue;
    }

    out.push(piece);
    const nextStart = Math.max(0, cut - ov);
    s = s.slice(nextStart).trim();
  }

  return out.filter(Boolean);
}
