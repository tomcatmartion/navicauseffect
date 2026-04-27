/**
 * 知识库入库脚本 — Front Matter 解析 + 标签校验 + 向量化 + MySQL 元数据双写入
 *
 * 运行：npx tsx scripts/index-ziwei-knowledge.ts
 *
 * 功能：
 * 1. 读取 sysfiles/sysknowledge/ 下所有 .md 文件
 * 2. 解析 Front Matter（gray-matter），校验标签一致性
 * 3. 切片（按段落，≤800 字符/片）
 * 4. 向量化 → Zvec（复用现有 fetchEmbeddingVector）
 * 5. 元数据 → MySQL ZiweiKnowledge 表
 * 6. 标签 → MySQL ZiweiTag 表
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { PrismaClient } from '@prisma/client'
import { ZVecOpen, ZVecCreateAndOpen, ZVecCollectionSchema, ZVecDataType, ZVecIndexType, ZVecMetricType } from '@zvec/zvec'

const prisma = new PrismaClient()

const KNOWLEDGE_DIR = path.join(process.cwd(), 'sysfiles', 'sysknowledge')
const SYSTAG_DIR = path.join(process.cwd(), 'sysfiles', 'systag')

// ── Front Matter 类型 ───────────────────────────────────

interface KnowledgeFrontMatter {
  title: string
  stars: string[]
  palaces: string[]
  sihua: string[]
  domains: string[]
  patterns: string[]
  topicType: string
  timeScope: string
  priority: number
  keywords: string[]
}

// ── 标签入库 ────────────────────────────────────────────

async function indexTags(): Promise<void> {
  console.log('🏷️  开始标签库入库...')

  const tagFileMappings = [
    { file: 'predict-item-预测事项标签-择续.json', type: 'predict_item' },
    { file: 'asterism-item-星曜标签-择续.json', type: 'asterism_item' },
    { file: 'palace-item-宫位标签-择续.json', type: 'palace_item' },
    { file: 'patterin-item-格局标签-择续.json', type: 'pattern_item' },
    { file: 'rules-item-逻辑标签-择续.json', type: 'rules_item' },
    { file: 'suitable-unsuitable-item-宜忌标签-择续.json', type: 'suitable_item' },
  ]

  let totalTags = 0

  for (const { file, type } of tagFileMappings) {
    const filePath = path.join(SYSTAG_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  标签文件不存在: ${file}`)
      continue
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const tags = raw.tags as Array<{ name: string; desc: string; keywords: string[] }>

    for (const tag of tags) {
      await prisma.ziweiTag.upsert({
        where: { name_tagType: { name: tag.name, tagType: type } },
        update: { desc: tag.desc, keywords: tag.keywords },
        create: {
          tagType: type,
          name: tag.name,
          desc: tag.desc,
          keywords: tag.keywords,
        },
      })
    }

    console.log(`  ✅ ${file} — ${tags.length} 个标签`)
    totalTags += tags.length
  }

  console.log(`🏷️  标签库入库完成，共 ${totalTags} 个标签\n`)
}

// ── 知识库入库 ──────────────────────────────────────────

async function indexKnowledge(): Promise<void> {
  console.log('📚 开始知识库入库...')

  // 动态导入依赖（避免顶层 import 在 tsx 脚本中出问题）
  const { getEmbeddingConfigForFamily } = await import('../src/lib/zvec/embedding-config')
  const { fetchEmbeddingVector } = await import('../src/lib/zvec/fetch-embedding')
  const { ensureZvecInitialized } = await import('../src/lib/zvec/init-zvec')

  // 获取 embedding 配置 — 自动检测实际维度
  let cfg: Awaited<ReturnType<typeof import('../src/lib/zvec/embedding-config').getEmbeddingConfigForFamily>> | null = null
  let actualDim = 0

  // 依次尝试 1024 维和 1536 维的配置
  const families: Array<import('../src/lib/zvec/constants').EmbeddingDimensionFamily> = ['1024', '1536']
  for (const f of families) {
    const candidate = await getEmbeddingConfigForFamily(prisma, f).catch(() => null)
    if (candidate) {
      try {
        const testVec = await fetchEmbeddingVector(candidate, '维度检测', { callRole: 'document' })
        actualDim = testVec.length
        console.log(`  📐 ${f} 配置可用，实际 embedding 维度: ${actualDim}`)
        cfg = candidate
        break
      } catch (err) {
        console.warn(`  ⚠️  ${f} 维配置测试失败: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  if (!cfg || !actualDim) {
    console.warn('⚠️  无可用 Embedding 配置，跳过向量化（仅入库 MySQL 元数据）')
  }

  // 打开 Zvec 集合（根据实际 embedding 维度创建）
  let col: ReturnType<typeof ZVecOpen> | null = null
  if (cfg && actualDim > 0) {
    ensureZvecInitialized()
    const colPath = path.join(process.cwd(), 'data', 'zvec', `sysknowledge_dim${actualDim}`)

    // 动态构建 schema：使用实际维度
    const invert = { indexType: ZVecIndexType.INVERT } as const
    const schema = new ZVecCollectionSchema({
      name: 'sysknowledge',
      vectors: {
        name: 'embedding',
        dataType: ZVecDataType.VECTOR_FP32,
        dimension: actualDim,
        indexParams: { indexType: ZVecIndexType.HNSW, metricType: ZVecMetricType.COSINE },
      },
      fields: [
        { name: 'text', dataType: ZVecDataType.STRING, indexParams: invert },
        { name: 'source_file', dataType: ZVecDataType.STRING, indexParams: invert },
        { name: 'content_hash', dataType: ZVecDataType.STRING, indexParams: invert },
        { name: 'biz_modules', dataType: ZVecDataType.ARRAY_STRING, indexParams: invert },
        { name: 'stars', dataType: ZVecDataType.ARRAY_STRING, indexParams: invert },
        { name: 'palaces', dataType: ZVecDataType.ARRAY_STRING, indexParams: invert },
      ],
    })

    try {
      col = ZVecOpen(colPath, { readOnly: false })
    } catch {
      col = ZVecCreateAndOpen(colPath, schema)
      console.log(`  📦 创建新 Zvec 集合: ${colPath} (${actualDim} 维)`)
    }
  }

  // 扫描知识文件
  const files = getAllMdFiles(KNOWLEDGE_DIR)
  console.log(`📚 找到 ${files.length} 个知识文件\n`)

  let totalChunks = 0
  let skippedFiles = 0

  for (const filePath of files) {
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(rawContent)
    const fm = data as Partial<KnowledgeFrontMatter>

    if (!fm.title) {
      // 无 Front Matter → 从文件内容自动提取元数据
      const autoMeta = extractMetadataFromContent(content, path.relative(KNOWLEDGE_DIR, filePath))
      if (autoMeta.title) {
        fm.title = autoMeta.title
        fm.stars = autoMeta.stars
        fm.palaces = autoMeta.palaces
        fm.sihua = autoMeta.sihua
        fm.domains = autoMeta.domains
        fm.patterns = autoMeta.patterns
        fm.topicType = autoMeta.topicType
        fm.timeScope = autoMeta.timeScope
        fm.priority = autoMeta.priority
        console.log(`  📝 自动提取元数据: ${fm.title} (星${(fm.stars ?? []).length} 宫${(fm.palaces ?? []).length} 化${(fm.sihua ?? []).length})`)
      } else {
        console.warn(`⚠️  跳过（无法提取标题）：${path.relative(KNOWLEDGE_DIR, filePath)}`)
        skippedFiles++
        continue
      }
    }

    // 标签校验（使用 normalizePalaceName 归一化后检查）
    const validation = validateTags(fm)
    if (validation.errors.length > 0) {
      console.warn(`❌ 标签校验失败: ${fm.title}`)
      for (const err of validation.errors) {
        console.warn(`   ${err}`)
      }
      skippedFiles++
      continue
    }
    if (validation.warnings.length > 0) {
      for (const w of validation.warnings) {
        console.warn(`  ⚠️  ${w}`)
      }
    }

    // 切片
    const chunks = splitIntoChunks(content, 800)
    const relativePath = path.relative(process.cwd(), filePath)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkTitle = i === 0 ? fm.title : `${fm.title}（${i + 1}）`

      // 向量化
      let vectorId: string | null = null
      if (cfg && col) {
        try {
          const vec = await fetchEmbeddingVector(cfg, `${fm.title}\n\n${chunk}`, {
            callRole: 'document',
          })
          const id = sanitizeZvecId(`${relativePath}::${i}`)
          col.upsertSync({
            id,
            vectors: { embedding: vec },
            fields: {
              text: `${fm.title}\n\n${chunk}`,
              source_file: relativePath,
              content_hash: simpleHash(chunk),
              biz_modules: (fm.domains ?? []) as string[],
              stars: (fm.stars ?? []) as string[],
              palaces: (fm.palaces ?? []) as string[],
            },
          })
          vectorId = id
        } catch (err) {
          console.warn(`  ⚠️  向量化失败 (${chunkTitle}): ${err instanceof Error ? err.message : err}`)
        }
      }

      // 存入 MySQL
      await prisma.ziweiKnowledge.upsert({
        where: {
          filePath_chunkIndex: {
            filePath: relativePath,
            chunkIndex: i,
          },
        },
        update: {
          title: chunkTitle,
          content: chunk,
          stars: fm.stars ?? [],
          palaces: fm.palaces ?? [],
          sihua: fm.sihua ?? [],
          domains: fm.domains ?? [],
          patterns: fm.patterns ?? [],
          topicType: fm.topicType ?? '星曜本义',
          timeScope: fm.timeScope ?? '本命',
          priority: fm.priority ?? 5,
          vectorId,
        },
        create: {
          filePath: relativePath,
          chunkIndex: i,
          title: chunkTitle,
          content: chunk,
          stars: fm.stars ?? [],
          palaces: fm.palaces ?? [],
          sihua: fm.sihua ?? [],
          domains: fm.domains ?? [],
          patterns: fm.patterns ?? [],
          topicType: fm.topicType ?? '星曜本义',
          timeScope: fm.timeScope ?? '本命',
          priority: fm.priority ?? 5,
          vectorId,
        },
      })

      totalChunks++
    }

    console.log(`  ✅ ${fm.title} — ${chunks.length} 个切片`)
  }

  // 优化 Zvec 索引
  if (col) {
    col.optimizeSync()
    col.closeSync()
  }

  console.log(`\n📚 知识库入库完成！`)
  console.log(`   总计 ${totalChunks} 个切片，跳过 ${skippedFiles} 个文件`)
}

// ── 工具函数 ────────────────────────────────────────────

function getAllMdFiles(dir: string): string[] {
  const result: string[] = []
  if (!fs.existsSync(dir)) return result

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...getAllMdFiles(full))
    else if (entry.name.endsWith('.md')) result.push(full)
  }
  return result
}

function splitIntoChunks(content: string, maxLen: number): string[] {
  const paragraphs = content.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length > maxLen && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

/** 简单哈希（用于 content_hash） */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

