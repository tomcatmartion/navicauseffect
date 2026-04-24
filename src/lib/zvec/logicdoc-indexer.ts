import { readdir } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import {
  ZVecCreateAndOpen,
  ZVecOpen,
  type ZVecCollection,
} from "@zvec/zvec";
import { chunkLogicdocText } from "@/lib/logicdoc/chunk-text";
import { chunkLogicdocMarkdown } from "@/lib/logicdoc/chunk-text-markdown";
import {
  extractChunkMetadata,
  stableChunkId,
} from "@/lib/logicdoc/chunk-metadata";
import { getBizModulesForFile, getTagDefinitions } from "@/lib/logicdoc/registry";
import { isSupportedFile, parseFileToMarkdown } from "@/lib/logicdoc/file-parser";
import {
  getEmbeddingConfigForFamily,
  type EmbeddingRuntimeConfig,
} from "./embedding-config";
import { fetchEmbeddingVector } from "./fetch-embedding";
import { ensureZvecInitialized } from "./init-zvec";
import {
  buildLogicdocCollectionSchema,
  getStoredIndexVersion,
} from "./logicdoc-schema";
import { getLogicdocCollectionPath } from "./paths";
import {
  embeddingCollectionDimension,
  type EmbeddingDimensionFamily,
} from "./constants";
import { readIndexProgress, writeIndexProgress, type IndexProgress } from "./index-progress";
import { aiTagChunks, type AiTagResult } from "@/lib/logicdoc/ai-tagger";
import { createProvider } from "@/lib/ai";

const LOGICDOC_DIR = "sysfiles/sysknowledge";

function openWriteCollection(family: EmbeddingDimensionFamily): ZVecCollection {
  const p = getLogicdocCollectionPath(family);
  ensureZvecInitialized();
  try {
    return ZVecOpen(p, { readOnly: false });
  } catch {
    return ZVecCreateAndOpen(p, buildLogicdocCollectionSchema(family), {});
  }
}

