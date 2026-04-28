/**
 * Step 3: 知识库精准召回（精确优先，向量降级）
 *
 * 检索策略：
 * 1. preciseMatch — MySQL JSON_CONTAINS 查询 stars+palaces 组合
 * 2. sihuaMatch — star+type+palace 三字段精确匹配四化知识
 * 3. patternMatch — 格局名精确匹配
 * 4. vectorFallback — 精确为空时，复用现有 Zvec 向量检索
 *
 * 后处理：去重 + 排序 + Token 预算控制（≤8 条，≤3000 Token）
 *
 * 安全：使用 Prisma sql 模板标签，防止 SQL 注入。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import type { ReadingElements, SihuaEvent, KnowledgeChunk } from './types'

// ── 常量 ────────────────────────────────────────────────

/** 最大召回知识块数 */
const MAX_KNOWLEDGE_CHUNKS = 8
/** Token 预算上限（按每个字符约 0.5 Token 估算） */
const MAX_TOKENS_ESTIMATE = 3000

// ── 精确元数据匹配 ──────────────────────────────────────

/**
 * 星曜 + 宫位精确匹配（MySQL JSON_CONTAINS 查询）
 * 使用 Prisma sql 模板标签防止 SQL 注入
 */
async function preciseMatch(
  stars: string[],
  palaces: string[],
): Promise<KnowledgeChunk[]> {
  if (stars.length === 0 || palaces.length === 0) return []

  // 构造安全的 SQL：stars 包含任意一个 AND palaces 包含任意一个
  const starConditions = stars.map(() => `JSON_CONTAINS(stars, JSON_QUOTE(?))`).join(' OR ')
  const palaceConditions = palaces.map(() => `JSON_CONTAINS(palaces, JSON_QUOTE(?))`).join(' OR ')

  const sql = `
    SELECT id, title, content, stars, palaces, sihua, domains, patterns,
           topicType, timeScope, priority
    FROM ziwei_knowledge
    WHERE (${starConditions})
    AND (${palaceConditions})
    ORDER BY priority DESC
    LIMIT 20
  `

  // 按顺序传入参数：先 stars，再 palaces
  const values = [...stars, ...palaces]

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number; title: string; content: string
        stars: string; palaces: string; sihua: string
        domains: string; patterns: string; topicType: string
        timeScope: string; priority: number
      }>
    >(sql, ...values)

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      stars: safeJsonParse(r.stars),
      palaces: safeJsonParse(r.palaces),
      sihua: safeJsonParse(r.sihua),
      domains: safeJsonParse(r.domains),
      patterns: safeJsonParse(r.patterns),
      topicType: r.topicType,
      timeScope: r.timeScope,
      priority: r.priority,
      score: 1.0,
    }))
  } catch (err) {
    console.error('[Step3] preciseMatch 查询失败:', err)
    return []
  }
}

/**
 * 四化精确匹配：star + type + palace 三字段
 */
async function sihuaMatch(sihuaList: SihuaEvent[]): Promise<KnowledgeChunk[]> {
  if (sihuaList.length === 0) return []

  const results: KnowledgeChunk[] = []

  for (const s of sihuaList) {
    const sql = `
      SELECT id, title, content, stars, palaces, sihua, domains, patterns,
             topicType, timeScope, priority
      FROM ziwei_knowledge
      WHERE JSON_CONTAINS(stars, JSON_QUOTE(?))
      AND JSON_CONTAINS(sihua, JSON_QUOTE(?))
      AND JSON_CONTAINS(palaces, JSON_QUOTE(?))
      ORDER BY priority DESC
      LIMIT 3
    `

    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: number; title: string; content: string
          stars: string; palaces: string; sihua: string
          domains: string; patterns: string; topicType: string
          timeScope: string; priority: number
        }>
      >(sql, s.star, s.type, s.palace)

      results.push(...rows.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        stars: safeJsonParse(r.stars),
        palaces: safeJsonParse(r.palaces),
        sihua: safeJsonParse(r.sihua),
        domains: safeJsonParse(r.domains),
        patterns: safeJsonParse(r.patterns),
        topicType: r.topicType,
        timeScope: r.timeScope,
        priority: r.priority,
        score: 1.0,
      })))
    } catch (err) {
      console.error(`[Step3] sihuaMatch 查询失败 (${s.star}${s.type}):`, err)
    }
  }

  return results
}

/**
 * 格局精确匹配
 */