/** Zvec doc_id 只允许 [a-zA-Z0-9_-]，将不安全字符替换为下划线 */
function sanitizeZvecId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** 基础标签校验（内联版本，避免 import server-only 模块） */
function validateTags(fm: Partial<KnowledgeFrontMatter>): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  const validSihua = ['化禄', '化权', '化科', '化忌']

  if (fm.sihua) {
    for (const s of fm.sihua) {
      if (!validSihua.includes(s)) {
        errors.push(`未知四化类型: "${s}"，有效值: ${validSihua.join('、')}`)
      }
    }
  }

  // 宫位名基础校验
  const knownPalaces = [
    '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
    '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
    '奴仆宫', '事业宫',
  ]
  if (fm.palaces) {
    for (const p of fm.palaces) {
      if (!knownPalaces.includes(p)) {
        warnings.push(`宫位 "${p}" 不在标准列表中`)
      }
    }
  }

  return { errors, warnings }
}

// ── 从内容自动提取元数据（无 Front Matter 时使用）─────────

const AUTO_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  '文昌', '文曲', '左辅', '右弼', '禄存', '天马',
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
  '天魁', '天钺', '天刑', '天姚', '红鸾', '天喜',
  '天官', '天福', '天虚', '天哭', '龙池', '凤阁',
  '孤辰', '寡宿', '华盖', '天空',
  '解神', '天巫', '天月', '阴煞', '三台', '八座',
  '恩光', '天贵', '天才', '天寿', '截空', '旬空',
  '大耗', '天伤', '天使', '蜚廉', '破碎', '台辅',
  '封诰', '天德', '月德', '天马',
]

