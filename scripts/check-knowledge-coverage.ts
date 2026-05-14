/**
 * 知识库覆盖率检查脚本
 *
 * 检查 sysknowledge_json/ 目录下的知识库文件完整性
 *
 * 运行：npx tsx scripts/check-knowledge-coverage.ts
 */
import fs from 'fs'
import path from 'path'

const JSON_DIR = path.join(process.cwd(), 'sysknowledge_json')

// ── 必需的知识条目 ───────────────────────────────────────

const REQUIRED: Record<string, string[]> = {
  stars: [
    '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
    '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'
  ],
  palaces: [
    '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
    '迁移宫', '仆役宫', '官禄宫', '田宅宫', '福德宫', '父母宫'
  ],
  sihua: ['化禄', '化权', '化科', '化忌'],
  patterns: ['禄马交驰格', '紫微七杀格', '机月同梁格'],
}

// ── 检查函数 ────────────────────────────────────────────

interface CheckResult {
  category: string
  name: string
  exists: boolean
  valid: boolean
  error?: string
}

function checkFile(category: string, name: string): CheckResult {
  const filePath = path.join(JSON_DIR, category, `${name}.json`)

  if (!fs.existsSync(filePath)) {
    return { category, name, exists: false, valid: false }
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    // 基础验证
    if (!data.name) {
      return { category, name, exists: true, valid: false, error: '缺少 name 字段' }
    }

    if (!data.category) {
      return { category, name, exists: true, valid: false, error: '缺少 category 字段' }
    }

    // 类别特定验证
    if (category === 'stars') {
      if (!data.palaces || typeof data.palaces !== 'object') {
        return { category, name, exists: true, valid: false, error: '缺少 palaces 字段' }
      }
      // 检查关键宫位
      const keyPalaces = ['财帛宫', '官禄宫', '命宫']
      const emptyPalaces = keyPalaces.filter(p => !data.palaces[p])
      if (emptyPalaces.length > 0) {
        return { category, name, exists: true, valid: true, error: `关键宫位为空: ${emptyPalaces.join(', ')}` }
      }
    }

    if (category === 'sihua') {
      if (!data.by_palace || typeof data.by_palace !== 'object') {
        return { category, name, exists: true, valid: false, error: '缺少 by_palace 字段' }
      }
    }

    return { category, name, exists: true, valid: true }
  } catch (err) {
    return {
      category, name, exists: true, valid: false,
      error: err instanceof Error ? err.message : 'JSON 解析失败'
    }
  }
}

// ── 主检查流程 ───────────────────────────────────────────

async function checkCoverage() {
  console.log('🔍 检查知识库覆盖率...\n')

  const results: CheckResult[] = []
  let missing = 0
  let invalid = 0
  let warnings = 0

  for (const [category, items] of Object.entries(REQUIRED)) {
    console.log(`\n── ${category.toUpperCase()} ──`)

    for (const name of items) {
      const result = checkFile(category, name)
      results.push(result)

      if (!result.exists) {
        console.error(`   ❌ 缺少: ${name}.json`)
        missing++
      } else if (!result.valid) {
        console.error(`   ❌ 无效: ${name}.json - ${result.error}`)
        invalid++
      } else if (result.error) {
        console.warn(`   ⚠️  ${name}.json - ${result.error}`)
        warnings++
      } else {
        console.log(`   ✅ ${name}`)
      }
    }
  }

  // 统计
  console.log(`\n${'═'.repeat(40)}`)
  console.log(`📊 覆盖率报告`)
  console.log(`   总计检查: ${results.length} 项`)
  console.log(`   缺少文件: ${missing} 项`)
  console.log(`   无效文件: ${invalid} 项`)
  console.log(`   警告: ${warnings} 项`)

  // 目录检查
  console.log(`\n── 目录结构检查 ──`)
  const categories = ['stars', 'palaces', 'sihua', 'patterns', 'combinations']
  for (const cat of categories) {
    const catDir = path.join(JSON_DIR, cat)
    if (!fs.existsSync(catDir)) {
      console.error(`   ❌ 目录不存在: ${cat}`)
      continue
    }
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.json'))
    console.log(`   ✅ ${cat}: ${files.length} 个文件`)
  }

  // 总结
  console.log(`\n${'═'.repeat(40)}`)
  if (missing === 0 && invalid === 0) {
    console.log('🎉 覆盖率 100%，可以上线！')
    process.exit(0)
  } else {
    console.log(`❌ 需要补充 ${missing + invalid} 项内容后再上线`)
    console.log('\n💡 解决方案：')
    console.log('   1. 将原始文档放入 sysfiles/sysknowledge_raw/ 对应目录')
    console.log('   2. 运行 npm run ziwei:wash 进行 ETL 清洗')
    console.log('   3. 再次运行 npm run ziwei:check 验证')
    process.exit(1)
  }
}

checkCoverage().catch(console.error)