async function patternMatch(patterns: string[]): Promise<KnowledgeChunk[]> {
  if (patterns.length === 0) return []

  const results: KnowledgeChunk[] = []

  for (const p of patterns) {
    const sql = `
      SELECT id, title, content, stars, palaces, sihua, domains, patterns,
             topicType, timeScope, priority
      FROM ziwei_knowledge
      WHERE JSON_CONTAINS(patterns, JSON_QUOTE(?))
      ORDER BY priority DESC
      LIMIT 2
    `

    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: number; title: string; content: string
          stars: string; palaces: string; sihua: string
          domains: string; patterns: string; topicType: string
          timeScope: string; priority: number
        }>
      >(sql, p)

      results.push(...rows.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        stars: safeJsonParse(r.stars),
        palaces: safeJsonParse(r.palaces),
        sihua: safeJsonParse(r.sihua),
        domains: safeJsonParse(r.domains),
        patterns: safeJsonParse(r.patterns),
        topicType: r.topicType,
        timeScope: r.timeScope,
        priority: r.priority,
        score: 1.0,
      })))
    } catch (err) {
      console.error(`[Step3] patternMatch 查询失败 (${p}):`, err)
    }
  }

  return results
}

/**
 * 向量降级检索（精确匹配为空时才调用）
 * 直接从 Zvec 读取 text 内容，不经过 MySQL
 * 解决问题 A+E：MySQL 为空时仍能通过 Zvec 召回知识
 */
async function vectorFallback(
  query: string,
  _starFilter?: string,
): Promise<KnowledgeChunk[]> {
  try {
    const { getEmbeddingFamilyForProvider } = await import('@/lib/zvec/embedding-family')
    const { getEmbeddingConfigForFamily } = await import('@/lib/zvec/embedding-config')
    const { fetchEmbeddingVector } = await import('@/lib/zvec/fetch-embedding')
    const { ZVecOpen, ZVecIndexType } = await import('@zvec/zvec')
    const { ensureZvecInitialized } = await import('@/lib/zvec/init-zvec')

    // 获取可用的 embedding 配置
    const family = getEmbeddingFamilyForProvider('deepseek')
    let cfg = await getEmbeddingConfigForFamily(prisma, family).catch(() => null)

    if (!cfg) {
      console.warn('[Step3] 无可用 embedding 配置，跳过向量降级')
      return []
    }

    // 获取查询向量
    const queryVector = await fetchEmbeddingVector(cfg, query)

    // 按维度精确匹配 Zvec 集合（避免多维度目录时选错）
    ensureZvecInitialized()
    const fs = await import('fs')
    const nodePath = await import('path')
    const zvecRoot = nodePath.join(process.cwd(), 'data', 'zvec')
    const expectedDir = `sysknowledge_dim${family}`
    let colPath: string | null = null
    if (fs.existsSync(zvecRoot)) {
      const dirs = fs.readdirSync(zvecRoot).filter(d => d === expectedDir)
      if (dirs.length > 0) {
        colPath = nodePath.join(zvecRoot, dirs[0])
      }
    }
    if (!colPath) {
      const allDirs = fs.existsSync(zvecRoot) ? fs.readdirSync(zvecRoot).join(', ') : '(目录不存在)'
      console.warn(`[Step3] 期望目录 ${expectedDir} 不存在，zvecRoot 下有: ${allDirs}`)
      return []
    }

    let col: ReturnType<typeof ZVecOpen> | null = null
    try {
      // 清理残留 LOCK 文件（进程异常退出后遗留，会导致 readOnly 模式无法打开）
      const lockPath = nodePath.join(colPath, 'LOCK')
      if (fs.existsSync(lockPath)) {
        const stat = fs.statSync(lockPath)
        if (stat.size === 0) fs.unlinkSync(lockPath)
      }
      col = ZVecOpen(colPath, { readOnly: true })
    } catch (e) {
      console.warn('[Step3] Zvec 集合不存在或无法打开:', colPath, (e as Error).message)
      return []
    }

    const results = col.querySync({
      fieldName: 'embedding',
      vector: queryVector,
      topk: 5,
      outputFields: ['text', 'source_file', 'biz_modules', 'stars', 'palaces'],
      params: { indexType: ZVecIndexType.HNSW, ef: 200 },
    })

    col.closeSync()

    if (!Array.isArray(results) || results.length === 0) {
      return []
    }

    // 直接从 Zvec fields 构造 KnowledgeChunk，不查 MySQL
    return results.map((r: { id: string; score?: number; fields?: Record<string, unknown> }, i: number) => {
      const fields = r.fields ?? {}
      const text = String(fields.text ?? '')
      const sourceFile = String(fields.source_file ?? '未知')

      // 从 fields 或内容中提取元数据
      const starsFromFields = parseFieldToArray(fields.stars)
      const palacesFromFields = parseFieldToArray(fields.palaces)

      return {
        // 基于原始 ID 的确定性负数哈希，空 id 时用 source_file + 内容前缀兜底
        id: deterministicNegativeId(
          String(r.id ?? ''),
          String(fields.source_file ?? '') + text.slice(0, 50),
        ),
        title: sourceFile.replace(/\.md$/, ''),
        content: text,
        stars: starsFromFields.length > 0 ? starsFromFields : extractNamesFromText(text, CORE_STARS),
        palaces: palacesFromFields.length > 0 ? palacesFromFields : extractNamesFromText(text, CORE_PALACES),
        sihua: extractNamesFromText(text, SIHUA_TYPES),
        domains: [],
        patterns: [],
        topicType: '综合',
        timeScope: '本命',
        priority: 5,
        score: r.score ?? (0.8 - i * 0.05), // Zvec 向量分
      }
    })
  } catch (err) {
    console.error('[Step3] 向量降级检索失败:', err)
    return []
  }
}