const AUTO_PALACES = [
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
  '奴仆宫', '事业宫',
]

const AUTO_SIHUA = ['化禄', '化权', '化科', '化忌']

const AUTO_DOMAINS_MAP: Record<string, string[]> = {
  '财运': ['财运', '财富', '收入', '赚钱', '破财', '投资', '理财', '正财', '偏财', '富'],
  '事业': ['事业', '工作', '职业', '升职', '创业', '生意', '官禄', '行业'],
  '感情': ['感情', '婚姻', '恋爱', '桃花', '配偶', '夫妻', '结婚', '离婚'],
  '健康': ['健康', '身体', '疾病', '生病', '手术', '疾厄', '养生'],
  '子女': ['子女', '孩子', '生育', '怀孕', '亲子'],
  '六亲': ['父母', '兄弟', '姐妹', '朋友', '贵人', '小人', '六亲'],
  '学业': ['学业', '考试', '学历', '读书', '升学', '留学'],
  '出行': ['出行', '出国', '旅游', '迁移', '迁居', '移民'],
}

const AUTO_TOPIC_MAP: Array<{ keywords: string[], topicType: string }> = [
  { keywords: ['星曜', '赋性', '十四主星', '主星', '辅星', '煞星'], topicType: '星曜本义' },
  { keywords: ['宫位', '命宫', '财帛宫', '官禄宫', '十二宫'], topicType: '宫位含义' },
  { keywords: ['四化', '化禄', '化权', '化科', '化忌'], topicType: '四化' },
  { keywords: ['格局', '富贵格', '凶格', '吉格'], topicType: '格局' },
  { keywords: ['事项', '分析', '财运', '事业', '感情', '健康', '学业'], topicType: '组合' },
]

