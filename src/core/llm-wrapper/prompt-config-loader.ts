/**
 * Prompt 模板配置加载器
 *
 * 职责：从 data/prompt_templates.json 加载 Prompt 配置
 * 支持热加载，与 knowledge-dict/loader.ts 保持一致的风格
 */

import fs from 'fs'
import path from 'path'

const PROMPT_TEMPLATES_PATH = path.join(process.cwd(), 'data', 'prompt_templates.json')

// ═══════════════════════════════════════════════════════════════════
// 类型定义（与 data/prompt_templates.json 结构对齐）
// ═══════════════════════════════════════════════════════════════════

export interface SystemPromptConfig {
  core_identity?: string
  dialogue_style?: string[]
  workflow?: string[]
  principles?: string[]
  knowledge_rules?: string[]
  forbidden_items?: string[]
  ir_data_note?: string
  chart_snapshot_convention?: string[]
}

export interface StageHintConfig {
  title?: string
  content: string
  required_placeholders?: string[]
}

export interface UserPromptTemplateConfig {
  template: string
  placeholders?: string[]
}

export interface EventAnalysisConfig {
  governor_template?: string
}

export interface PromptTemplates {
  version?: string
  description?: string
  system_prompt?: SystemPromptConfig
  phrase_library?: Record<string, string>
  stage_hints?: Record<string, StageHintConfig>
  event_analysis?: EventAnalysisConfig
  user_prompt_templates?: Record<string, UserPromptTemplateConfig>
  state_transition_hints?: Record<string, string>
}

// ═══════════════════════════════════════════════════════════════════
// 缓存
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T | null
  mtime: number
}

const promptTemplatesCache: CacheEntry<PromptTemplates> = { data: null, mtime: 0 }

// ═══════════════════════════════════════════════════════════════════
// 核心加载函数（与 knowledge-dict/loader.ts 保持一致风格）
// ═══════════════════════════════════════════════════════════════════

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

/** 获取 Prompt 模板配置（自动热加载） */
export function loadPromptTemplates(): PromptTemplates {
  return loadJsonFile<PromptTemplates>(PROMPT_TEMPLATES_PATH, promptTemplatesCache)
}

/** 手动重新加载 Prompt 模板配置 */
export function reloadPromptTemplates(): PromptTemplates {
  promptTemplatesCache.mtime = 0
  return loadPromptTemplates()
}
