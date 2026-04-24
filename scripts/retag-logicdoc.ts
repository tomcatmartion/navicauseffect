/**
 * 独立 retag 脚本：对向量库中 chunk 执行 AI 打标，更新 biz_modules 字段。
 *
 * 用法：
 *   # 全量打标（默认）
 *   npx tsx scripts/retag-logicdoc.ts
 *
 *   # 只重跑上次失败的 chunk
 *   npx tsx scripts/retag-logicdoc.ts --mode retry-failed
 *
 *   # 对指定 chunk（按显示序号，1-indexed）单独重打
 *   npx tsx scripts/retag-logicdoc.ts --chunks 11,12,382,383
 *
 *   # 指定维度和打标模式
 *   npx tsx scripts/retag-logicdoc.ts --family 1536 --tag-mode system
 *
 * 失败记录文件：scripts/retag-failures.json（自动生成）
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/db";
import { ZVecOpen } from "@zvec/zvec";
import { ensureZvecInitialized } from "../src/lib/zvec/init-zvec";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";
import { getBizModulesForFile, getTagDefinitions } from "../src/lib/logicdoc/registry";
import { aiTagChunks, type AiTagMode } from "../src/lib/logicdoc/ai-tagger";
import { createProvider } from "../src/lib/ai";

// ─── 参数解析 ───
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const family = getArg("family", "1536") as "1536" | "1024";
const tagMode = getArg("tag-mode", "system") as AiTagMode;
const chunksArg = getArg("chunks", "");
const FAILURE_FILE = join(import.meta.dirname ?? __dirname, "retag-failures.json");

type RunMode = "full" | "retry-failed" | "specific-chunks";
let runMode: RunMode = "full";
if (getArg("mode", "") === "retry-failed") {
  runMode = "retry-failed";
} else if (chunksArg) {
  runMode = "specific-chunks";
}

// ─── 失败记录 I/O ───

interface FailureRecord {
  id: string;
  chunkIndex: number;
  sourceFile: string;
  preview: string;
  failedAt: string;
  reason: string;
}

interface FailureFile {
  lastRun: string;
  family: string;
  failures: FailureRecord[];
  stats: { total: number; success: number; failed: number; skipped: number };
}

function loadFailures(): FailureFile | null {
  if (!existsSync(FAILURE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(FAILURE_FILE, "utf-8")) as FailureFile;
  } catch {
    return null;
  }
}

function saveFailures(record: FailureFile): void {
  writeFileSync(FAILURE_FILE, JSON.stringify(record, null, 2), "utf-8");
}

// ─── 主流程 ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZvecRow = any;

async function main() {
  const modeLabel = runMode === "retry-failed" ? "重跑失败" : runMode === "specific-chunks" ? "指定片段" : "全量";
  console.log(`[retag] 模式: ${modeLabel} | 维度: ${family} | 打标: ${tagMode}`);

  // 1. 获取 AI 模型配置
  const modelConfig = await prisma.aIModelConfig.findFirst({ where: { isActive: true, isDefault: true } })
    ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });
  if (!modelConfig) {
    console.error("[retag] 无可用 AI 模型配置，请先在管理后台配置");
    process.exitCode = 1;
    return;
  }
  console.log(`[retag] 使用模型: ${modelConfig.provider}/${modelConfig.modelId}`);

  const provider = createProvider({
    id: modelConfig.id, name: modelConfig.name, provider: modelConfig.provider,
    apiKey: modelConfig.apiKeyEncrypted, baseUrl: modelConfig.baseUrl, modelId: modelConfig.modelId,
  });

  // 2. 加载标签定义
  const tagDefs = await getTagDefinitions();
  console.log(`[retag] 标签定义: ${tagDefs.length} 个`, tagDefs.map(t => t.name).join(", "));

  if (tagDefs.length === 0 && tagMode !== "auto") {
    console.error("[retag] 标签定义为空，请先确认 systag/ 目录有标签文件");
    process.exitCode = 1;
    return;
  }

  // 3. 打开向量库
  ensureZvecInitialized();
  const colPath = getLogicdocCollectionPath(family);
  let col;
  try {
    col = ZVecOpen(colPath, { readOnly: false });
  } catch {
    console.error("[retag] 向量库未建立，请先执行 npm run logicdoc:index-zvec");
    process.exitCode = 1;
    return;
  }

  try {
    // 4. 查询所有记录
    const rows: ZvecRow[] = col.querySync({ filter: "source_file != ''", topk: 1024 } as any) as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error("[retag] 无分段数据");
      return;
    }
    console.log(`[retag] 向量库共 ${rows.length} 条记录`);

    // 5. 根据模式筛选目标 chunk
    let targets: Array<{ idx: number; row: ZvecRow; text: string }>;

    if (runMode === "specific-chunks") {
      // 指定片段：按显示序号（1-indexed）
      const chunkNums = chunksArg.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 1);
      if (chunkNums.length === 0) {
        console.error("[retag] --chunks 参数无效，请用逗号分隔序号，如 --chunks 11,12,382");
        return;
      }
      targets = chunkNums.map(n => ({ idx: n - 1, row: rows[n - 1], text: String(rows[n - 1]?.fields?.text ?? "").slice(0, 2000) }))
        .filter(t => t.row);
      console.log(`[retag] 指定 ${targets.length} 个片段: ${chunkNums.join(", ")}`);

    } else if (runMode === "retry-failed") {
      // 重跑失败：从 failure 文件加载
      const failureFile = loadFailures();
      if (!failureFile || failureFile.failures.length === 0) {
        console.log("[retag] 没有失败记录，无需重跑");
        return;
      }
      const failedIds = new Set(failureFile.failures.map(f => f.id));
      targets = rows
        .map((row: ZvecRow, idx: number) => ({ idx, row, text: String(row.fields?.text ?? "").slice(0, 2000) }))
        .filter(t => failedIds.has(String(t.row.id)));
      console.log(`[retag] 从失败记录中找到 ${targets.length} 个待重打片段（共 ${failureFile.failures.length} 条失败记录）`);

    } else {
      // 全量：所有 chunk
      targets = rows.map((row: ZvecRow, idx: number) => ({ idx, row, text: String(row.fields?.text ?? "").slice(0, 2000) }));
    }

    if (targets.length === 0) {
      console.log("[retag] 无待处理片段");
      return;
    }

    // 6. 按文件分组
    const fileGroups = new Map<string, typeof targets>();
    for (const t of targets) {
      const sf = String(t.row.fields?.source_file ?? "");
      if (!fileGroups.has(sf)) fileGroups.set(sf, []);
      fileGroups.get(sf)!.push(t);
    }
    console.log(`[retag] 涉及 ${fileGroups.size} 个文件，${targets.length} 个片段\n`);

    // 7. 逐文件打标
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalAiCalls = 0;
    const failures: FailureRecord[] = [];

    for (const [fileName, items] of fileGroups) {
      console.log(`[retag] 文件: ${fileName} (${items.length} 段)`);

      const fileBizModules = await getBizModulesForFile(fileName, prisma);
      const chunks = items.map(item => item.text);

      const aiTagMap = await aiTagChunks(
        provider, chunks, tagMode, tagDefs, fileBizModules,
        (batchIdx, totalBatches) => {
          totalAiCalls++;
          console.log(`[retag]   批次 ${batchIdx}/${totalBatches} 完成`);
        }
      );

      for (let i = 0; i < items.length; i++) {
        const { row, idx } = items[i];
        const newTags = aiTagMap.get(i);
        const oldTags: string[] = row.fields?.biz_modules ?? [];

        if (newTags && newTags.length > 0 && newTags[0] !== "通用") {
          // AI 打标成功
          const changed = JSON.stringify(oldTags) !== JSON.stringify(newTags);
          if (changed) {
            col.updateSync({ id: row.id, fields: { biz_modules: newTags } });
            totalSuccess++;
          } else {
            totalSkipped++;
          }
          if (i < 3 || changed) {
            console.log(`[retag]   #${idx + 1} ${oldTags.join(",")} → ${newTags.join(",")}`);
          }
        } else {
          // AI 打标失败（返回空或仍是通用兜底）
          totalFailed++;
          failures.push({
            id: String(row.id),
            chunkIndex: idx,
            sourceFile: fileName,
            preview: chunks[i].slice(0, 80),
            failedAt: new Date().toISOString(),
            reason: newTags ? "AI 返回通用兜底标签" : "AI 打标无结果",
          });
          console.log(`[retag]   #${idx + 1} 失败: ${failures[failures.length - 1].reason}`);
        }
      }
    }

    // 8. 保存失败记录
    const failureRecord: FailureFile = {
      lastRun: new Date().toISOString(),
      family,
      failures,
      stats: { total: targets.length, success: totalSuccess, failed: totalFailed, skipped: totalSkipped },
    };
    saveFailures(failureRecord);

    // 9. 汇总输出
    console.log("\n" + "=".repeat(50));
    console.log(`[retag] 完成！`);
    console.log(`  总计: ${targets.length} 段`);
    console.log(`  成功更新: ${totalSuccess} 段`);
    console.log(`  无变化跳过: ${totalSkipped} 段`);
    console.log(`  失败: ${totalFailed} 段`);
    console.log(`  AI 调用: ${totalAiCalls} 次`);

    if (totalFailed > 0) {
      console.log(`\n  失败记录已保存至: ${FAILURE_FILE}`);
      console.log(`  重跑失败片段: npx tsx scripts/retag-logicdoc.ts --mode retry-failed`);
      console.log(`  指定片段重打: npx tsx scripts/retag-logicdoc.ts --chunks ${failures.slice(0, 5).map(f => f.chunkIndex + 1).join(",")}${failures.length > 5 ? ",..." : ""}`);
    } else {
      console.log(`  所有片段打标成功！`);
    }
  } finally {
    col.closeSync();
  }
}

main()
  .catch((e) => {
    console.error("[retag] 失败:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
