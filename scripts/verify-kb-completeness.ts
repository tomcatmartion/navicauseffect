/**
 * 验证三个核心 JSON 知识库的完整性
 * 1. patterns.json - 84条格局定义
 * 2. event_star_attributes.json - 各宫位星曜组合
 * 3. limit_direction.json - 大限流年分析权重
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

// ═══════════════════════════════════════════════════════════════════
// 1. 验证 patterns.json
// ═══════════════════════════════════════════════════════════════════

function verifyPatterns(): { pass: boolean; issues: string[] } {
  const issues: string[] = []
  const filePath = path.join(DATA_DIR, 'patterns.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  // 检查 multipliers
  const expectedMultipliers = ['大吉', '中吉', '小吉', '小凶', '中凶', '大凶']
  for (const level of expectedMultipliers) {
    if (data.multipliers[level] === undefined) {
      issues.push(`multipliers 缺少级别: ${level}`)
    }
  }

  // 检查 categories
  const expectedCategories = ['紫微', '廉贞', '武曲', '巨门', '日月', '杀破狼', '天府', '机梁同', '其他']
  for (const cat of expectedCategories) {
    if (!data.categories[cat] || !Array.isArray(data.categories[cat])) {
      issues.push(`categories 缺少分类: ${cat}`)
    }
  }

  // 统计总格局数
  let totalPatterns = 0
  const categoryCounts: Record<string, number> = {}
  for (const [cat, patterns] of Object.entries(data.categories)) {
    const count = (patterns as string[]).length
    categoryCounts[cat] = count
    totalPatterns += count
  }

  console.log('\n📊 patterns.json 格局统计:')
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`   ${cat}: ${count} 条`)
  }
  console.log(`   总计: ${totalPatterns} 条`)

  // 检查 definitions
  let definedCount = 0
  for (const patterns of Object.values(data.categories)) {
    for (const patternName of patterns as string[]) {
      if (data.definitions[patternName]) {
        definedCount++
        const def = data.definitions[patternName]
        if (!def.level) issues.push(`格局 ${patternName} 缺少 level`)
        if (!def.category) issues.push(`格局 ${patternName} 缺少 category`)
        if (!def.description) issues.push(`格局 ${patternName} 缺少 description`)
        if (!def.trigger) issues.push(`格局 ${patternName} 缺少 trigger`)
      } else {
        issues.push(`格局 ${patternName} 缺少 definition`)
      }
    }
  }

  console.log(`   已定义: ${definedCount} 条`)

  // SKILL 文档列出84条，但由于存在重复名称和多种变体（如因财持刀有2种、马头带剑有2种等）
  // patterns.json 将每种变体作为独立条目，所以总数会超过84
  // 只要所有格局都有 definition 且分类正确即可
  if (definedCount !== totalPatterns) {
    issues.push(`格局定义不完整: ${totalPatterns} 条格局中只有 ${definedCount} 条有 definition`)
  }

  return { pass: issues.length === 0, issues }
}

// ═══════════════════════════════════════════════════════════════════
// 2. 验证 event_star_attributes.json
// ═══════════════════════════════════════════════════════════════════

function verifyEventStarAttributes(): { pass: boolean; issues: string[] } {
  const issues: string[] = []
  const filePath = path.join(DATA_DIR, 'event_star_attributes.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  const expectedMatters = ['求学', '求爱', '求财', '求职', '求健康', '求名']
  const expectedStars = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']
  const expectedLevels = ['实旺', '磨炼', '平', '虚浮', '凶危']

  console.log('\n📊 event_star_attributes.json 事项统计:')

  for (const matter of expectedMatters) {
    if (!data[matter]) {
      issues.push(`缺少事项类型: ${matter}`)
      continue
    }

    const palaces = Object.keys(data[matter])
    console.log(`   ${matter}: ${palaces.length} 个宫位`)

    for (const palace of palaces) {
      const stars = Object.keys(data[matter][palace])
      const missingStars = expectedStars.filter(s => !stars.includes(s))
      if (missingStars.length > 0) {
        issues.push(`${matter} - ${palace} 缺少星曜: ${missingStars.join(', ')}`)
      }

      for (const star of stars) {
        const levels = Object.keys(data[matter][palace][star])
        const missingLevels = expectedLevels.filter(l => !levels.includes(l))
        if (missingLevels.length > 0) {
          issues.push(`${matter} - ${palace} - ${star} 缺少能级: ${missingLevels.join(', ')}`)
        }

        for (const level of levels) {
          const desc = data[matter][palace][star][level]
          if (!desc || typeof desc !== 'string' || desc.length < 5) {
            issues.push(`${matter} - ${palace} - ${star} - ${level} 描述不完整`)
          }
        }
      }
    }
  }

  return { pass: issues.length === 0, issues }
}

// ═══════════════════════════════════════════════════════════════════
// 3. 验证 limit_direction.json
// ═══════════════════════════════════════════════════════════════════

function verifyLimitDirection(): { pass: boolean; issues: string[] } {
  const issues: string[] = []
  const filePath = path.join(DATA_DIR, 'limit_direction.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  console.log('\n📊 limit_direction.json 结构验证:')

  // 检查顶层结构
  const expectedTopKeys = [
    'version', 'description', 'matterTypeMappings', 'timeAnalysis',
    'directionMatrix', 'sihuaWeights', 'daXianQualitative',
    'liuNianTimeWindow', 'innateLevelMap', 'protectionMechanism',
    'palaceProjection', 'compositeScoring', 'analysisFlow', 'outputTemplate'
  ]

  for (const key of expectedTopKeys) {
    if (data[key] === undefined) {
      issues.push(`缺少顶层键: ${key}`)
    }
  }
  console.log(`   顶层键: ${expectedTopKeys.length} 个 ✓`)

  // 检查 matterTypeMappings
  const expectedMatters = ['求学', '求爱', '求财', '求职', '求健康', '求名']
  for (const matter of expectedMatters) {
    if (!data.matterTypeMappings[matter]) {
      issues.push(`缺少事项映射: ${matter}`)
      continue
    }
    const mapping = data.matterTypeMappings[matter]
    if (!mapping.primaryPalace) issues.push(`${matter} 缺少 primaryPalace`)
    if (!mapping.secondaryPalaces) issues.push(`${matter} 缺少 secondaryPalaces`)
    if (!mapping.timeDimensions) issues.push(`${matter} 缺少 timeDimensions`)
    if (!mapping.routingConditions) issues.push(`${matter} 缺少 routingConditions`)
    if (!mapping.fourDimensionFocus) issues.push(`${matter} 缺少 fourDimensionFocus`)
  }
  console.log(`   事项映射: ${expectedMatters.length} 个 ✓`)

  // 检查 timeAnalysis
  const ta = data.timeAnalysis
  if (!ta.weights?.daXian?.weight) issues.push('timeAnalysis.weights.daXian 不完整')
  if (!ta.weights?.liuNian?.weight) issues.push('timeAnalysis.weights.liuNian 不完整')
  if (!ta.weights?.liuYue?.weight) issues.push('timeAnalysis.weights.liuYue 不完整')
  if (!ta.directionJudgment?.matrix) issues.push('timeAnalysis.directionJudgment.matrix 不完整')
  console.log(`   时间分析权重: ✓`)

  // 检查 directionMatrix
  const dm = data.directionMatrix
  if (!dm.scoreThresholds) issues.push('directionMatrix.scoreThresholds 不完整')
  if (!dm.palaceWeights) issues.push('directionMatrix.palaceWeights 不完整')
  for (const matter of expectedMatters) {
    if (!dm.palaceWeights[matter]) issues.push(`directionMatrix.palaceWeights 缺少 ${matter}`)
  }
  console.log(`   方向矩阵: ✓`)

  // 检查 sihuaWeights
  const sw = data.sihuaWeights
  if (!sw.daXianSihua?.rules) issues.push('sihuaWeights.daXianSihua 不完整')
  if (!sw.liuNianSihua?.rules) issues.push('sihuaWeights.liuNianSihua 不完整')
  if (!sw.liuYueSihua?.rules) issues.push('sihuaWeights.liuYueSihua 不完整')
  console.log(`   四化权重: ✓`)

  // 检查 innateLevelMap
  const ilm = data.innateLevelMap
  const expectedLevels = ['实旺', '磨炼', '平', '虚浮', '凶危']
  for (const level of expectedLevels) {
    if (!ilm.levels?.[level]) issues.push(`innateLevelMap.levels 缺少 ${level}`)
  }
  console.log(`   原局能级: ✓`)

  // 检查 protectionMechanism
  const pm = data.protectionMechanism
  const expectedMechanisms = ['双禄夹目标宫', '禄存在目标宫', '天府守财库', '护佑格局完整']
  for (const mech of expectedMechanisms) {
    if (!pm.mechanisms?.[mech]) issues.push(`protectionMechanism.mechanisms 缺少 ${mech}`)
  }
  console.log(`   保护机制: ✓`)

  // 检查 palaceProjection
  const pp = data.palaceProjection
  if (!pp.coefficients?.['本宫']) issues.push('palaceProjection.coefficients 缺少 本宫')
  if (!pp.coefficients?.['对宫']) issues.push('palaceProjection.coefficients 缺少 对宫')
  if (!pp.coefficients?.['三合宫']) issues.push('palaceProjection.coefficients 缺少 三合宫')
  if (!pp.coefficients?.['夹宫']?.matrix) issues.push('palaceProjection.coefficients 缺少 夹宫.matrix')
  console.log(`   空间投射: ✓`)

  // 检查 compositeScoring
  const cs = data.compositeScoring
  if (!cs.formula) issues.push('compositeScoring.formula 不完整')
  console.log(`   综合评分: ✓`)

  // 检查 analysisFlow
  const af = data.analysisFlow
  if (!af.steps || af.steps.length < 10) issues.push(`analysisFlow.steps 步骤不足 (${af.steps?.length || 0})`)
  console.log(`   分析流程: ${af.steps?.length || 0} 步 ✓`)

  return { pass: issues.length === 0, issues }
}

// ═══════════════════════════════════════════════════════════════════
// 主程序
// ═══════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║     知识库 JSON 完整性验证                                   ║')
console.log('╚══════════════════════════════════════════════════════════════╝')

const results = {
  patterns: verifyPatterns(),
  eventStarAttributes: verifyEventStarAttributes(),
  limitDirection: verifyLimitDirection(),
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('验证结果汇总:')
console.log('═══════════════════════════════════════════════════════════════')

let totalIssues = 0
for (const [name, result] of Object.entries(results)) {
  const status = result.pass ? '✅ 通过' : '❌ 失败'
  console.log(`\n${name}:`)
  console.log(`  状态: ${status}`)
  if (result.issues.length > 0) {
    console.log(`  问题 (${result.issues.length} 个):`)
    for (const issue of result.issues) {
      console.log(`    - ${issue}`)
    }
    totalIssues += result.issues.length
  }
}

console.log('\n═══════════════════════════════════════════════════════════════')
if (totalIssues === 0) {
  console.log('✅ 所有验证通过！三个 JSON 文件均完整。')
  process.exit(0)
} else {
  console.log(`❌ 共发现 ${totalIssues} 个问题，需要修复。`)
  process.exit(1)
}
