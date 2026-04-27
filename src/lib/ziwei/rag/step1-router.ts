/**
 * Step 1: 意图路由 + 硬加载规则/技法
 *
 * 关键词匹配识别 domain（财运/事业/感情等）和 timeScope（本命/流年/大限），
 * 然后 fs.readFileSync 硬加载对应的规则和技法文件。
 *
 * 特性：毫秒级，零 LLM 调用。
 */

import 'server-only'

import fs from 'fs'
import path from 'path'
import type { ReadingDomain } from './types'

// ── 领域关键词映射（确定性，零模糊）──────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  '财运': ['财运', '财富', '收入', '赚钱', '破财', '存钱', '投资', '暴富', '发财', '薪资', '工资', '正财', '偏财', '理财'],
  '事业': ['事业', '工作', '职业', '换工作', '升职', '创业', '生意', '老板', '公司', '合伙', '官禄'],
  '感情': ['感情', '婚姻', '恋爱', '男友', '女友', '结婚', '离婚', '配偶', '桃花', '夫妻', '对象', '另一半'],
  '健康': ['健康', '身体', '疾病', '生病', '手术', '癌症', '寿命', '体质', '疾厄'],
  '子女': ['子女', '孩子', '生育', '怀孕', '儿子', '女儿', '生小孩'],
  '六亲': ['父母', '父亲', '母亲', '兄弟', '姐妹', '朋友', '贵人', '小人', '六亲'],
  '学业': ['学业', '考试', '学历', '读书', '升学', '留学', '科名'],
  '出行': ['出行', '出国', '旅游', '迁居', '移民', '外出', '迁移'],
}

const TIME_KEYWORDS: Record<string, string[]> = {
  '流年': ['今年', '流年', '这一年', '当年'],
  '大限': ['这十年', '大限', '这段时期'],
  '流月': ['这个月', '流月', '本月'],
  '本命': ['先天', '一生', '整体', '命格'],
}

// domain → 规则文件名
const DOMAIN_RULE_FILES: Record<string, string> = {
  '财运': '财运解盘规则.md',
  '事业': '事业解盘规则.md',
  '感情': '感情解盘规则.md',
  '健康': '健康解盘规则.md',
  '子女': '子女解盘规则.md',
  '六亲': '六亲解盘规则.md',
  '学业': '学业解盘规则.md',
  '出行': '出行解盘规则.md',
  '人生境遇': '人生境遇解盘规则.md',
}

// ── 路径常量 ────────────────────────────────────────────

const RULES_DIR = path.join(process.cwd(), 'sysfiles', 'sysrules')
const TECH_DIR = path.join(process.cwd(), 'sysfiles', 'systech')

// ── 核心函数 ────────────────────────────────────────────

/**
 * 从用户问题中检测领域和时间范围
 */
export function detectDomain(question: string, lastDomain?: string): ReadingDomain {
  const domains: string[] = []

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => question.includes(kw))) {
      domains.push(domain)
    }
  }

  // 追问时继承上轮 domain
  if (domains.length === 0 && lastDomain) {
    domains.push(lastDomain)
  }

  // 兜底：无法识别时归为「人生境遇」
  if (domains.length === 0) domains.push('人生境遇')

  // 检测时间范围
  let timeScope: ReadingDomain['timeScope'] = '本命'
  for (const [scope, keywords] of Object.entries(TIME_KEYWORDS)) {
    if (keywords.some(kw => question.includes(kw))) {
      timeScope = scope as ReadingDomain['timeScope']
      break
    }
  }

  return { domains, timeScope }
}

/**
 * 硬加载规则文件（直接 fs.readFileSync，绝不走向量库）
 */
export function loadRules(domains: string[]): string {
  const contents: string[] = []

  for (const domain of domains) {
    const filename = DOMAIN_RULE_FILES[domain]
    if (!filename) continue

    const filePath = path.join(RULES_DIR, filename)
    if (!fs.existsSync(filePath)) {
      console.warn(`[Step1] 规则文件不存在: ${filePath}`)
      continue
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    contents.push(`### ${domain}解盘规则\n\n${content}`)
  }

  return contents.join('\n\n---\n\n')
}

/**
 * 硬加载技法文件（直接 fs.readFileSync，绝不走向量库）
 */
export function loadTechs(domains: string[]): string {
  const contents: string[] = []

  for (const domain of domains) {
    const filePath = path.join(TECH_DIR, `${domain}技法.md`)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf-8')
    contents.push(`### ${domain}实战技法\n\n${content}`)
  }

  return contents.join('\n\n---\n\n')
}

/**
 * 追问检测：短句 + 指代词判断是否为追问
 */
export function isFollowUp(question: string): boolean {
  const hasFollowWord = /那|还有|再|另外|继续|刚才|之前|如果|那么|为什么呢|怎么说|能具体|详细/.test(question)
  // 超短句（<4字）且含指代词才算追问，避免"我的事业运势"等短独立句误判
  const isUltraShort = question.length < 4
  return hasFollowWord || isUltraShort
}
