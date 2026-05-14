/**
 * loadDomainContext Skill
 * 获取指定求测领域的解盘规则和实战技法
 */
import 'server-only'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import type { Skill } from './types'
import { DOMAINS } from './types'

const RULES_DIR = path.join(process.cwd(), 'sysfiles', 'sysrules')
const TECH_DIR = path.join(process.cwd(), 'sysfiles', 'systech')

const params = z.object({
  domain: z.enum(DOMAINS).describe('求测领域'),
})

function execute({ domain }: z.infer<typeof params>): string {
  const parts: string[] = []

  // 加载规则文件
  const rulePath = path.join(RULES_DIR, `${domain}解盘规则.md`)
  if (fs.existsSync(rulePath)) {
    const ruleContent = fs.readFileSync(rulePath, 'utf-8')
    parts.push(`# ${domain}解盘规则\n\n${ruleContent}`)
  } else {
    parts.push(`# ${domain}解盘规则\n\n（暂无此领域规则文件）`)
  }

  // 加载技法文件
  const techPath = path.join(TECH_DIR, `${domain}技法.md`)
  if (fs.existsSync(techPath)) {
    const techContent = fs.readFileSync(techPath, 'utf-8')
    parts.push(`# ${domain}实战技法\n\n${techContent}`)
  }

  return parts.join('\n\n---\n\n')
}

export const loadDomainContextSkill: Skill<typeof params> = {
  name: 'load_domain_context',
  description: `获取指定求测领域的解盘规则和实战技法。
解盘开始时第一步调用，返回该领域的所有规则和技法。
- 财运：财运分析规则、赚钱方式、破财警示
- 事业：事业分析规则、工作发展、创业指南
- 感情：感情分析规则、婚姻恋爱、桃花姻缘
- 健康：健康分析规则、疾病预防、养生建议
- 子女：子女分析规则、亲子关系、生育建议
- 六亲：六亲分析规则、父母兄弟、贵人小人
- 学业：学业分析规则、考试学业、学习方法
- 出行：出行分析规则、旅行迁居、交通安全
- 人生境遇：综合分析规则、人生周期、命运走向`,
  parameters: params,
  execute,
}
