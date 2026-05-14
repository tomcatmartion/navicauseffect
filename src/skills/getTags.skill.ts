/**
 * getTags Skill
 * 获取结构化标签词典
 */
import 'server-only'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import type { Skill } from './types'
import { TAG_TYPES } from './types'

const TAG_DIR = path.join(process.cwd(), 'sysfiles', 'systag')

const TAG_FILE: Record<string, string> = {
  predict_item: 'predict-item.json',
  star_nature: 'asterism-item-星曜标签-择续.json',
  palace_item: 'palace-item-宫位标签-择续.json',
  asterism_item: 'asterism-item-星曜标签-择续.json',
  rules_item: 'rules-item-逻辑标签-择续.json',
  suitable_unsuitable: 'suitable-unsuitable-item-宜忌标签-择续.json',
}

const params = z.object({
  tagType: z.enum(TAG_TYPES).describe(
    '标签类型：predict_item=求测事项标签, star_nature=星曜赋性标签, palace_item=宫位标签, asterism_item=星曜标签, rules_item=逻辑标签, suitable_unsuitable=宜忌标签'
  ),
})

function execute({ tagType }: z.infer<typeof params>): string {
  const fileName = TAG_FILE[tagType]
  if (!fileName) {
    return `未知标签类型：${tagType}`
  }

  const filePath = path.join(TAG_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return `标签文件不存在：${fileName}`
  }

  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return `标签文件读取失败：${fileName}`
  }
}

export const getTagsSkill: Skill<typeof params> = {
  name: 'get_tags',
  description: `获取结构化标签词典，用于术语校验和分类。
按需调用，非必须。
- predict_item: 求测事项标签（财运、事业、感情等）
- star_nature: 星曜赋性标签（十四主星、六吉星、六煞星等）
- palace_item: 宫位标签
- rules_item: 逻辑标签
- suitable_unsuitable: 宜忌标签`,
  parameters: params,
  execute,
}
