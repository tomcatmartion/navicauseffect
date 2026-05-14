import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ZVecOpen } from "@zvec/zvec";
import { ensureZvecInitialized } from "@/lib/zvec/init-zvec";
import { getLogicdocCollectionPath } from "@/lib/zvec/paths";
import { getBizModulesForFile, getTagDefinitions } from "@/lib/logicdoc/registry";
import { aiTagChunks, type AiTagMode } from "@/lib/logicdoc/ai-tagger";
import { createProvider } from "@/lib/ai";
import { readRetagProgress, writeRetagProgress, type RetagLogEntry } from "@/lib/logicdoc/retag-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * POST: 启动后台重新打标任务。
 * 立即返回，打标在服务端后台运行，进度写入 retag-progress.json。
 * body: {
 *   family?: "1536"|"1024",
 *   file?: string,
 *   mode?: "system"|"hybrid"|"auto",
 *   chunkIds?: string[],
 *   retagFailed?: boolean,
 * }
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  // 检查是否有正在运行的任务
  const currentProgress = await readRetagProgress();
  if (currentProgress.status === "running") {
    return NextResponse.json({ error: "已有打标任务正在运行" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const family = (body.family as "1536" | "1024") ?? "1536";
  const targetFile = body.file as string | undefined;
  const mode: AiTagMode = ["system", "hybrid", "auto"].includes(body.mode as string) ? body.mode as AiTagMode : "system";
  const chunkIds: string[] = Array.isArray(body.chunkIds) ? body.chunkIds as string[] : [];
  const retagFailed: boolean = body.retagFailed === true;

  // 确定任务类型标签
  const typeLabel = chunkIds.length > 0 ? "chunkIds" : retagFailed ? "retagFailed" : "full";

  // 启动后台任务（不 await，让它在后台运行）
  // 先清除旧的 error 状态，确保重新执行时不会残留之前的错误信息
  await writeRetagProgress({ status: "idle", error: undefined });
  runRetagBackground({ family, targetFile, mode, chunkIds, retagFailed, typeLabel }).catch((e) => {
    console.error("[retag] 后台任务异常退出:", e);
  });

  return NextResponse.json({ started: true, mode, type: typeLabel });
}

/**
 * 后台执行打标任务。
 * 进度通过 writeRetagProgress 实时写入文件，前端轮询获取。
 */
async function runRetagBackground(params: {
  family: "1536" | "1024";
  targetFile?: string;
  mode: AiTagMode;
  chunkIds: string[];
  retagFailed: boolean;
  typeLabel: string;
}): Promise<void> {
  const { family, targetFile, mode, chunkIds, retagFailed, typeLabel } = params;

  // 初始化进度
  await writeRetagProgress({
    status: "running",
    mode,
    type: typeLabel,
    model: "加载中...",
    totalChunks: 0,
    processedChunks: 0,
    updatedChunks: 0,
    skippedChunks: 0,
    aiCalls: 0,
    files: 0,
    currentFile: "准备中...",
    startedAt: new Date().toISOString(),
    completedAt: undefined,
    error: undefined,
  });

  try {
    // 1. 获取 AI provider
    const modelConfig = await prisma.aIModelConfig.findFirst({ where: { isActive: true, isDefault: true } })
      ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });
    if (!modelConfig) {
      await writeRetagProgress({ status: "error", error: "无可用 AI 模型" });
      return;
    }

    const provider = createProvider({
      id: modelConfig.id, name: modelConfig.name, provider: modelConfig.provider,
      apiKey: modelConfig.apiKeyEncrypted, baseUrl: modelConfig.baseUrl, modelId: modelConfig.modelId,
    });

    await writeRetagProgress({ model: `${modelConfig.provider}/${modelConfig.modelId}` });

    // 2. 加载标签定义
    const tagDefs = await getTagDefinitions();
    if (tagDefs.length === 0 && mode !== "auto") {
      await writeRetagProgress({ status: "error", error: "标签体系为空，请先上传标签文件，或使用「AI 自动识别」模式" });
      return;
    }

    // 3. 打开向量库
    ensureZvecInitialized();
    const colPath = getLogicdocCollectionPath(family);
    let col;
    try {
      col = ZVecOpen(colPath, { readOnly: false });
    } catch {
      await writeRetagProgress({ status: "error", error: "向量库未建立" });
      return;
    }

    try {
      // 4. 查询记录
      const filter = targetFile
        ? `source_file = '${targetFile.replace(/'/g, "''")}'`
        : "source_file != ''";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = col.querySync({ filter, topk: 1024 } as any) as any[];
      if (!Array.isArray(rows) || rows.length === 0) {
        await writeRetagProgress({ status: "error", error: "无分段数据" });
        return;
      }

      // 5. 筛选目标 chunk
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let targets: Array<{ idx: number; row: any; text: string }>;

      if (chunkIds.length > 0) {
        const idSet = new Set(chunkIds);
        targets = rows
          .map((row: any, idx: number) => ({ idx, row, text: String(row.fields?.text ?? "").slice(0, 2000) }))
          .filter((t) => idSet.has(String(t.row.id)));
        if (targets.length === 0) {
          await writeRetagProgress({ status: "completed", error: "指定的 chunk ID 未在向量库中找到", totalChunks: 0 });
          return;
        }
      } else if (retagFailed) {
        targets = rows
          .map((row: any, idx: number) => ({ idx, row, text: String(row.fields?.text ?? "").slice(0, 2000) }))
          .filter((t) => {
            const mods: string[] = t.row.fields?.biz_modules ?? [];
            return mods.length === 0 || (mods.length === 1 && mods[0] === "通用");
          });
        if (targets.length === 0) {
          await writeRetagProgress({
            status: "completed",
            totalChunks: 0,
            processedChunks: 0,
            currentFile: "",
            completedAt: new Date().toISOString(),
          });
          return;
        }
      } else {
        targets = rows.map((row: any, idx: number) => ({ idx, row, text: String(row.fields?.text ?? "").slice(0, 2000) }));
      }

      const totalChunks = targets.length;
      // 根据任务类型生成初始日志
      const initLogs: RetagLogEntry[] = [];
      if (retagFailed) {
        initLogs.push({ type: "start", text: `扫描完成：发现 ${totalChunks} 个失败片段（标签为「通用」或空）` });
      } else if (chunkIds.length > 0) {
        initLogs.push({ type: "start", text: `指定片段重打：共 ${totalChunks} 个片段` });
      } else {
        initLogs.push({ type: "start", text: `全量打标：共 ${totalChunks} 段` });
      }
      initLogs.push({ type: "start", text: `模型 ${modelConfig.provider}/${modelConfig.modelId}，模式 ${mode}，涉及 ${new Set(targets.map(t => String(t.row.fields?.source_file ?? ""))).size} 个文件` });

      await writeRetagProgress({ totalChunks, currentFile: "", logs: initLogs });

      // 6. 按文件分组
      const fileGroups = new Map<string, typeof targets>();
      for (const t of targets) {
        const sf = String(t.row.fields?.source_file ?? "");
        if (!fileGroups.has(sf)) fileGroups.set(sf, []);
        fileGroups.get(sf)!.push(t);
      }

      await writeRetagProgress({
        files: fileGroups.size,
      });

      // 7. 逐文件打标
      let processedChunks = 0;
      let updatedChunks = 0;
      let skippedChunks = 0;
      let aiCalls = 0;
      const BATCH_SIZE = 5;
      const logs: RetagLogEntry[] = [...initLogs];

      /** 追加日志并定期写入进度文件 */
      const appendLog = (entry: RetagLogEntry) => {
        logs.push(entry);
        // 每 5 条日志写入一次
        if (logs.length % 5 === 0) {
          writeRetagProgress({ logs: [...logs] }).catch(() => {});
        }
      };

      for (const [fileName, items] of fileGroups) {
        appendLog({ type: "file", text: `处理文件：${fileName}（${items.length} 段）` });
        await writeRetagProgress({ currentFile: fileName, logs: [...logs] });

        const fileBizModules = await getBizModulesForFile(fileName, prisma);
        const chunkTexts = items.map((item) => item.text);
        const fileProcessedBase = processedChunks;

        const aiTagMap = await aiTagChunks(
          provider, chunkTexts, mode, tagDefs, fileBizModules,
          (batchIdx, totalBatches) => {
            aiCalls++;
            // 用批次进度预估已处理片段数
            const estimatedDone = Math.min(batchIdx * BATCH_SIZE, items.length);
            const estimatedProcessed = fileProcessedBase + estimatedDone;
            appendLog({ type: "batch", text: `AI 批次 ${batchIdx}/${totalBatches} 完成` });
            writeRetagProgress({ processedChunks: estimatedProcessed, aiCalls, logs: [...logs] }).catch(() => {});
          }
        );

        for (let i = 0; i < items.length; i++) {
          const { row, idx } = items[i];
          const aiResult = aiTagMap.get(i);
          const oldTags: string[] = row.fields?.biz_modules ?? [];

          // AI 打标失败时不覆盖原有标签
          const isFailed = !aiResult || aiResult.length === 0 || (aiResult.length === 1 && aiResult[0] === "通用");
          const newTags = isFailed ? oldTags : aiResult;

          if (!isFailed) {
            col.updateSync({
              id: row.id,
              fields: { biz_modules: aiResult },
            });
            updatedChunks++;
          } else {
            skippedChunks++;
          }
          processedChunks++;

          // 记录每段打标结果（标签有变化或失败的才记录，避免日志过多）
          const changed = JSON.stringify(oldTags) !== JSON.stringify(newTags);
          if (changed || isFailed) {
            appendLog({
              type: "chunk",
              text: isFailed
                ? `⊘ #${idx + 1} ${chunkTexts[i].slice(0, 50)}… AI 无有效结果，保留原标签`
                : `✦ #${idx + 1} ${chunkTexts[i].slice(0, 50)}…`,
              oldTags,
              newTags,
            });
          }
        }

        // 每个文件处理完后更新精确进度
        await writeRetagProgress({ processedChunks, updatedChunks, skippedChunks, aiCalls, logs: [...logs] });
      }

      // 8. 完成
      logs.push({ type: "done", text: `完成！${updatedChunks} 段已更新，${skippedChunks} 段跳过，${aiCalls} 次 AI 调用` });
      await writeRetagProgress({
        status: "completed",
        processedChunks,
        updatedChunks,
        skippedChunks,
        aiCalls,
        currentFile: "",
        completedAt: new Date().toISOString(),
        logs: [...logs],
      });
    } finally {
      col.closeSync();
    }
  } catch (error) {
    console.error("[retag] error:", error);
    const msg = error instanceof Error ? error.message : "重新打标失败";
    await writeRetagProgress({
      status: "error",
      error: msg,
      completedAt: new Date().toISOString(),
    });
  }
}