/** 缺省时跳过该维 collection，避免「只配了 1536（如 MiniMax）却因未配 1024 导致整次索引失败、向量库始终为空」。 */
async function tryGetEmbeddingConfig(
  prisma: PrismaClient,
  family: EmbeddingDimensionFamily
): Promise<EmbeddingRuntimeConfig | null> {
  try {
    return await getEmbeddingConfigForFamily(prisma, family);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[logicdoc-index] 未配置 ${family} 维 embedding，跳过 sysknowledge_dim${family}：` +
        msg.replace(/\s+/g, " ").slice(0, 200)
    );
    return null;
  }
}

export interface LogicdocIndexStats {
  files: number;
  chunks: number;
  apiCalls1536: number;
  apiCalls1024: number;
  aiTagCalls: number;
  skippedPairs: number;
}

/**
 * 双 collection 写入；按 content_hash 跳过未改块，减少 Embedding API 费用。
 * 调用方须已持有文件锁（withLogicdocIndexFileLock）。
 */
export async function runLogicdocZvecIndex(
  prisma: PrismaClient
): Promise<LogicdocIndexStats> {
  const root = path.join(process.cwd(), LOGICDOC_DIR);

  const cfg1536 = await tryGetEmbeddingConfig(prisma, "1536");
  const cfg1024 = await tryGetEmbeddingConfig(prisma, "1024");
  if (!cfg1536 && !cfg1024) {
    throw new Error(
      "至少需要配置 1536 或 1024 维 embedding 之一：请在管理后台「Embedding / 向量库」保存至少一套完整配置，" +
        "或设置环境变量 EMBEDDING_1536_* / EMBEDDING_1024_*。"
    );
  }

  const col1536 = cfg1536 ? openWriteCollection("1536") : null;
  const col1024 = cfg1024 ? openWriteCollection("1024") : null;

  const stats: LogicdocIndexStats = {
    files: 0,
    chunks: 0,
    apiCalls1536: 0,
    apiCalls1024: 0,
    aiTagCalls: 0,
    skippedPairs: 0,
  };

  const iv = getStoredIndexVersion();

  // 准备 AI 打标
  const tagDefs = await getTagDefinitions();
  let aiProvider: Awaited<ReturnType<typeof createProvider>> | null = null;
  try {
    const modelConfig = await prisma.aIModelConfig.findFirst({ where: { isActive: true, isDefault: true } })
      ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });
    if (modelConfig) {
      aiProvider = createProvider({
        id: modelConfig.id,
        name: modelConfig.name,
        provider: modelConfig.provider,
        apiKey: modelConfig.apiKeyEncrypted,
        baseUrl: modelConfig.baseUrl,
        modelId: modelConfig.modelId,
      });
    }
  } catch {
    // AI 打标不可用，回退到关键词匹配
  }
  const aiAvailable = !!aiProvider;
  console.log(`[logicdoc-index] AI 打标: ${aiAvailable ? "已启用" : "不可用，使用关键词匹配"}`);

  // 进度跟踪初始化
  let progress: IndexProgress = {
    status: "running",
    totalFiles: 0,
    processedFiles: 0,
    totalChunks: 0,
    processedChunks: 0,
    apiCalls1536: 0,
    apiCalls1024: 0,
    skippedChunks: 0,
    aiTagCalls: 0,
    currentFile: "",
    startedAt: new Date().toISOString(),
  };

  try {
    const names = await readdir(root);
    const docFiles = names
      .filter((n) => isSupportedFile(n))
      .sort((a, b) => a.localeCompare(b, "zh-CN"));

    progress.totalFiles = docFiles.length;
    await writeIndexProgress(progress);

    for (const name of docFiles) {
      const filePath = path.join(root, name);
      let fullText: string;
      try {
        fullText = await parseFileToMarkdown(filePath, name);
      } catch (e) {
        console.warn("[logicdoc-index] skip file:", name, e);
        progress.processedFiles += 1;
        progress.currentFile = name;
        await writeIndexProgress(progress);
        continue;
      }
      if (!fullText) {
        progress.processedFiles += 1;
        progress.currentFile = name;
        await writeIndexProgress(progress);
        continue;
      }
      stats.files += 1;

      progress.currentFile = name;
      await writeIndexProgress(progress);

      const sourceRel = `${LOGICDOC_DIR}/${name}`;
      // 两层标签解析：AdminConfig → 兜底
      const fileBizModules = await getBizModulesForFile(name, prisma);
      const pieces =
        process.env.LOGICDOC_CHUNK_STRATEGY !== "text"
          ? chunkLogicdocMarkdown(fullText)
          : chunkLogicdocText(fullText);

      progress.totalChunks += pieces.length;
      await writeIndexProgress(progress);

      // ─── AI 批量打标（对新增/变更/标签缺失的 chunk） ───
      let aiTagMap: AiTagResult = new Map();

      // 先收集所有 chunk 的元数据，确定哪些需要处理
      const chunkMetas = pieces.map((text, i) => {
        const meta = extractChunkMetadata(text);
        const id = stableChunkId(sourceRel, i);
        return { text, meta, id, chunkIndex: i };
      });

      // 筛选出需要 embedding 的 chunk（新增或 content_hash 变更）
      const chunksToEmbed: string[] = [];
      // 筛选出需要打标的 chunk（包括已存在但标签为默认"通用"的）
      const chunksToTag: string[] = [];
      for (const cm of chunkMetas) {
        const ex1536 = col1536 ? col1536.fetchSync(cm.id)[cm.id] : undefined;
        const ex1024 = col1024 ? col1024.fetchSync(cm.id)[cm.id] : undefined;
        const need1536 = !!col1536 && (!ex1536 || ex1536.fields?.content_hash !== cm.meta.content_hash);
        const need1024 = !!col1024 && (!ex1024 || ex1024.fields?.content_hash !== cm.meta.content_hash);
        if (need1536 || need1024) {
          chunksToEmbed.push(cm.text);
          chunksToTag.push(cm.text);
        } else {
          // 已存在的 chunk，检查标签是否为默认"通用"兜底值
          const existing = ex1536 ?? ex1024;
          const existingTags: string[] = existing?.fields?.biz_modules ?? [];
          if (existingTags.length === 0 || (existingTags.length === 1 && (existingTags[0] === "通用" || existingTags[0] === "always"))) {
            chunksToTag.push(cm.text);
          }
        }
      }

      // 对需要打标的 chunk 执行 AI 批量打标（默认使用 system 模式）
      if (tagDefs.length === 0) {
        console.warn("[logicdoc-index] systag 标签定义为空，AI 打标已跳过，所有 chunk 将使用文件级标签。请在管理后台上传标签文件。");
      }
      if (aiProvider && chunksToTag.length > 0 && tagDefs.length > 0) {
        try {
          aiTagMap = await aiTagChunks(aiProvider, chunksToTag, "system", tagDefs, fileBizModules, (batchIdx, totalBatches) => {
            stats.aiTagCalls += 1;
            progress.aiTagCalls = (progress.aiTagCalls ?? 0) + 1;
          });
        } catch {
          // AI 打标整体失败，回退到关键词匹配
        }
      }

      // ─── 逐 chunk 写入 Zvec ───
      let chunkIndex = 0;
      let tagIdx = 0; // 跟踪 chunksToTag 中的索引
      for (const text of pieces) {
        const meta = extractChunkMetadata(text);
        const id = stableChunkId(sourceRel, chunkIndex);
        chunkIndex += 1;
        stats.chunks += 1;

        const ex1536 = col1536 ? col1536.fetchSync(id)[id] : undefined;
        const ex1024 = col1024 ? col1024.fetchSync(id)[id] : undefined;
        const need1536 =
          !!col1536 &&
          (!ex1536 || ex1536.fields?.content_hash !== meta.content_hash);
        const need1024 =
          !!col1024 &&
          (!ex1024 || ex1024.fields?.content_hash !== meta.content_hash);

        // 确定标签：优先 AI 打标，回退到文件级标签
        let chunkBizModules: string[];
        if (aiTagMap.has(tagIdx)) {
          chunkBizModules = aiTagMap.get(tagIdx)!;
        } else {
          chunkBizModules = fileBizModules;
        }
        tagIdx += 1;

        // 已存在且 content_hash 不变的 chunk：如果标签仍是默认"通用"且有 AI 打标结果，单独更新标签
        if (!need1536 && !need1024) {
          const existing = ex1536 ?? ex1024;
          const oldTags: string[] = existing?.fields?.biz_modules ?? [];
          const tagsChanged = JSON.stringify(oldTags) !== JSON.stringify(chunkBizModules);
          if (tagsChanged && col1536) {
            col1536.updateSync({ id, fields: { biz_modules: chunkBizModules } });
          }
          if (tagsChanged && col1024) {
            col1024.updateSync({ id, fields: { biz_modules: chunkBizModules } });
          }
          stats.skippedPairs += 1;
          progress.skippedChunks += 1;
          progress.processedChunks += 1;
          continue;
        }

        /** biz_modules：片段级业务标签（多主题文件已根据宫位细化） */
        const fields = {
          text,
          source_file: name,
          content_hash: meta.content_hash,
          index_version: iv,
          biz_modules: chunkBizModules,
          stars: meta.stars,
          palaces: meta.palaces,
          energy_levels: meta.energy_levels,
          time_scopes: meta.time_scopes,
        };

        let vec1536: number[] | null = null;
        let vec1024: number[] | null = null;
        if (need1536 && cfg1536) {
          vec1536 = await fetchEmbeddingVector(cfg1536, text, {
            expectedDimension: embeddingCollectionDimension("1536"),
            callRole: "document",
          });
          stats.apiCalls1536 += 1;
          progress.apiCalls1536 += 1;
        }
        if (need1024 && cfg1024) {
          vec1024 = await fetchEmbeddingVector(cfg1024, text, {
            expectedDimension: embeddingCollectionDimension("1024"),
            callRole: "document",
          });
          stats.apiCalls1024 += 1;
          progress.apiCalls1024 += 1;
        }

        if (need1536 && vec1536 && col1536) {
          col1536.upsertSync({
            id,
            vectors: { embedding: vec1536 },
            fields,
          });
        }
        if (need1024 && vec1024 && col1024) {
          col1024.upsertSync({
            id,
            vectors: { embedding: vec1024 },
            fields,
          });
        }

        progress.processedChunks += 1;
        // 每 5 个块写一次进度，避免频繁 IO
        if (progress.processedChunks % 5 === 0) {
          await writeIndexProgress(progress);
        }
      }

      progress.processedFiles += 1;
      await writeIndexProgress(progress);
    }

    /**
     * optimize 会重建图结构，大数据集上可能长时间打满 CPU。
     * 需要时可设 LOGICDOC_ZVEC_SKIP_OPTIMIZE=1 跳过（检索仍可工作，略损性能）。
     */
    if (process.env.LOGICDOC_ZVEC_SKIP_OPTIMIZE !== "1") {
      col1536?.optimizeSync();
      col1024?.optimizeSync();
    }

    // 标记完成
    progress.status = "completed";
    progress.completedAt = new Date().toISOString();
    await writeIndexProgress(progress);
  } catch (err) {
    progress.status = "error";
    progress.error = err instanceof Error ? err.message : String(err);
    await writeIndexProgress(progress);
    throw err;
  } finally {
    col1536?.closeSync();
    col1024?.closeSync();
  }

  return stats;
}
