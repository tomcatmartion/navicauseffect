/**
 * 标签规范化工具 — 确保 Front Matter 标签与 systag 100% 一致
 *
 * 核心问题：规则文件写"流年官禄宫"，知识库标签写"官禄宫" → 精确查询失效。
 * 解决方案：运行时归一化 + 入库前校验。
 */

import 'server-only'

import fs from 'fs'
import path from 'path'

// ── 标准词表 ────────────────────────────────────────────

export interface NormalizedTerms {
  /** 14 正星 + 辅星 */
  stars: string[]
  /** 12 宫位名（如 "命宫"、"财帛宫"） */
  palaces: string[]
  /** 四化类型 */
  sihuaTypes: string[]
  /** 领域名（来自 predict-item 标签的 name） */
  domains: string[]
  /** 格局名 */
  patterns: string[]
}

let _cachedTerms: NormalizedTerms | null = null

/**
 * 从 systag JSON 文件加载全量标准词表
 * 结果缓存在进程内存中，避免重复读取
 */
export function loadNormalizedTerms(): NormalizedTerms {
  if (_cachedTerms) return _cachedTerms

  const systagDir = path.join(process.cwd(), 'sysfiles', 'systag')

  // 从星曜标签文件提取所有星曜名
  const asterismFile = findJsonFile(systagDir, 'asterism')
  const asterismKeywords = extractAllKeywords(systagDir, asterismFile)

  // 从宫位标签文件提取所有宫位名
  const palaceFile = findJsonFile(systagDir, 'palace')
  const palaceKeywords = extractAllKeywords(systagDir, palaceFile)

  // 从预测事项标签文件提取领域名
  const predictFile = findJsonFile(systagDir, 'predict')
  const domainNames = extractTagNames(systagDir, predictFile)

  // 从格局标签文件提取格局名
  const patternFile = findJsonFile(systagDir, 'patterin')
  const patternKeywords = extractAllKeywords(systagDir, patternFile)

  // 四化类型固定值
  const sihuaTypes = ['化禄', '化权', '化科', '化忌']

  _cachedTerms = {
    stars: dedupe([...CORE_STARS, ...asterismKeywords]),
    palaces: dedupe([...CORE_PALACES, ...palaceKeywords]),
    sihuaTypes,
    domains: domainNames,
    patterns: patternKeywords,
  }

  return _cachedTerms
}

// ── 核心星曜列表（14正星 + 重要辅星）──────────────────────

const CORE_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  '文昌', '文曲', '左辅', '右弼', '禄存', '天马',
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
  '天魁', '天钺', '天刑', '天姚', '红鸾', '天喜',
  '天官', '天福', '天虚', '天哭', '龙池', '凤阁',
  '孤辰', '寡宿', '华盖', '天空',
]

// ── 核心宫位列表 ────────────────────────────────────────

const CORE_PALACES = [
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
  // 别名
  '奴仆宫', '事业宫',
]

// ── 运行时归一化 ────────────────────────────────────────

/** 宫位名归一化：去除"流年/大限/流月/本命"等时间前缀 */
const TIME_PREFIXES = ['流年', '大限', '流月', '本命']

export function normalizePalaceName(raw: string): string {
  let name = raw.trim()
  for (const prefix of TIME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
      break
    }
  }
  return name
}

/** 星曜名归一化：去除括号注释，去除"星"后缀冗余 */
export function normalizeStarName(raw: string): string {
  return raw.replace(/[（(].+[)）]/, '').replace(/星$/, '').trim() || raw.trim()
}

/** 归一化完整的 ReadingElements */
export function normalizeElements(elements: {
  palaces: string[]
  stars: string[]
}): { palaces: string[]; stars: string[] } {
  return {
    palaces: [...new Set(elements.palaces.map(normalizePalaceName))],
    stars: [...new Set(elements.stars.map(normalizeStarName))],
  }
}

// ── Front Matter 校验 ───────────────────────────────────

export interface FrontMatterTags {
  stars?: string[]
  palaces?: string[]
  sihua?: string[]
  domains?: string[]
  patterns?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 校验 Front Matter 中的标签是否在标准词表中
 * 入库前必须调用，确保 100% 一致性
 */
export function validateFrontMatterTags(fm: FrontMatterTags): ValidationResult {
  const terms = loadNormalizedTerms()
  const errors: string[] = []
  const warnings: string[] = []

  // 校验星曜
  if (fm.stars) {
    for (const star of fm.stars) {
      const normalized = normalizeStarName(star)
      if (!terms.stars.includes(normalized)) {
        const closest = findClosest(normalized, terms.stars)
        errors.push(`未知星曜: "${star}"（归一化后: "${normalized}"），最接近: ${closest}`)
      }
    }
  }

  // 校验宫位
  if (fm.palaces) {
    for (const palace of fm.palaces) {
      const normalized = normalizePalaceName(palace)
      if (!terms.palaces.includes(normalized)) {
        const closest = findClosest(normalized, terms.palaces)
        errors.push(`未知宫位: "${palace}"（归一化后: "${normalized}"），最接近: ${closest}`)
      }
    }
  }

  // 校验四化
  if (fm.sihua) {
    for (const s of fm.sihua) {
      if (!terms.sihuaTypes.includes(s)) {
        errors.push(`未知四化类型: "${s}"，有效值: ${terms.sihuaTypes.join('、')}`)
      }
    }
  }

  // 校验领域（宽松：不在词表中是 warning 而非 error）
  if (fm.domains) {
    for (const d of fm.domains) {
      if (!terms.domains.includes(d)) {
        warnings.push(`领域 "${d}" 不在 systag predict-item 标签名中，可能影响精确查询`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ── 内部工具函数 ────────────────────────────────────────

/** 在目录中按文件名子串查找 JSON 文件 */
function findJsonFile(dir: string, namePart: string): string | null {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir)
  const match = files.find(f => f.includes(namePart) && f.endsWith('.json'))
  return match ?? null
}

/** 提取 JSON 文件中所有标签的 keywords（扁平数组） */
function extractAllKeywords(dir: string, filename: string | null): string[] {
  if (!filename) return []
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf-8'))
    const tags = raw.tags as Array<{ keywords?: string[] }> ?? []
    return tags.flatMap(t => t.keywords ?? [])
  } catch {
    return []
  }
}

/** 提取 JSON 文件中所有标签的 name */
function extractTagNames(dir: string, filename: string | null): string[] {
  if (!filename) return []
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf-8'))
    const tags = raw.tags as Array<{ name?: string }> ?? []
    return tags.map(t => t.name).filter((n): n is string => typeof n === 'string')
  } catch {
    return []
  }
}

/** 去重 */
function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}

/**
 * 查找最接近的匹配（简单的字符重叠度）
 * 用于在标签不一致时给出修改建议
 */
export function findClosest(target: string, candidates: string[]): string {
  let bestMatch = candidates[0] ?? ''
  let bestScore = 0

  for (const c of candidates) {
    // 计算共同字符数
    const targetChars = new Set(target)
    const candidateChars = new Set(c)
    let overlap = 0
    for (const ch of targetChars) {
      if (candidateChars.has(ch)) overlap++
    }
    const score = overlap / Math.max(target.length, c.length)
    if (score > bestScore) {
      bestScore = score
      bestMatch = c
    }
  }

  return bestMatch
}
