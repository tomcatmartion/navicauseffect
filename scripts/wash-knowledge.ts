/**
 * 知识库 AI 数据清洗脚本（ETL）
 *
 * 将 sysfiles/sysknowledge_raw/ 下的原始文档转换为结构化 JSON
 *
 * 运行：npx tsx scripts/wash-knowledge.ts
 *
 * 运行前为本脚本单独设置环境变量（与主站解盘无关；主站大模型密钥在库表 ai_model_configs）：
 *   AI_API_KEY=xxx
 *   AI_BASE_URL=https://api.deepseek.com/v1
 *   AI_MODEL=deepseek-chat
 */
import fs from 'fs'
import path from 'path'

const RAW_DIR = path.join(process.cwd(), 'sysfiles', 'sysknowledge_raw')
const OUTPUT_DIR = path.join(process.cwd(), 'sysknowledge_json')

// 从环境变量读取 AI 配置
const API_KEY = process.env.AI_API_KEY ?? ''
const BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1'
const MODEL = process.env.AI_MODEL ?? 'deepseek-chat'

// ── 分类到 Prompt 的映射 ─────────────────────────────────

const STAR_PROMPT = (name: string, raw: string) => `
你是紫微斗数知识结构化专家。请将以下关于【${name}】的原始资料，
提取整理为严格的 JSON 格式。

规则：
1. 只提取原文中明确存在的内容，不足的字段留空字符串 ""
2. 绝对不允许自行编造内容
3. 直接输出 JSON，不要任何额外文字

目标 JSON 结构：
{
  "name": "${name}",
  "category": "stars",
  "base_nature": "基本性质与五行属性",
  "personality": "性格特质关键词，逗号分隔",
  "palaces": {
    "命宫": "", "财帛宫": "", "官禄宫": "", "夫妻宫": "",
    "疾厄宫": "", "迁移宫": "", "福德宫": "", "田宅宫": "",
    "父母宫": "", "兄弟宫": "", "仆役宫": "", "子女宫": ""
  },
  "sihua": {
    "化禄": "", "化权": "", "化科": "", "化忌": ""
  },
  "combinations": {}
}

原始资料：
${raw.slice(0, 8000)}
`

const PALACE_PROMPT = (name: string, raw: string) => `
你是紫微斗数知识结构化专家。请将以下关于【${name}】的原始资料，
提取整理为严格的 JSON 格式。只提取原文存在的内容，不足留空，不得编造。
直接输出 JSON。

目标 JSON 结构：
{
  "name": "${name}",
  "category": "palaces",
  "core_meaning": "宫位核心含义",
  "domain_rules": {
    "财运": "",
    "事业": "",
    "感情": "",
    "健康": ""
  },
  "empty_palace_rule": "空宫处理规则",
  "key_warnings": []
}

原始资料：
${raw.slice(0, 8000)}
`

const SIHUA_PROMPT = (name: string, raw: string) => `
你是紫微斗数知识结构化专家。请将以下关于【${name}】的原始资料，
提取整理为严格的 JSON 格式。只提取原文存在的内容，不足留空，不得编造。
直接输出 JSON。

目标 JSON 结构：
{
  "name": "${name}",
  "category": "sihua",
  "core_meaning": "四化核心含义",
  "by_palace": {
    "命宫": "", "财帛宫": "", "官禄宫": "", "夫妻宫": "",
    "疾厄宫": "", "迁移宫": "", "福德宫": "", "田宅宫": "",
    "父母宫": "", "兄弟宫": "", "仆役宫": "", "子女宫": ""
  },
  "special_rules": {}
}

原始资料：
${raw.slice(0, 8000)}
`

const PATTERN_PROMPT = (name: string, raw: string) => `
你是紫微斗数知识结构化专家。请将以下关于格局【${name}】的原始资料，
提取整理为严格的 JSON 格式。只提取原文存在的内容，不足留空，不得编造。
直接输出 JSON。

目标 JSON 结构：
{
  "name": "${name}",
  "category": "patterns",
  "condition": "成格条件",
  "core_meaning": "格局核心含义",
  "fortune_level": "吉凶量级",
  "applicable_domains": [],
  "analysis": "详细解析",
  "warnings": "注意事项"
}

原始资料：
${raw.slice(0, 8000)}
`

