/**
 * 知识库自动导入脚本
 *
 * 将 sysfiles/sysknowledge_raw/ 下的原始文档自动分类并放入对应目录
 * 然后调用 wash-knowledge.ts 进行 ETL 清洗
 *
 * 运行：npx tsx scripts/auto-import-knowledge.ts
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const RAW_DIR = path.join(process.cwd(), 'sysfiles', 'sysknowledge_raw')

// ── 知识分类规则 ───────────────────────────────────────

interface CategoryRule {
  patterns: RegExp[]
  category: string
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    // 星曜：包含"星"且在星曜列表中
    patterns: [/紫微/, /天机/, /太阳/, /武曲/, /天同/, /廉贞/, /天府/, /太阴/, /贪狼/, /巨门/, /天相/, /天梁/, /七杀/, /破军/],
    category: 'stars'
  },
  {
    // 宫位：包含"宫"
    patterns: [/命宫/, /兄弟宫/, /夫妻宫/, /子女宫/, /财帛宫/, /疾厄宫/, /迁移宫/, /仆役宫/, /官禄宫/, /田宅宫/, /福德宫/, /父母宫/],
    category: 'palaces'
  },
  {
    // 四化：包含"化"
    patterns: [/化禄/, /化权/, /化科/, /化忌/],
    category: 'sihua'
  },
  {
    // 格局：包含"格"
    patterns: [/格/, /格局/],
    category: 'patterns'
  }
]

// ── 知识分类判断 ───────────────────────────────────────

function classifyKnowledge(fileName: string): string | null {
  const lowerName = fileName.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(fileName)) {
        return rule.category
      }
    }
  }

  return null
}

// ── 文件扫描 ───────────────────────────────────────────

interface FileInfo {
  originalPath: string
  category: string | null
  suggestedName: string
}

function scanFiles(): FileInfo[] {
  const results: FileInfo[] = []

  if (!fs.existsSync(RAW_DIR)) {
    console.log(`📁 原始资料目录不存在: ${RAW_DIR}`)
    console.log('💡 将在当前目录创建示例结构...')
    createSampleStructure()
    return results
  }

  // 递归扫描所有文件
  function scanDir(dir: string, relativePath: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.join(relativePath, entry.name)

      if (entry.isDirectory()) {
        scanDir(fullPath, relPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (['.txt', '.md', '.docx', '.pdf'].includes(ext)) {
          const category = classifyKnowledge(entry.name)
          const suggestedName = entry.name
            .replace(/\.(txt|md|docx|pdf)$/i, '')
            .replace(/原始资料|知识|详解|基础/g, '')
            .trim()

          results.push({
            originalPath: fullPath,
            category,
            suggestedName
          })
        }
      }
    }
  }

  scanDir(RAW_DIR)
  return results
}

// ── 创建示例目录结构 ───────────────────────────────────

function createSampleStructure() {
  const categories = ['stars', 'palaces', 'sihua', 'patterns']

  for (const cat of categories) {
    const catDir = path.join(RAW_DIR, cat)
    fs.mkdirSync(catDir, { recursive: true })

    // 创建示例文件
    if (cat === 'stars') {
      const example = `# 武曲星知识

## 基本性质
武曲属金，北斗第六星。为财星兼将星。

## 在各宫
- 命宫：性格刚毅果断，重实利
- 财帛宫：正财运强，适合金融财务类工作
- 官禄宫：执行力强，适合金融、实业、军警

## 四化
- 化禄：财运大旺
- 化忌：注意金属伤灾
`
      fs.writeFileSync(path.join(catDir, '武曲星原始资料.txt'), example)
    }
  }

  console.log('✅ 示例目录结构已创建')
}

// ── 主流程 ─────────────────────────────────────────────

async function autoImport() {
  console.log('🔍 扫描知识库文件...\n')

  const files = scanFiles()

  if (files.length === 0) {
    console.log('❌ 没有找到可导入的文件')
    process.exit(0)
  }

  console.log(`📊 扫描到 ${files.length} 个文件：\n`)

  // 分类统计
  const stats: Record<string, number> = {
    stars: 0,
    palaces: 0,
    sihua: 0,
    patterns: 0,
    unknown: 0
  }

  for (const file of files) {
    const category = file.category ?? 'unknown'
    stats[category]++

    const status = category === 'unknown' ? '⚠️' : '✅'
    console.log(`   ${status} [${category.padEnd(10)}] ${path.basename(file.originalPath)}`)
  }

  // 统计
  console.log(`\n📈 分类统计：`)
  console.log(`   星曜: ${stats.stars}`)
  console.log(`   宫位: ${stats.palaces}`)
  console.log(`   四化: ${stats.sihua}`)
  console.log(`   格局: ${stats.patterns}`)
  console.log(`   未分类: ${stats.unknown}`)

  // 询问是否继续
  console.log('\n💡 下一步：')
  console.log('   运行 npm run ziwei:wash 进行 ETL 清洗')
  console.log('   运行 npm run ziwei:check 检查覆盖率')

  if (stats.unknown > 0) {
    console.log(`\n⚠️  有 ${stats.unknown} 个文件未能自动分类`)
    console.log('   请手动分类或修改文件名后重新扫描')
  }
}

autoImport().catch(console.error)