/** 从 Zvec fields 解析数组（可能是字符串逗号分隔或已解析数组） */
function parseFieldToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    return value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

/** 从文本中提取匹配的名称列表 */
function extractNamesFromText(text: string, names: string[]): string[] {
  return names.filter(name => text.includes(name))
}

// 用于文本提取的常量
const CORE_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  '文昌', '文曲', '左辅', '右弼', '禄存', '天马',
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
]

const CORE_PALACES = [
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
  '奴仆宫', '事业宫',
]

const SIHUA_TYPES = ['化禄', '化权', '化科', '化忌']

// ── 主召回函数 ──────────────────────────────────────────

/**
 * 知识库精准召回
 * ① 星曜+宫位精确匹配 → ② 四化精确匹配 → ③ 格局精确匹配 → ④ 向量降级
 * ⑤ 去重 → ⑥ 排序 → ⑦ Token 预算控制
 */
export async function retrieveKnowledge(
  elements: ReadingElements,
): Promise<KnowledgeChunk[]> {
  const allChunks: KnowledgeChunk[] = []

  // ① 星曜 + 宫位精确匹配
  const precise = await preciseMatch(elements.stars, elements.palaces)

  if (precise.length > 0) {
    allChunks.push(...precise)
  } else if (elements.stars.length > 0 && elements.palaces.length > 0) {
    // 精确匹配为空 → 降级：逐个星曜向量检索
    const star = elements.stars[0]
    const palace = elements.palaces[0] ?? ''
    const fallback = await vectorFallback(`${star}在${palace}`, star)
    allChunks.push(...fallback)
  }

  // ② 四化精确匹配
  const sihuaChunks = await sihuaMatch(elements.sihua)
  if (sihuaChunks.length > 0) {
    allChunks.push(...sihuaChunks)
  } else if (elements.sihua.length > 0) {
    // 四化精确为空 → 向量降级
    const s = elements.sihua[0]
    const fallback = await vectorFallback(`${s.star}${s.type}入${s.palace}`, s.star)
    allChunks.push(...fallback)
  }

  // ③ 格局精确匹配
  const patternChunks = await patternMatch(elements.patterns)
  allChunks.push(...patternChunks)

  // ④ 去重（按 id）
  const seen = new Set<number>()
  const deduped = allChunks.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  // ⑤ 相关性排序（精确匹配 > 向量召回，priority 高者优先）
  const ranked = deduped.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
    if (Math.abs(scoreDiff) > 0.1) return scoreDiff
    return b.priority - a.priority
  })

  // ⑥ Token 预算控制：取前 N 条，确保不超限
  const selected: KnowledgeChunk[] = []
  let tokenEstimate = 0
  for (const chunk of ranked) {
    // 中文约 1 字符 ≈ 0.5 Token
    const chunkTokens = Math.ceil(chunk.content.length / 2)
    if (tokenEstimate + chunkTokens > MAX_TOKENS_ESTIMATE) break
    selected.push(chunk)
    tokenEstimate += chunkTokens
    if (selected.length >= MAX_KNOWLEDGE_CHUNKS) break
  }

  console.log(`[Step3] 召回 ${selected.length} 条知识（估计 ${tokenEstimate} Token）`)
  return selected
}

// ── 工具函数 ────────────────────────────────────────────

/** 安全解析 JSON 字符串（MySQL 返回的 JSON 字段可能是 string 或已解析对象） */
function safeJsonParse(value: string | unknown): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** 基于字符串的确定性负数 ID 生成（同一输入始终产出同一负数）
 *  fallbackKey：当 rawId 为空时用 source_file + 内容前缀作为备选，保持确定性 */
function deterministicNegativeId(rawId: string, fallbackKey: string = ''): number {
  const source = rawId || fallbackKey
  if (!source) return -999999
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return hash === 0 ? -1 : -Math.abs(hash)
}
