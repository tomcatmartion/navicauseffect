/**
 * queryKnowledge Skill
 * 从结构化 JSON 知识库中精准查询星曜、宫位、四化、格局知识
 */
import 'server-only'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import type { Skill } from './types'
import { KNOWLEDGE_CATEGORIES } from './types'

const JSON_DIR = path.join(process.cwd(), 'sysknowledge_json')

// ── 启动时建立文件索引 Map ─────────────────────────────
type FileIndex = Map<string, string>
const categoryIndex = new Map<string, FileIndex>()

function buildFileIndex(): void {
  for (const category of KNOWLEDGE_CATEGORIES) {
    const catDir = path.join(JSON_DIR, category)
    const index: FileIndex = new Map()

    if (fs.existsSync(catDir)) {
      for (const file of fs.readdirSync(catDir)) {
        if (!file.endsWith('.json')) continue
        const key = file.replace(/\.json$/, '')
        const filePath = path.join(catDir, file)
        index.set(key, filePath)
      }
    }
    categoryIndex.set(category, index)
  }
  console.log(`[queryKnowledge] 索引建立完成: ${[...categoryIndex.entries()]
    .map(([k, v]) => `${k}(${v.size})`)
    .join(', ')}`)
}

buildFileIndex()

// ── 参数 Schema ─────────────────────────────────────────
const params = z.object({
  category: z.enum(KNOWLEDGE_CATEGORIES).describe(
    '知识类型：stars=星曜, palaces=宫位, sihua=四化, patterns=格局, combinations=组合'
  ),
  name: z.string().describe('条目名称，如：武曲、财帛宫、化忌、禄马交驰格'),
  subKey: z.string().optional().describe(
    `可选的子字段 key，精准获取 JSON 中的特定内容。
    stars 类型：传宫位名（如"财帛宫"）获取该星在该宫解释；传四化名（如"化忌"）获取四化解释。
    sihua 类型：传宫位名（如"财帛宫"）获取该四化入该宫的解释。
    palaces 类型：传领域名（如"财运"）获取该宫在该领域的规则。
    不传则返回整个 JSON 的核心摘要。`
  ),
})

// ── 执行函数 ─────────────────────────────────────────────
function execute({ category, name, subKey }: z.infer<typeof params>): string {
  const index = categoryIndex.get(category)
  if (!index) return `未知知识类型：${category}`

  // 精确查找文件
  const filePath = index.get(name)
  if (!filePath) {
    const available = [...index.keys()].slice(0, 20).join('、')
    return `暂无【${name}】的${category}知识。可用条目：${available}...`
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return `知识文件读取失败：${filePath}`
  }

  // 有 subKey：精准读取 JSON 字段（O(1)，无截取）
  if (subKey) {
    return queryWithSubKey(category, data, name, subKey)
  }

  // 无 subKey：返回核心摘要
  return buildSummary(category, data, name)
}

function queryWithSubKey(
  category: string,
  data: Record<string, unknown>,
  name: string,
  subKey: string
): string {
  // stars 类型：palaces 或 sihua 子字段
  if (category === 'stars') {
    const palaces = data.palaces as Record<string, string> | undefined
    if (palaces?.[subKey]) {
      return `【${name}】在${subKey}：\n${palaces[subKey]}`
    }

    const sihua = data.sihua as Record<string, string> | undefined
    if (sihua?.[subKey]) {
      return `【${name}${subKey}】：\n${sihua[subKey]}`
    }

    const combinations = data.combinations as Record<string, string> | undefined
    if (combinations?.[subKey]) {
      return `【${name}与${subKey}】：\n${combinations[subKey]}`
    }

    return `【${name}】中未找到"${subKey}"的专项解释，以下为基本性质：\n${data.base_nature ?? ''}`
  }

  // sihua 类型：by_palace 子字段
  if (category === 'sihua') {
    const byPalace = data.by_palace as Record<string, string> | undefined
    if (byPalace?.[subKey]) {
      return `【${name}入${subKey}】：\n${byPalace[subKey]}`
    }
    return `【${name}】中未找到入"${subKey}"的专项解释，核心含义：\n${data.core_meaning ?? ''}`
  }

  // palaces 类型：domain_rules 子字段
  if (category === 'palaces') {
    const domainRules = data.domain_rules as Record<string, string> | undefined
    if (domainRules?.[subKey]) {
      return `【${name}】在${subKey}领域的规则：\n${domainRules[subKey]}`
    }
    return `【${name}】核心含义：\n${data.core_meaning ?? ''}`
  }

  // patterns 类型
  if (category === 'patterns') {
    return `【${name}格局】\n成格条件：${data.condition ?? ''}\n含义：${data.core_meaning ?? ''}\n分析：${data.analysis ?? ''}`
  }

  return JSON.stringify(data, null, 2)
}

function buildSummary(
  category: string,
  data: Record<string, unknown>,
  name: string
): string {
  if (category === 'stars') {
    return `【${name}】基本性质：${data.base_nature ?? ''}\n性格特质：${data.personality ?? ''}`
  }
  if (category === 'palaces') {
    const warnings = (data.key_warnings as string[] ?? []).join('；')
    return `【${name}】核心含义：${data.core_meaning ?? ''}${warnings ? `\n注意：${warnings}` : ''}`
  }
  if (category === 'sihua') {
    return `【${name}】核心含义：${data.core_meaning ?? ''}`
  }
  if (category === 'patterns') {
    return `【${name}格局】成格条件：${data.condition ?? ''}\n含义：${data.core_meaning ?? ''}\n分析：${data.analysis ?? ''}`
  }
  return JSON.stringify(data, null, 2)
}

export const queryKnowledgeSkill: Skill<typeof params> = {
  name: 'query_knowledge',
  description: `获取紫微斗数星曜、宫位、四化、格局的精准知识。
按命主命盘中实际存在的星曜和宫位多次调用，严格按查询清单执行。
- 查星曜在特定宫位：category="stars", name="武曲", subKey="财帛宫"
- 查星曜四化：category="stars", name="武曲", subKey="化忌"
- 查四化入宫：category="sihua", name="化忌", subKey="财帛宫"
- 查格局：category="patterns", name="禄马交驰格"
注意：只查任务清单中列明的内容，不做清单外的额外查询。`,
  parameters: params,
  execute,
}
