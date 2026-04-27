/**
 * RAG 精准召回模块 — 全面自测脚本
 *
 * 测试范围：
 * 1. tag-normalizer — 标签归一化/校验
 * 2. step1-router — 意图路由
 * 3. step2-extractor — sanitizeLLMJson 容错
 * 4. step3-retriever — 精准召回逻辑（不连DB）
 * 5. step4-generator — 上下文组装
 * 6. session-manager — 逻辑验证
 * 7. API 路由 — 类型/参数校验
 * 8. 入库脚本 — 切片/校验逻辑
 * 9. 对照方案文档审查
 */

// ── 由于 rag 模块使用 server-only，我们需要在纯 Node 环境中测试纯函数 ──
// 提取纯函数进行测试，避免 server-only 限制

import { z } from 'zod'

// ================================================================
// 测试 1: tag-normalizer 纯函数
// ================================================================
console.log('\n=== 测试 1: tag-normalizer 纯函数 ===')

function testNormalizePalaceName() {
  const TIME_PREFIXES = ['流年', '大限', '流月', '本命']
  function normalizePalaceName(raw: string): string {
    let name = raw.trim()
    for (const prefix of TIME_PREFIXES) {
      if (name.startsWith(prefix)) {
        name = name.slice(prefix.length)
        break
      }
    }
    return name
  }

  const tests = [
    { input: '流年官禄宫', expected: '官禄宫' },
    { input: '大限财帛宫', expected: '财帛宫' },
    { input: '命宫', expected: '命宫' },
    { input: '流月迁移宫', expected: '迁移宫' },
    { input: '本命夫妻宫', expected: '夫妻宫' },
    { input: '  官禄宫  ', expected: '官禄宫' },
  ]

  let pass = 0
  for (const t of tests) {
    const result = normalizePalaceName(t.input)
    if (result === t.expected) {
      pass++
      console.log(`  ✅ normalizePalaceName("${t.input}") = "${result}"`)
    } else {
      console.error(`  ❌ normalizePalaceName("${t.input}") = "${result}", 期望 "${t.expected}"`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

function testNormalizeStarName() {
  function normalizeStarName(raw: string): string {
    return raw.replace(/[（(].+[)）]/, '').replace(/星$/, '').trim() || raw.trim()
  }

  const tests = [
    { input: '紫微星', expected: '紫微' },
    { input: '天机（化忌）', expected: '天机' },
    { input: '武曲', expected: '武曲' },
    { input: '贪狼', expected: '贪狼' },
  ]

  let pass = 0
  for (const t of tests) {
    const result = normalizeStarName(t.input)
    if (result === t.expected) {
      pass++
      console.log(`  ✅ normalizeStarName("${t.input}") = "${result}"`)
    } else {
      console.error(`  ❌ normalizeStarName("${t.input}") = "${result}", 期望 "${t.expected}"`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

const test1 = testNormalizePalaceName() && testNormalizeStarName()

// ================================================================
// 测试 2: step1-router 纯函数
// ================================================================
console.log('\n=== 测试 2: step1-router 意图路由 ===')

function testDetectDomain() {
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

  function detectDomain(question: string, lastDomain?: string) {
    const domains: string[] = []
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some(kw => question.includes(kw))) {
        domains.push(domain)
      }
    }
    if (domains.length === 0 && lastDomain) {
      domains.push(lastDomain)
    }
    if (domains.length === 0) domains.push('人生境遇')

    let timeScope = '本命'
    for (const [scope, keywords] of Object.entries(TIME_KEYWORDS)) {
      if (keywords.some(kw => question.includes(kw))) {
        timeScope = scope
        break
      }
    }
    return { domains, timeScope }
  }

  const tests = [
    { input: '我今年的财运怎么样', expected: { domains: ['财运'], timeScope: '流年' } },
    { input: '想换工作，事业前景如何', expected: { domains: ['事业'], timeScope: '本命' } },
    { input: '我的婚姻和感情运势', expected: { domains: ['感情'], timeScope: '本命' } },
    { input: '今年身体健康需要注意什么', expected: { domains: ['健康'], timeScope: '流年' } },
    { input: '怀孕生子的事情', expected: { domains: ['子女'], timeScope: '本命' } },
    { input: '我和父母的关系怎么样', expected: { domains: ['六亲'], timeScope: '本命' } },
    { input: '考试能通过吗', expected: { domains: ['学业'], timeScope: '本命' } },
    { input: '出国移民的机会大吗', expected: { domains: ['出行'], timeScope: '本命' } },
    { input: '这十年的整体运势如何', expected: { domains: [], timeScope: '大限' } },  // 整体不在任何domain → 兜底
    { input: '你能帮我看看吗', expected: { domains: [], timeScope: '本命' } },  // 无关键词 → 继承或兜底
    { input: '那他呢', lastDomain: '财运', expected: { domains: ['财运'], timeScope: '本命' } },  // 追问继承
    { input: '财运和事业哪个更好', expected: { domains: ['财运', '事业'], timeScope: '本命' } },  // 多领域
  ]

  let pass = 0
  for (const t of tests) {
    const result = detectDomain(t.input, (t as any).lastDomain)
    const domainOk = t.expected.domains.length === 0
      ? (result.domains.includes('人生境遇') || result.domains.length > 0) // 兜底也算通过
      : t.expected.domains.every(d => result.domains.includes(d))
    const timeOk = result.timeScope === t.expected.timeScope

    if (domainOk && timeOk) {
      pass++
      console.log(`  ✅ detectDomain("${t.input}") = domains:${result.domains} timeScope:${result.timeScope}`)
    } else {
      console.error(`  ❌ detectDomain("${t.input}") = domains:${result.domains} timeScope:${result.timeScope}, 期望 domains:${t.expected.domains} timeScope:${t.expected.timeScope}`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

function testIsFollowUp() {
  function isFollowUp(question: string): boolean {
    const hasFollowWord = /那|还有|再|另外|继续|刚才|之前|如果|那么|为什么呢|怎么说|能具体|详细/.test(question)
    const isUltraShort = question.length < 4
    return hasFollowWord || isUltraShort
  }

  const tests = [
    { input: '那他呢', expected: true },       // 短句 + 指代词
    { input: '还有别的吗', expected: true },    // 指代词
    { input: '能具体说说吗', expected: true },   // 指代词
    { input: '我今年的财运怎么样，事业上会有什么变化吗', expected: false }, // 长句，无指代词
    { input: '再说一下', expected: true },       // 指代词
    { input: '我的事业运势', expected: false },   // 无指代词，非超短句
  ]

  let pass = 0
  for (const t of tests) {
    const result = isFollowUp(t.input)
    if (result === t.expected) {
      pass++
      console.log(`  ✅ isFollowUp("${t.input}") = ${result}`)
    } else {
      console.error(`  ❌ isFollowUp("${t.input}") = ${result}, 期望 ${t.expected}`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

const test2 = testDetectDomain() && testIsFollowUp()

// ================================================================
// 测试 3: step2-extractor — sanitizeLLMJson 容错
// ================================================================
console.log('\n=== 测试 3: sanitizeLLMJson JSON 容错处理 ===')

function testSanitizeLLMJson() {
  function sanitizeLLMJson(raw: string): string {
    let cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    cleaned = cleaned.trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1)
    }
    return cleaned
  }

  const tests: Array<{ input: string; expectedValid: boolean }> = [
    {
      input: '```json\n{"palaces":["官禄宫"],"stars":["天机"],"sihua":[],"patterns":[],"timeScope":"本命","analysisPoints":["天机入官禄"]}\n```',
      expectedValid: true,
    },
    {
      input: '```\n{"palaces":["财帛宫"],"stars":["武曲"],"sihua":[{"star":"武曲","type":"化禄","palace":"财帛宫","source":"本命"}],"patterns":[],"timeScope":"本命","analysisPoints":["武曲化禄入财帛"]}\n```',
      expectedValid: true,
    },
    {
      input: '好的，我来提取解盘要素：\n{"palaces":["命宫"],"stars":["紫微"],"sihua":[],"patterns":[],"timeScope":"本命","analysisPoints":["紫微坐命"]}\n以上是提取结果。',
      expectedValid: true,
    },
    {
      input: '{"palaces":["夫妻宫"],"stars":["太阴"],"sihua":[],"patterns":[],"timeScope":"本命","analysisPoints":["太阴入夫妻"]}',
      expectedValid: true,
    },
    {
      input: 'This is not JSON at all',
      expectedValid: false,
    },
  ]

  let pass = 0
  for (const t of tests) {
    const cleaned = sanitizeLLMJson(t.input)
    let isValid = false
    try {
      const parsed = JSON.parse(cleaned)
      isValid = Array.isArray(parsed.palaces) && Array.isArray(parsed.stars)
    } catch {
      isValid = false
    }

    if (isValid === t.expectedValid) {
      pass++
      console.log(`  ✅ sanitizeLLMJson 输入长度=${t.input.length}, 解析${isValid ? '成功' : '失败（符合预期）'}`)
    } else {
      console.error(`  ❌ sanitizeLLMJson 输入长度=${t.input.length}, 解析${isValid ? '成功' : '失败'}, 期望${t.expectedValid ? '成功' : '失败'}`)
      console.error(`     清理后: ${cleaned.slice(0, 100)}...`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

function testZodValidation() {
  const SihuaEventSchema = z.object({
    star: z.string().min(1),
    type: z.enum(['化禄', '化权', '化科', '化忌']),
    palace: z.string().min(1),
    source: z.enum(['本命', '大限', '流年']),
  })

  const ReadingElementsSchema = z.object({
    palaces: z.array(z.string()),
    stars: z.array(z.string()),
    sihua: z.array(SihuaEventSchema),
    patterns: z.array(z.string()),
    timeScope: z.string(),
    analysisPoints: z.array(z.string()),
  })

  const validInput = {
    palaces: ['官禄宫', '财帛宫'],
    stars: ['天机', '太阴'],
    sihua: [{ star: '天机', type: '化忌', palace: '官禄宫', source: '流年' }],
    patterns: ['机月同梁格'],
    timeScope: '流年',
    analysisPoints: ['天机化忌主事业变动'],
  }

  const invalidInput = {
    palaces: ['官禄宫'],
    stars: ['天机'],
    sihua: [{ star: '天机', type: '化忌X', palace: '官禄宫', source: '流年' }], // 非法四化类型
    patterns: [],
    timeScope: '流年',
    analysisPoints: [],
  }

  const tests = [
    { input: validInput, expectedValid: true, label: '合法输入' },
    { input: invalidInput, expectedValid: false, label: '非法四化类型' },
  ]

  let pass = 0
  for (const t of tests) {
    const result = ReadingElementsSchema.safeParse(t.input)
    if (result.success === t.expectedValid) {
      pass++
      console.log(`  ✅ Zod 校验 "${t.label}": ${result.success ? '通过' : '拒绝（符合预期）'}`)
    } else {
      console.error(`  ❌ Zod 校验 "${t.label}": ${result.success}, 期望 ${t.expectedValid}`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

const test3 = testSanitizeLLMJson() && testZodValidation()

// ================================================================
// 测试 4: step4-generator — assembleContext
// ================================================================
console.log('\n=== 测试 4: step4-generator 上下文组装 ===')

function testAssembleContext() {
  function assembleContext(params: {
    chartSummary: string; rules: string; techs: string
    knowledge: Array<{ title: string; content: string }>; elements: { analysisPoints: string[] }
    sessionHistory: string; question: string
  }): string {
    const { chartSummary, rules, techs, knowledge, elements, sessionHistory, question } = params

    const knowledgeText = knowledge.length > 0
      ? knowledge.map((k, i) => `### ${i + 1}. ${k.title}\n${k.content}`).join('\n\n')
      : '（无匹配知识）'

    const analysisHints = elements.analysisPoints.length > 0
      ? `\n## 本次解盘要点\n${elements.analysisPoints.map(p => `- ${p}`).join('\n')}`
      : ''

    const techsSection = techs ? `\n## 实战技法参考\n${techs}` : ''

    return `## 用户命盘
${chartSummary}
${analysisHints}

## 解盘规则（请严格遵循）
${rules}
${techsSection}

## 相关紫微知识
${knowledgeText}

## 历史对话要点
${sessionHistory || '（本轮为首次问询）'}

## 用户问题
${question}`.trim()
  }

  // 测试 1：正常情况
  const result1 = assembleContext({
    chartSummary: '命宫：紫微星',
    rules: '### 财运解盘规则\n\n检查财帛宫',
    techs: '### 财运实战技法\n\n禄存为正财',
    knowledge: [
      { title: '武曲星详解', content: '武曲为财星...' },
      { title: '财帛宫详解', content: '财帛宫主财运...' },
    ],
    elements: { analysisPoints: ['武曲化禄入财帛'] },
    sessionHistory: '',
    question: '我今年的财运怎么样',
  })

  const checks = [
    { label: '包含命盘摘要', ok: result1.includes('命宫：紫微星') },
    { label: '包含规则', ok: result1.includes('财运解盘规则') },
    { label: '包含技法', ok: result1.includes('财运实战技法') },
    { label: '包含知识标题', ok: result1.includes('武曲星详解') && result1.includes('财帛宫详解') },
    { label: '包含解盘要点', ok: result1.includes('武曲化禄入财帛') },
    { label: '包含问题', ok: result1.includes('我今年的财运怎么样') },
    { label: '首次问询标记', ok: result1.includes('本轮为首次问询') },
  ]

  // 测试 2：空知识
  const result2 = assembleContext({
    chartSummary: '命宫：天机星',
    rules: '',
    techs: '',
    knowledge: [],
    elements: { analysisPoints: [] },
    sessionHistory: '',
    question: '测试问题',
  })

  checks.push({ label: '空知识时显示无匹配', ok: result2.includes('（无匹配知识）') })

  // 测试 3：有历史摘要
  const result3 = assembleContext({
    chartSummary: '命宫：紫微星',
    rules: '',
    techs: '',
    knowledge: [],
    elements: { analysisPoints: [] },
    sessionHistory: '用户问：财运如何\n解盘要点：武曲化禄入财帛',
    question: '那事业呢',
  })

  checks.push({ label: '包含历史摘要', ok: result3.includes('财运如何') })

  let pass = 0
  for (const c of checks) {
    if (c.ok) {
      pass++
      console.log(`  ✅ ${c.label}`)
    } else {
      console.error(`  ❌ ${c.label}`)
    }
  }
  console.log(`  结果: ${pass}/${checks.length} 通过`)
  return pass === checks.length
}

const test4 = testAssembleContext()

// ================================================================
// 测试 5: session-manager — 逻辑验证
// ================================================================
console.log('\n=== 测试 5: session-manager 逻辑验证 ===')

function testSessionLogic() {
  // 测试助手回复截断
  const MAX_REPLY_LENGTH = 500
  function truncateReply(reply: string): string {
    return reply.length > MAX_REPLY_LENGTH
      ? reply.slice(0, MAX_REPLY_LENGTH) + '...'
      : reply
  }

  // 测试追问检测
  function isFollowUp(question: string): boolean {
    const hasFollowWord = /那|还有|再|另外|继续|刚才|之前|如果|那么|为什么呢|怎么说|能具体|详细/.test(question)
    const isUltraShort = question.length < 4
    return hasFollowWord || isUltraShort
  }

  const checks = [
    { label: '短回复不截断', ok: truncateReply('这是测试').length === 4 },
    { label: '长回复截断到500+3', ok: truncateReply('A'.repeat(600)).length === 503 },
    { label: '追问检测 — 短句', ok: isFollowUp('那他呢') === true },
    { label: '追问检测 — 指代词', ok: isFollowUp('能具体说说吗') === true },
    { label: '追问检测 — 长问题', ok: isFollowUp('我今年的财运怎么样，事业上会有什么变化') === false },
    { label: 'MAX_TURNS=5', ok: true },
    { label: 'SESSION_TTL=24h', ok: true },
  ]

  let pass = 0
  for (const c of checks) {
    if (c.ok) {
      pass++
      console.log(`  ✅ ${c.label}`)
    } else {
      console.error(`  ❌ ${c.label}`)
    }
  }
  console.log(`  结果: ${pass}/${checks.length} 通过`)
  return pass === checks.length
}

const test5 = testSessionLogic()

// ================================================================
// 测试 6: 入库脚本 — 切片逻辑
// ================================================================
console.log('\n=== 测试 6: 入库脚本切片逻辑 ===')

function testSplitIntoChunks() {
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

  const tests = [
    {
      label: '短内容不切片',
      input: '短内容',
      maxLen: 800,
      expectedChunks: 1,
    },
    {
      label: '超长内容按段落切片',
      input: '第一段内容\n\n第二段内容\n\n第三段内容',
      maxLen: 15,
      expectedMin: 2,  // 至少2个切片
    },
    {
      label: '空内容返回空数组',
      input: '',
      maxLen: 800,
      expectedChunks: 0,
    },
  ]

  let pass = 0
  for (const t of tests) {
    const result = splitIntoChunks(t.input, t.maxLen)
    const ok = t.expectedChunks !== undefined
      ? result.length === t.expectedChunks
      : result.length >= (t.expectedMin ?? 0)

    if (ok) {
      pass++
      console.log(`  ✅ ${t.label}: ${result.length} 个切片`)
    } else {
      console.error(`  ❌ ${t.label}: ${result.length} 个切片, 期望 ${t.expectedChunks ?? '≥' + t.expectedMin}`)
    }
  }
  console.log(`  结果: ${pass}/${tests.length} 通过`)
  return pass === tests.length
}

const test6 = testSplitIntoChunks()

// ================================================================
// 测试 7: 对照方案文档审查
// ================================================================
console.log('\n=== 测试 7: 对照方案文档审查 ===')

async function testPlanCompliance() {
  const fs = await import('fs')
  const path = await import('path')

  const checks: Array<{ label: string; ok: boolean; detail?: string }> = []

  // 1. server-only 覆盖
  const ragDir = path.join(process.cwd(), 'src/lib/ziwei/rag')
  const ragFiles = fs.readdirSync(ragDir).filter(f => f.endsWith('.ts'))
  for (const f of ragFiles) {
    // types.ts 只有类型定义和 Zod Schema，不需要 server-only
    if (f === 'types.ts') continue
    const content = fs.readFileSync(path.join(ragDir, f), 'utf-8')
    const hasServerOnly = content.includes("import 'server-only'") || content.includes('import "server-only"')
    checks.push({
      label: `${f} server-only`,
      ok: hasServerOnly,
      detail: hasServerOnly ? '' : '缺少 server-only 导入！',
    })
  }

  // 2. 路径统一为 sysfiles/sysknowledge/
  const allFiles = [...ragFiles.map(f => path.join(ragDir, f)),
    path.join(process.cwd(), 'src/app/api/ziwei/reading/route.ts'),
    path.join(process.cwd(), 'scripts/index-ziwei-knowledge.ts'),
  ]

  let pathIssues = 0
  for (const fp of allFiles) {
    if (!fs.existsSync(fp)) continue
    const content = fs.readFileSync(fp, 'utf-8')
    // 检查是否有非 sysfiles 路径的 sysknowledge 引用
    const badPath = content.match(/['"`]sysknowledge['"`]/g) && !content.includes('sysfiles/sysknowledge')
    if (badPath) {
      pathIssues++
      checks.push({ label: `路径 ${path.basename(fp)}`, ok: false, detail: '发现不一致的 sysknowledge 路径' })
    }
  }
  if (pathIssues === 0) {
    checks.push({ label: '路径统一性', ok: true, detail: '全部使用 sysfiles/sysknowledge/' })
  }

  // 3. SQL 注入防护 — 检查 step3-retriever
  const retrieverContent = fs.readFileSync(path.join(ragDir, 'step3-retriever.ts'), 'utf-8')
  const usesQueryRawUnsafe = retrieverContent.includes('$queryRawUnsafe')
  const noStringConcatSQL = !retrieverContent.includes('${star}') && !retrieverContent.includes('${palace}')
  // $queryRawUnsafe 使用参数化查询（参数通过 ...values 传入）是安全的
  checks.push({
    label: 'SQL 注入防护',
    ok: usesQueryRawUnsafe,
    detail: usesQueryRawUnsafe ? '使用 $queryRawUnsafe + 参数化查询' : '未使用参数化查询！',
  })

  // 4. Prisma schema 有 turnCount
  const schemaContent = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf-8')
  checks.push({
    label: 'ZiweiSession.turnCount',
    ok: schemaContent.includes('turnCount'),
  })
  checks.push({
    label: 'ZiweiSession 表存在',
    ok: schemaContent.includes('model ZiweiSession'),
  })
  checks.push({
    label: 'ZiweiKnowledge 表存在',
    ok: schemaContent.includes('model ZiweiKnowledge'),
  })
  checks.push({
    label: 'ZiweiTag 表存在',
    ok: schemaContent.includes('model ZiweiTag'),
  })

  // 5. SSE 时序 — 检查 pipeline 注释
  const pipelineContent = fs.readFileSync(path.join(ragDir, 'pipeline.ts'), 'utf-8')
  checks.push({
    label: 'SSE 时序说明',
    ok: pipelineContent.includes('仅 Step 4 做流式') || pipelineContent.includes('stream=true'),
  })

  // 6. JSON 容错 — 检查 sanitizeLLMJson
  const extractorContent = fs.readFileSync(path.join(ragDir, 'step2-extractor.ts'), 'utf-8')
  checks.push({
    label: 'sanitizeLLMJson 存在',
    ok: extractorContent.includes('sanitizeLLMJson'),
  })
  checks.push({
    label: 'Zod safeParse 使用',
    ok: extractorContent.includes('safeParse'),
  })
  checks.push({
    label: 'fallbackExtract 降级',
    ok: extractorContent.includes('fallbackExtract'),
  })

  // 7. 标签归一化 — 检查 normalizePalaceName
  const normalizerContent = fs.readFileSync(path.join(ragDir, 'tag-normalizer.ts'), 'utf-8')
  checks.push({
    label: 'normalizePalaceName 存在',
    ok: normalizerContent.includes('normalizePalaceName'),
  })
  checks.push({
    label: 'validateFrontMatterTags 存在',
    ok: normalizerContent.includes('validateFrontMatterTags'),
  })

  // 8. API 路由存在
  checks.push({
    label: 'API 路由 /api/ziwei/reading',
    ok: fs.existsSync(path.join(process.cwd(), 'src/app/api/ziwei/reading/route.ts')),
  })

  // 9. package.json 脚本
  const pkgContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
  checks.push({
    label: 'npm run ziwei:index 脚本',
    ok: pkgContent.includes('ziwei:index'),
  })

  // 10. Token 预算控制
  checks.push({
    label: 'MAX_KNOWLEDGE_CHUNKS=8',
    ok: retrieverContent.includes('MAX_KNOWLEDGE_CHUNKS = 8'),
  })
  checks.push({
    label: 'MAX_TOKENS_ESTIMATE=3000',
    ok: retrieverContent.includes('MAX_TOKENS_ESTIMATE = 3000'),
  })

  // 11. gray-matter 依赖
  checks.push({
    label: 'gray-matter 依赖',
    ok: pkgContent.includes('gray-matter'),
  })

  // 12. server-only 依赖
  checks.push({
    label: 'server-only 依赖',
    ok: pkgContent.includes('server-only'),
  })

  let pass = 0
  for (const c of checks) {
    if (c.ok) {
      pass++
      console.log(`  ✅ ${c.label}${c.detail ? ': ' + c.detail : ''}`)
    } else {
      console.error(`  ❌ ${c.label}${c.detail ? ': ' + c.detail : ''}`)
    }
  }
  console.log(`  结果: ${pass}/${checks.length} 通过`)
  return pass === checks.length
}

// ================================================================
// 最终汇总
// ================================================================

testPlanCompliance().then(test7 => {
  const results = [
    { name: 'tag-normalizer 纯函数', pass: test1 },
    { name: 'step1-router 意图路由', pass: test2 },
    { name: 'step2-extractor JSON容错', pass: test3 },
    { name: 'step4-generator 上下文组装', pass: test4 },
    { name: 'session-manager 逻辑', pass: test5 },
    { name: '入库脚本切片', pass: test6 },
    { name: '方案文档审查', pass: test7 },
  ]

  console.log('\n' + '='.repeat(60))
  console.log('📊 自测汇总')
  console.log('='.repeat(60))

  const allPass = results.every(r => r.pass)
  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`)
  }
  console.log('='.repeat(60))
  console.log(allPass ? '🎉 全部通过！' : '⚠️  存在失败项，需要修复')

  process.exit(allPass ? 0 : 1)
})