const PROMPT_MAP: Record<string, (name: string, raw: string) => string> = {
  stars: STAR_PROMPT,
  palaces: PALACE_PROMPT,
  sihua: SIHUA_PROMPT,
  patterns: PATTERN_PROMPT,
}

// ── 调用 AI 清洗 ─────────────────────────────────────────

async function callETLModel(prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) throw new Error(`ETL AI 请求失败: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content as string
}

// ── 验证 JSON 格式 ───────────────────────────────────────

function validateJSON(content: string, category: string): boolean {
  try {
    const obj = JSON.parse(content)
    if (!obj.name || !obj.category) return false
    if (category === 'stars' && !obj.palaces) return false
    if (category === 'sihua' && !obj.by_palace) return false
    return true
  } catch {
    return false
  }
}

// ── 主清洗流程 ───────────────────────────────────────────

async function washKnowledge() {
  console.log('🚀 开始知识库 ETL 清洗...\n')

  if (!API_KEY) {
    console.error('❌ 请先设置 AI_API_KEY 环境变量')
    process.exit(1)
  }

  if (!fs.existsSync(RAW_DIR)) {
    console.error(`❌ 原始资料目录不存在: ${RAW_DIR}`)
    console.log('💡 请先创建目录结构：')
    console.log('   sysfiles/sysknowledge_raw/stars/*.txt')
    console.log('   sysfiles/sysknowledge_raw/palaces/*.txt')
    console.log('   sysfiles/sysknowledge_raw/sihua/*.txt')
    console.log('   sysfiles/sysknowledge_raw/patterns/*.txt')
    process.exit(1)
  }

  // 确保输出目录存在
  const categories = ['stars', 'palaces', 'sihua', 'patterns', 'combinations']
  for (const cat of categories) {
    fs.mkdirSync(path.join(OUTPUT_DIR, cat), { recursive: true })
  }

  let processed = 0
  let failed = 0

  // 遍历原始资料目录
  for (const category of categories) {
    const catDir = path.join(RAW_DIR, category)
    if (!fs.existsSync(catDir)) {
      console.log(`⏭  目录不存在，跳过: ${category}`)
      continue
    }

    const files = fs.readdirSync(catDir).filter(
      f => f.endsWith('.txt') || f.endsWith('.md')
    )

    for (const file of files) {
      // 从文件名提取名称
      const name = file
        .replace(/\.(txt|md)$/, '')
        .replace(/星|宫|格|原始资料/g, '')
        .trim()

      const rawContent = fs.readFileSync(path.join(catDir, file), 'utf-8')
      const outputPath = path.join(OUTPUT_DIR, category, `${name}.json`)

      // 增量模式：已存在则跳过
      if (fs.existsSync(outputPath)) {
        console.log(`⏭  已存在，跳过: ${category}/${name}.json`)
        continue
      }

      console.log(`🔄 正在清洗: ${category}/${name}...`)

      try {
        const promptFn = PROMPT_MAP[category]
        if (!promptFn) {
          console.warn(`   ⚠️  无对应 Prompt 模板: ${category}，跳过`)
          continue
        }

        const prompt = promptFn(name, rawContent)
        const jsonContent = await callETLModel(prompt)

        // 验证格式
        if (!validateJSON(jsonContent, category)) {
          console.error(`   ❌ JSON 格式验证失败: ${category}/${name}`)
          // 保存原始返回供排查
          fs.writeFileSync(outputPath + '.error', jsonContent)
          failed++
          continue
        }

        // 格式化写入
        const parsed = JSON.parse(jsonContent)
        fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), 'utf-8')
        console.log(`   ✅ 完成: ${name}.json`)
        processed++

        // 避免 API 限速
        await new Promise(r => setTimeout(r, 500))

      } catch (err) {
        console.error(`   ❌ 清洗失败: ${name}`, err)
        failed++
      }
    }
  }

  console.log(`\n🎉 ETL 清洗完成！`)
  console.log(`   处理成功: ${processed} 项`)
  console.log(`   失败: ${failed} 项`)
}

washKnowledge().catch(console.error)
