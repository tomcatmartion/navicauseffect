/**
 * Skill 系统类型定义
 * 统一的 Skill 接口，用于 Auto-Discovery 注册和执行
 */
import 'server-only'
import { z } from 'zod'

/**
 * Skill 接口 - 所有 Skill 必须实现此接口
 */
export interface Skill<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  parameters: TParams
  execute: (params: z.infer<TParams>) => Promise<string> | string
}

/**
 * 领域枚举
 */
export const DOMAINS = [
  '财运', '事业', '感情', '健康',
  '六亲', '子女', '学业', '出行', '人生境遇'
] as const

export type Domain = typeof DOMAINS[number]

/**
 * 知识分类枚举
 */
export const KNOWLEDGE_CATEGORIES = [
  'stars', 'palaces', 'sihua', 'patterns', 'combinations'
] as const

export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]

/**
 * 标签类型枚举
 */
export const TAG_TYPES = [
  'predict_item', 'star_nature', 'palace_item',
  'asterism_item', 'rules_item', 'suitable_unsuitable'
] as const

export type TagType = typeof TAG_TYPES[number]

/**
 * 查询任务 - 命盘特征提取器生成
 */
export interface QueryTask {
  category: KnowledgeCategory
  name: string
  subKey?: string  // JSON字段精准定位
}

/**
 * Skill 执行结果
 */
export interface SkillResult {
  success: boolean
  data?: string
  error?: string
}
