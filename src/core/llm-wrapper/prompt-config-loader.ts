/**
 * Prompt 模板配置加载器（v2）
 *
 * 职责：从权威 .md/.json 文件加载 Prompt 配置
 * 权威来源：
 *   - data/ziwei-chat-prompt.md（统一模板，综合所有规则）
 *   - data/System Prompt.md（AI 角色定义 + 合参规则 + 分析规则）
 *   - data/User Prompt.md（事项分析报告的固定输出结构）
 *   - data/输出给大模型的数据格式.json（数据格式规范）
 *
 * 已废弃：data/prompt_templates.json（不再加载）
 */

import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════════
// 文件路径
// ═══════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(process.cwd(), 'data')
const UNIFIED_TEMPLATE_PATH = path.join(DATA_DIR, 'ziwei-chat-prompt.md')
const SYSTEM_PROMPT_PATH = path.join(DATA_DIR, 'System Prompt.md')
const USER_PROMPT_PATH = path.join(DATA_DIR, 'User Prompt.md')
const DATA_FORMAT_PATH = path.join(DATA_DIR, '输出给大模型的数据格式.json')

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/** 数据格式规范中的一个宫位数据 */
export interface DataFormatPalace {
  palaceName: string
  majorStars: string
  minorStars: string
  sihua: string | null
  score: number
  level: string
  threeQuadrants?: {
    opposite: DataFormatPalace
    firstTrine: DataFormatPalace
    secondTrine: DataFormatPalace
  }
}

/** 数据格式规范中的四化条目 */
export interface DataFormatSihuaEntry {
  type: string
  star: string
  palace: string
}

/** 数据格式规范中的引动条目 */
export interface DataFormatTrigger {
  type: string
  relation: string
  targetPalace: string
  targetStar: string
}

/** 完整的数据格式规范（对应 输出给大模型的数据格式.json） */
export interface DataFormatSchema {
  matterType: string
  mode: string
  targetYear: number
  currentYear: number
  yuanJu: {
    ming: DataFormatPalace
    primary: DataFormatPalace
    secondary: DataFormatPalace[]
    sihuaSummary: {
      shengNian: DataFormatSihuaEntry[]
      taiSui: DataFormatSihuaEntry[]
    }
  }
  daXian: {
    ageRange: string
    ming: DataFormatPalace
    primary: DataFormatPalace
    sihua: { list: DataFormatSihuaEntry[] }
    triggersToYuanJu: { list: DataFormatTrigger[] }
  }
  liuNian: {
    year: number
    ming: DataFormatPalace
    primary: DataFormatPalace
    sihua: { list: DataFormatSihuaEntry[] }
    luCun: { palace: string }
    triggersToDaXian: { list: DataFormatTrigger[] }
    overlap: {
      primaryPalace: string
      affectedPalaces: string[]
      isDirect: boolean
    }
  }
  compositeScore: number
  scoreLabel: string
}

/** 统一 Prompt 配置 */
export interface ZiweiPromptConfig {
  /** 统一模板全文（ziwei-chat-prompt.md） */
  unifiedTemplate: string
  /** System Prompt 全文（System Prompt.md） */
  systemPrompt: string
  /** User Prompt 全文 — 报告输出结构（User Prompt.md） */
  userPromptTemplate: string
  /** 数据格式规范（输出给大模型的数据格式.json） */
  dataFormatSchema: DataFormatSchema
}

// ═══════════════════════════════════════════════════════════════════
// 缓存（支持热加载）
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T | null
  mtime: number
}

const unifiedTemplateCache: CacheEntry<string> = { data: null, mtime: 0 }
const systemPromptCache: CacheEntry<string> = { data: null, mtime: 0 }
const userPromptCache: CacheEntry<string> = { data: null, mtime: 0 }
const dataFormatCache: CacheEntry<DataFormatSchema> = { data: null, mtime: 0 }

// ═══════════════════════════════════════════════════════════════════
// 核心加载函数
// ═══════════════════════════════════════════════════════════════════

function loadTextFile(filePath: string, cache: CacheEntry<string>): string {
  try {
    const stat = fs.statSync(filePath)
    const currentMtime = stat.mtimeMs

    if (currentMtime !== cache.mtime || cache.data === null) {
      cache.data = fs.readFileSync(filePath, 'utf-8')
      cache.mtime = currentMtime
    }
  } catch (err) {
    console.error(`[prompt-config] Failed to load ${path.basename(filePath)}:`, err)
    if (!cache.data) {
      cache.data = ''
    }
  }
  return cache.data!
}

function loadJsonFile<T>(filePath: string, cache: CacheEntry<T>): T {
  try {
    const stat = fs.statSync(filePath)
    const currentMtime = stat.mtimeMs

    if (currentMtime !== cache.mtime || cache.data === null) {
      const content = fs.readFileSync(filePath, 'utf-8')
      cache.data = JSON.parse(content) as T
      cache.mtime = currentMtime
    }
  } catch (err) {
    console.error(`[prompt-config] Failed to load ${path.basename(filePath)}:`, err)
    if (!cache.data) {
      cache.data = {} as T
    }
  }
  return cache.data!
}

// ═══════════════════════════════════════════════════════════════════
// 对外 API
// ═══════════════════════════════════════════════════════════════════

/** 加载统一模板（ziwei-chat-prompt.md） */
export function loadUnifiedTemplate(): string {
  return loadTextFile(UNIFIED_TEMPLATE_PATH, unifiedTemplateCache)
}

/** 加载 System Prompt（System Prompt.md） */
export function loadSystemPrompt(): string {
  return loadTextFile(SYSTEM_PROMPT_PATH, systemPromptCache)
}

/** 加载 User Prompt（User Prompt.md） */
export function loadUserPrompt(): string {
  return loadTextFile(USER_PROMPT_PATH, userPromptCache)
}

/** 加载数据格式规范（输出给大模型的数据格式.json） */
export function loadDataFormatSchema(): DataFormatSchema {
  return loadJsonFile<DataFormatSchema>(DATA_FORMAT_PATH, dataFormatCache)
}

/** 一次性加载所有配置 */
export function loadZiweiPromptConfig(): ZiweiPromptConfig {
  return {
    unifiedTemplate: loadUnifiedTemplate(),
    systemPrompt: loadSystemPrompt(),
    userPromptTemplate: loadUserPrompt(),
    dataFormatSchema: loadDataFormatSchema(),
  }
}

/** 手动清除所有缓存（用于强制重载） */
export function reloadAllConfigs(): ZiweiPromptConfig {
  unifiedTemplateCache.mtime = 0
  systemPromptCache.mtime = 0
  userPromptCache.mtime = 0
  dataFormatCache.mtime = 0
  return loadZiweiPromptConfig()
}
