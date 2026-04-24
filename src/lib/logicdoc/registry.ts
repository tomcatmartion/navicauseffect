/**
 * logicdoc 文件名 → 业务标签
 *
 * 标签解析链路（优先级从高到低）：
 * 1. AdminConfig `logicdoc_tags_{fileId}` — 管理后台手动指定
 * 2. AdminConfig `logicdoc_tags_{fileName}` — 旧 key 兼容查询
 * 3. 兜底 → ["通用"]
 *
 * 标签定义来源：sysfiles/systag/ 目录下的 .json 文件（动态加载合并）。
 * file_id 来自 sysfiles/sysknowledge/file-registry.json 的稳定映射，
 * 文件改名不影响 file_id，从而保持标签关联不断裂。
 */
import { readFile, readdir } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";

export type LogicdocBizTag = string;

export interface TagRuleDef {
  name: string;
  desc: string;
  keywords: string[];
}

// ─── file-registry.json 类型 ───

interface FileRegistry {
  version: number;
  mappings: Record<string, string>;
}

// ─── file-registry.json 加载（带缓存） ───

let _fileRegistryCache: FileRegistry | null = null;

async function loadFileRegistry(): Promise<FileRegistry | null> {
  if (_fileRegistryCache) return _fileRegistryCache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "sysfiles/sysknowledge/file-registry.json"),
      "utf-8"
    );
    _fileRegistryCache = JSON.parse(raw) as FileRegistry;
    return _fileRegistryCache;
  } catch {
    return null;
  }
}

/** 清除缓存（测试用） */
export function clearFileRegistryCache(): void {
  _fileRegistryCache = null;
}

/**
 * 将文件名解析为稳定的 file_id。
 * 优先查 file-registry.json 映射；无映射则返回 fileName 本身（向后兼容）。
 */
export async function resolveFileId(fileName: string): Promise<string> {
  const registry = await loadFileRegistry();
  if (registry?.mappings?.[fileName]) {
    return registry.mappings[fileName];
  }
  return fileName;
}

/** 同步版本（供不需要异步的场景使用，如管理后台 API 内部） */
export function getFileIdForName(fileName: string): string {
  if (_fileRegistryCache?.mappings?.[fileName]) {
    return _fileRegistryCache.mappings[fileName];
  }
  return fileName;
}

// ─── systag/ 目录加载（带缓存） ───

let _systagCache: TagRuleDef[] | null = null;

/**
 * 从 systag/ 目录加载所有 .json 文件，合并标签定义（按 name 去重）。
 */
async function loadSystagDefinitions(): Promise<TagRuleDef[]> {
  if (_systagCache) return _systagCache;

  const systagPath = path.join(process.cwd(), "sysfiles/systag");
  const merged = new Map<string, TagRuleDef>();

  try {
    const names = await readdir(systagPath);
    const jsonFiles = names.filter((n) => n.endsWith(".json")).sort();

    for (const name of jsonFiles) {
      try {
        const raw = await readFile(path.join(systagPath, name), "utf-8");
        const parsed = JSON.parse(raw) as { tags?: TagRuleDef[] };
        if (Array.isArray(parsed.tags)) {
          for (const tag of parsed.tags) {
            if (tag.name && typeof tag.name === "string") {
              // 后出现的覆盖先出现的（按文件名排序）
              merged.set(tag.name, {
                name: tag.name,
                desc: tag.desc ?? "",
                keywords: tag.keywords ?? [],
              });
            }
          }
        }
      } catch {
        // 单个文件解析失败，跳过
      }
    }
  } catch {
    // systag 目录不存在或读取失败，返回空
  }

  _systagCache = [...merged.values()];
  return _systagCache;
}

/** 清除 systag 缓存（删除/上传文件后调用） */
export function clearSystagCache(): void {
  _systagCache = null;
}

/**
 * 标签解析（优先级从高到低）：
 * 1. AdminConfig `logicdoc_tags_{fileId}` — 管理后台通过 file_id 指定
 * 2. AdminConfig `logicdoc_tags_{fileName}` — 旧 key 兼容查询
 * 3. 兜底 → ["通用"]
 */
export async function getBizModulesForFile(
  fileName: string,
  prisma?: PrismaClient
): Promise<LogicdocBizTag[]> {
  const fileId = await resolveFileId(fileName);

  // 层1：管理后台手动标签（file_id）
  if (prisma) {
    try {
      const config = await prisma.adminConfig.findUnique({
        where: { configKey: `logicdoc_tags_${fileId}` },
      });
      if (config?.configValue) {
        const tags = JSON.parse(config.configValue as string);
        if (Array.isArray(tags) && tags.length > 0) return tags as LogicdocBizTag[];
      }
    } catch { /* 忽略 */ }
  }

  // 层2：管理后台手动标签（旧 fileName key，向后兼容）
  if (prisma && fileId !== fileName) {
    try {
      const config = await prisma.adminConfig.findUnique({
        where: { configKey: `logicdoc_tags_${fileName}` },
      });
      if (config?.configValue) {
        const tags = JSON.parse(config.configValue as string);
        if (Array.isArray(tags) && tags.length > 0) return tags as LogicdocBizTag[];
      }
    } catch { /* 忽略 */ }
  }

  // 兜底
  return ["通用" as LogicdocBizTag];
}

/**
 * 读取标签定义列表（供 AI 打标和前端使用）。
 * 从 systag/ 目录动态加载所有 .json 文件并合并。
 */
export async function getTagDefinitions(): Promise<TagRuleDef[]> {
  return loadSystagDefinitions();
}

/**
 * 根据类别关联的标签名，从 systag 标签定义中提取所有 keywords 并合并去重。
 * 用于检索词生成时自动注入与打标体系一致的领域关键词。
 * @param maxKeywords 最大关键词数量，默认 25，避免检索词膨胀
 */
export async function extractSystagKeywordsForCategory(
  categoryBizTags: string[],
  maxKeywords = 25
): Promise<string> {
  const tagDefs = await loadSystagDefinitions();
  const tagMap = new Map(tagDefs.map((t) => [t.name, t]));
  const allKeywords: string[] = [];
  const seen = new Set<string>();

  for (const tagName of categoryBizTags) {
    // 只取 systag 新标签定义（跳过旧标签兼容名）
    const def = tagMap.get(tagName);
    if (def?.keywords?.length) {
      for (const kw of def.keywords) {
        if (kw.length >= 2 && !seen.has(kw)) {
          seen.add(kw);
          allKeywords.push(kw);
        }
      }
    }
  }

  // 截断到上限，保持插入顺序
  return allKeywords.slice(0, maxKeywords).join(" ");
}