function extractMetadataFromContent(
  content: string,
  relativePath: string,
): Partial<KnowledgeFrontMatter> {
  // 从第一个 # 提取标题
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].replace(/[`*#]/g, '').trim() : ''

  if (!title) return {}

  // 提取星曜（按出现频率排序，最多取 10 个）
  const stars = AUTO_STARS
    .filter(s => content.includes(s))
    .slice(0, 10)

  // 提取宫位
  const palaces = AUTO_PALACES
    .filter(p => content.includes(p))
    .slice(0, 12)

  // 提取四化
  const sihua = AUTO_SIHUA.filter(s => content.includes(s))

  // 提取领域
  const domains: string[] = []
  for (const [domain, keywords] of Object.entries(AUTO_DOMAINS_MAP)) {
    if (keywords.some(kw => content.includes(kw) || relativePath.includes(kw))) {
      domains.push(domain)
    }
  }

  // 推断 topicType
  let topicType = '综合'
  for (const { keywords, topicType: tt } of AUTO_TOPIC_MAP) {
    if (keywords.some(kw => content.includes(kw) || relativePath.includes(kw))) {
      topicType = tt
      break
    }
  }

  // 优先级：综合知识文件 > 专项文件
  const priority = domains.length >= 3 ? 7 : domains.length >= 1 ? 6 : 5

  return {
    title,
    stars,
    palaces,
    sihua,
    domains,
    patterns: [],
    topicType,
    timeScope: '本命',
    priority,
  }
}

// ── 执行 ────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 开始知识库入库流程...\n')
  console.log(`   知识库目录: ${KNOWLEDGE_DIR}`)
  console.log(`   标签库目录: ${SYSTAG_DIR}\n`)

  await indexTags()
  await indexKnowledge()

  console.log('\n🎉 全部完成！')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 入库失败:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
