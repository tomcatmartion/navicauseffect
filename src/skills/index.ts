/**
 * Skill Auto-Discovery 系统
 * 自动扫描 src/skills/ 目录下的 *.skill.ts 文件并注册
 */
import 'server-only'
import { z } from 'zod'
import type { Skill } from './types'
import type { Tool } from '@/lib/ai/skill-callers'
import { loadDomainContextSkill } from './loadDomainContext.skill'
import { queryKnowledgeSkill } from './queryKnowledge.skill'
import { getTagsSkill } from './getTags.skill'
import type { QueryTask, Domain } from './types'

/**
 * 所有已注册的 Skills
 * 目前使用显式注册，后续可扩展为文件系统扫描
 */
const ALL_SKILLS: Skill[] = [
  loadDomainContextSkill,
  queryKnowledgeSkill,
  getTagsSkill,
]

/**
 * 根据名称查找 Skill
 */
export function getSkillByName(name: string): Skill | undefined {
  return ALL_SKILLS.find(s => s.name === name)
}

/**
 * 将 Zod schema 转换为 JSON Schema（简化版）
 */
function zodToJsonSchema(schema: z.ZodTypeAny): object {
  try {
    // 尝试使用 zod-to-json-schema
    const { zodToJsonSchema: convert } = require('zod-to-json-schema')
    return convert(schema, { $refStrategy: 'none' })
  } catch {
    // 降级：手动转换
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, z.ZodTypeAny>
      const properties: Record<string, object> = {}
      const required: string[] = []

      for (const [key, val] of Object.entries(shape)) {
        if (val instanceof z.ZodOptional) {
          // 可选字段不加入 required
          const inner = (val as z.ZodOptional<z.ZodTypeAny>).unwrap()
          properties[key] = {
            type: inner instanceof z.ZodEnum ? 'string' : 'string',
            description: inner.description ?? '',
          }
        } else {
          required.push(key)
          properties[key] = {
            type: val instanceof z.ZodEnum ? 'string' : 'string',
            description: val.description ?? '',
            ...(val instanceof z.ZodEnum ? { enum: val.options } : {}),
          }
        }
      }
      return { type: 'object', properties, required }
    }
    return { type: 'object' }
  }
}

/**
 * 构建 AI Tools 数组
 * 用于 OpenAI Function Calling 格式
 */
export function buildTools(): Tool[] {
  return ALL_SKILLS.map(skill => ({
    type: 'function' as const,
    function: {
      name: skill.name,
      description: skill.description,
      parameters: zodToJsonSchema(skill.parameters),
    },
  }))
}

/**
 * 异步执行 Skill
 */
export async function executeSkillAsync(
  name: string,
  args: unknown
): Promise<string> {
  const skill = getSkillByName(name)
  if (!skill) {
    return `未知工具：${name}`
  }

  try {
    const parsed = skill.parameters.parse(args)
    const result = await skill.execute(parsed)
    return result
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return `工具执行错误：${errorMessage}`
  }
}

/**
 * 同步执行 Skill（用于不需要 async 的场景）
 */
export function executeSkill(
  name: string,
  args: unknown
): string {
  const skill = getSkillByName(name)
  if (!skill) {
    return `未知工具：${name}`
  }

  try {
    const parsed = skill.parameters.parse(args)
    const result = skill.execute(parsed)
    // 如果是 Promise，需要等待
    if (result instanceof Promise) {
      // 这种情况不应该在同步上下文中发生，但提供兜底
      return '异步操作不能在同步上下文中执行'
    }
    return result
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return `工具执行错误：${errorMessage}`
  }
}

/**
 * 获取所有已注册的 Skill 名称
 */
export function getRegisteredSkillNames(): string[] {
  return ALL_SKILLS.map(s => s.name)
}

/**
 * Auto-Discovery 扫描（预留扩展接口）
 * 未来可通过文件系统扫描实现动态注册
 */
export async function scanSkillsFromFileSystem(): Promise<Skill[]> {
  // TODO: 实现文件系统扫描
  // const skillFiles = glob.sync('src/skills/*.skill.ts')
  // return skillFiles.map(file => require(file).default)
  return ALL_SKILLS
}

// ═══════════════════════════════════════════════════════════════════
// 知识直灌核心函数（混合架构第一阶段）
// ═══════════════════════════════════════════════════════════════════

/**
 * 批量加载领域上下文（规则+技法）
 * 知识直灌第一步
 */
export function loadDomainContext(domain: Domain): string {
  const result = loadDomainContextSkill.execute({ domain })
  return result instanceof Promise ? '' : result
}

/**
 * 批量执行查询任务，知识直灌核心函数
 *
 * 由 pipeline 直接调用，Node.js 循环执行所有 QueryTask，
 * 将结果拼装成一段完整的知识文本，发给 LLM。
 *
 * @param tasks QueryTask[] 查询任务清单
 * @returns 拼装好的知识文本
 */
export function executeQueryTasks(tasks: QueryTask[]): string {
  const results: string[] = []

  for (const task of tasks) {
    try {
      const result = queryKnowledgeSkill.execute({
        category: task.category,
        name: task.name,
        subKey: task.subKey,
      })

      // 处理异步/同步结果
      if (result instanceof Promise) {
        continue  // 跳过异步调用（不应该发生）
      }

      // 过滤无效结果（暂无/未知 开头的）
      if (result && !result.startsWith('暂无') && !result.startsWith('未知') && !result.includes('可用条目')) {
        results.push(result)
      }
    } catch (err) {
      console.warn(`[skills] 查询失败: ${task.category}/${task.name}`, err)
    }
  }

  return results.join('\n\n---\n\n')
}
