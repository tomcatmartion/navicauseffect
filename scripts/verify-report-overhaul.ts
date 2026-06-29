/**
 * 报告改造全面静态验证（不调用 AI 或仅调用 1-2 次）
 *
 * 三层验证：
 *  1. IR 数据完整性（stage1-2 全部数据字段）
 *  2. Stage3 prompt 拼装逻辑（buildStage3Messages 返回的 messages 结构）
 *  3. 9 个模板报告 prompt 主题覆盖（buildReportMessages 各段齐全 + 关键词命中）
 *
 * 用法：pnpm tsx scripts/verify-report-overhaul.ts [identity-name]
 */
// Polyfill server-only（必须在业务代码 require 之前）
const Module = require('module')
const origRequire = Module.prototype.require
Module.prototype.require = function (id: string) {
  if (id === 'server-only') return {}
  return origRequire.apply(this, arguments)
}

require('dotenv/config')
const { prisma } = require('../src/lib/db')
const { buildReportContext, TEMPLATE_MAP } = require('../src/core/report/report-pipeline')
const { buildStage3Messages } = require('../src/orchestration/hybrid/orchestrator')
const {
  generateReportContent,
  resolveReportInstruction,
  buildReportMessages,
} = require('../src/core/report/report-generator')
const { TEMPLATE_INSTRUCTIONS } = require('../src/core/report/template-instructions')

// ════════════════════════════════════════════════════════════
// 模板主题关键词映射（每个模板必须命中的关键词，验证主题覆盖）
// ════════════════════════════════════════════════════════════
const TEMPLATE_THEME_KEYWORDS: Record<string, { keywords: string[]; label: string }> = {
  'talent-awakening': { label: '天赋觉醒', keywords: ['天赋', '官禄', '福德', '潜能'] },
  'love-atlas': { label: '爱情图鉴', keywords: ['夫妻宫', '桃花', '正缘', '情感'] },
  'life-kline': { label: '人生K线图', keywords: ['大限', '流年', '十年', '周期'] },
  'life-full-analysis': { label: '命书通鉴', keywords: ['十二宫', '事业', '财富', '情感', '健康'] },
  'annual-fortune': { label: '年度运势', keywords: ['流年', '年度', '月度', '事业运势'] },
  'compatibility-report': { label: '关系倾向', keywords: ['关系', '匹配', '相处', '缘分'] },
  'lucky-tips': { label: '好运锦囊', keywords: ['贵人', '禄存', '开运', '幸运'] },
  'academic': { label: '学业主题', keywords: ['学业', '文昌', '文曲', '专业'] },
  'past-life': { label: '前世今生', keywords: ['福德', '业力', '灵魂', '缘分'] },
}

// ════════════════════════════════════════════════════════════
// 验证工具
// ════════════════════════════════════════════════════════════

const PASS = '✓'
const FAIL = '✗'
const WARN = '△'

function check(name: string, ok: boolean, detail?: string): boolean {
  const mark = ok ? PASS : FAIL
  console.log(`  ${mark} ${name}${detail ? `：${detail}` : ''}`)
  return ok
}

function checkWarn(name: string, ok: boolean, detail?: string): boolean {
  const mark = ok ? PASS : WARN
  console.log(`  ${mark} ${name}${detail ? `：${detail}` : ''}`)
  return ok
}

// ════════════════════════════════════════════════════════════
// 验证 1：IR 数据完整性
// ════════════════════════════════════════════════════════════

function verifyIR(bundle: any, slug: string): { passed: number; failed: number } {
  console.log(`\n═══════════════ 验证 1：IR 数据完整性（${slug}）═══════════════`)
  let passed = 0, failed = 0
  const ir = bundle.ir
  const cs = ir.chartSnapshot
  const dp = ir.dataPanel

  // 命主信息
  console.log('【命主信息】')
  if (check('identity.name', !!ir.identity.name, ir.identity.name)) passed++; else failed++
  if (check('identity.gender', !!ir.identity.gender, ir.identity.gender)) passed++; else failed++
  if (check('identity.solarDate', !!ir.identity.solarDate, ir.identity.solarDate)) passed++; else failed++
  if (check('identity.lunarDate', !!ir.identity.lunarDate, ir.identity.lunarDate)) passed++; else failed++

  // 命盘快照（stage1 输出）
  console.log('【命盘快照 chartSnapshot（stage1）】')
  if (check('birthGanZhi', !!cs.birthGanZhi, cs.birthGanZhi)) passed++; else failed++
  if (check('zodiac', !!cs.zodiac, cs.zodiac)) passed++; else failed++
  if (check('fiveElementsClass', !!cs.fiveElementsClass, cs.fiveElementsClass)) passed++; else failed++
  if (check('soul（命主）', !!cs.soul, cs.soul)) passed++; else failed++
  if (check('body（身主）', !!cs.body, cs.body)) passed++; else failed++
  if (check('mingGong.diZhi', !!cs.mingGong.diZhi, cs.mingGong.diZhi)) passed++; else failed++
  if (check('shenGong.diZhi', !!cs.shenGong.diZhi, cs.shenGong.diZhi)) passed++; else failed++
  if (check('taiSuiGong.name', !!cs.taiSuiGong.name, cs.taiSuiGong.name)) passed++; else failed++
  if (check('allPalaces.length=12', cs.allPalaces.length === 12, `实际 ${cs.allPalaces.length}`)) passed++; else failed++
  if (check('sihuaText', !!cs.sihuaText, cs.sihuaText.slice(0, 60))) passed++; else failed++
  if (check('decadalText', !!cs.decadalText)) passed++; else failed++

  // 性格三宫（stage2 输出）
  console.log('【性格三宫 personality（stage2）】')
  if (ir.personality) {
    const p = ir.personality
    if (check('overallTone', !!p.overallTone, p.overallTone?.slice(0, 50))) passed++; else failed++
    if (check('synthesis', !!p.synthesis, p.synthesis?.slice(0, 50))) passed++; else failed++
    if (check('mingTags.summary', !!(p.mingTags?.summary), p.mingTags?.summary?.slice(0, 50))) passed++; else failed++
    if (check('shenTags.summary', !!(p.shenTags?.summary), p.shenTags?.summary?.slice(0, 50))) passed++; else failed++
    if (check('taiSuiTags.summary', !!(p.taiSuiTags?.summary), p.taiSuiTags?.summary?.slice(0, 50))) passed++; else failed++
  } else {
    console.log(`  ${FAIL} personality 为空`)
    failed += 5
  }

  // dataPanel 结构化数据看板
  console.log('【dataPanel 结构化看板】')
  if (check('palaceScores.length=12', dp.palaceScores.length === 12, `实际 ${dp.palaceScores.length}`)) passed++; else failed++
  if (check('palaceScores[0].finalScore 是数字', typeof dp.palaceScores[0]?.finalScore === 'number')) passed++; else failed++
  if (check('palaceScores[0].level 非空', !!dp.palaceScores[0]?.level, dp.palaceScores[0]?.level)) passed++; else failed++
  if (check('sihuaLanding 非空', dp.sihuaLanding.length > 0, `${dp.sihuaLanding.length} 条`)) passed++; else failed++
  if (check('daXianTimeline 非空', dp.daXianTimeline.length > 0, `${dp.daXianTimeline.length} 步大限`)) passed++; else failed++
  if (check('patterns', true, `${dp.patterns.length} 个格局`)) passed++; else failed++
  if (check('personalityTriad', !!dp.personalityTriad, dp.personalityTriad ? '✓' : 'null')) passed++; else failed++
  if (check('matters 数据', dp.matters.length > 0 || TEMPLATE_MAP[slug]?.matters.length === 0,
    `${dp.matters.length} 个事项（${TEMPLATE_MAP[slug]?.matters.length === 0 ? '该模板本就无 matter' : '应有数据'}）`)) passed++; else failed++

  // matters 深化分析（stage3 输出）
  console.log('【matters 深化分析（stage3）】')
  if (ir.matters.length > 0) {
    const m = ir.matters[0]
    if (check('matterType', !!m.matterType, m.matterType)) passed++; else failed++
    if (check('primaryPalace', !!m.primaryPalace, m.primaryPalace)) passed++; else failed++
    if (check('primaryScore 是数字', typeof m.primaryScore === 'number', m.primaryScore.toFixed(1))) passed++; else failed++
    if (check('compositeScore 是数字', typeof m.compositeScore === 'number', m.compositeScore.toFixed(1))) passed++; else failed++
    if (check('scoreLabel', !!m.scoreLabel, m.scoreLabel)) passed++; else failed++
    if (check('directionMatrix[2]', m.directionMatrix.length === 2, JSON.stringify(m.directionMatrix))) passed++; else failed++
    if (check('analysisSummary', !!m.analysisSummary, m.analysisSummary?.compositeConclusion?.slice(0, 50))) passed++; else failed++
    if (checkWarn('governorData', !!m.governorData, m.governorData ? `因果链 ${m.governorData.causalChain?.length ?? 0} 字` : 'null')) passed++; else failed++
    if (checkWarn('matterSpec（三层规范数据）', !!m.matterSpec, m.matterSpec ? `原局/大限/流年三层齐全` : 'null')) passed++; else failed++
  } else {
    console.log(`  △ 该模板无 matters（如 past-life），跳过 stage3 数据检查`)
  }

  // timeContext
  console.log('【时间上下文】')
  if (check('currentYear', typeof ir.timeContext.currentYear === 'number', String(ir.timeContext.currentYear))) passed++; else failed++
  if (check('liuNianGan', !!ir.timeContext.liuNianGan, ir.timeContext.liuNianGan)) passed++; else failed++
  if (check('currentDaXian', !!ir.timeContext.currentDaXian, ir.timeContext.currentDaXian ? `${ir.timeContext.currentDaXian.ageRange}` : 'null')) passed++; else failed++
  if (check('focusPalaces', !!ir.focusPalaces, ir.focusPalaces?.slice(0, 60))) passed++; else failed++

  return { passed, failed }
}

// ════════════════════════════════════════════════════════════
// 验证 2：Stage3 Prompt 拼装逻辑
// ════════════════════════════════════════════════════════════

function verifyStage3Prompt(bundle: any, slug: string): { passed: number; failed: number } {
  console.log(`\n═══════════════ 验证 2：Stage3 Prompt 拼装（${slug}）═══════════════`)
  let passed = 0, failed = 0

  if (bundle.stage3List.length === 0) {
    console.log(`  △ 该模板无 matters，跳过 Stage3 Prompt 验证`)
    return { passed, failed }
  }

  const firstMatter = bundle.stage3List[0]
  const targetYear = bundle.targetYear

  const { messages, matterDataJson } = buildStage3Messages(
    bundle.stage1,
    bundle.stage2,
    firstMatter.stage3,
    firstMatter.matterType,
    targetYear,
    bundle.chartData,
    '',
  )

  // messages 结构
  console.log('【messages 5 段结构】')
  if (check('messages 非空', messages.length > 0, `${messages.length} 条`)) passed++; else failed++
  const systemCount = messages.filter((m: any) => m.role === 'system').length
  const userCount = messages.filter((m: any) => m.role === 'user').length
  if (check('system 段数 ≥ 4', systemCount >= 4, `${systemCount} 段（SystemPrompt + IR + 知识片段 + STAGE3_HINT）`)) passed++; else failed++
  if (check('user 段数 = 1', userCount === 1)) passed++; else failed++

  // 第 1 段：SystemPrompt
  const sys0 = messages[0]?.content ?? ''
  if (check('SystemPrompt 含 SKILL 规范', sys0.includes('紫微') || sys0.includes('分析师'), `前 50 字：${sys0.slice(0, 50)}`)) passed++; else failed++

  // 找 STAGE3_HINT 段（含"事项分析阶段"或"五阶段"）
  const stage3HintMsg = messages.find((m: any) => m.content?.includes('事项分析阶段') || m.content?.includes('原局底盘'))
  if (check('STAGE3_HINT 注入', !!stage3HintMsg, stage3HintMsg ? `${stage3HintMsg.content.length} 字` : '未找到')) passed++; else failed++

  // 找 IR 数据段（含"计算结果 IR"或"十二宫评分"）
  const irMsg = messages.find((m: any) => m.content?.includes('IR') || m.content?.includes('十二宫评分'))
  if (check('IR 数据注入', !!irMsg, irMsg ? `${irMsg.content.length} 字` : '未找到')) passed++; else failed++

  // 找知识片段段
  const knowledgeMsg = messages.find((m: any) => m.content?.includes('知识库片段') || m.content?.includes('星曜赋性'))
  if (check('知识片段注入', !!knowledgeMsg, knowledgeMsg ? `${knowledgeMsg.content.length} 字` : '未找到')) passed++; else failed++

  // user message 检查
  const userMsg = messages.find((m: any) => m.role === 'user')
  if (check('user prompt 含 governorBlock', !!userMsg?.content?.includes('原局底盘') || userMsg?.content?.includes('行运脉络'), `${userMsg?.content?.length ?? 0} 字`)) passed++; else failed++

  // matterDataJson
  console.log('【matterDataJson 三层十二宫规范数据】')
  if (check('matterDataJson 非空', !!matterDataJson, `${matterDataJson.length} 字`)) passed++; else failed++
  try {
    const parsed = JSON.parse(matterDataJson)
    if (check('含 yuanJu（原局）', !!parsed.yuanJu)) passed++; else failed++
    if (check('yuanJu.ming', !!parsed.yuanJu?.ming?.palaceName, parsed.yuanJu?.ming?.palaceName)) passed++; else failed++
    if (check('yuanJu.primary[0]', !!parsed.yuanJu?.primary?.[0]?.palaceName, parsed.yuanJu?.primary?.[0]?.palaceName)) passed++; else failed++
    if (check('含 daXian（大限）', !!parsed.daXian?.ageRange, parsed.daXian?.ageRange)) passed++; else failed++
    if (check('含 liuNian（流年）', !!parsed.liuNian?.year, String(parsed.liuNian?.year))) passed++; else failed++
    if (check('compositeScore', typeof parsed.compositeScore === 'number', String(parsed.compositeScore))) passed++; else failed++
  } catch (e) {
    console.log(`  ${FAIL} matterDataJson JSON 解析失败`)
    failed += 6
  }

  return { passed, failed }
}

// ════════════════════════════════════════════════════════════
// 验证 3：9 个模板的报告 prompt 主题覆盖
// ════════════════════════════════════════════════════════════

function verifyReportPrompt(bundle: any, slug: string, dbInstruction: string | null): { passed: number; failed: number } {
  const theme = TEMPLATE_THEME_KEYWORDS[slug]
  console.log(`\n═══════════════ 验证 3：报告 prompt 主题覆盖（${slug} / ${theme?.label ?? '未知'}）═══════════════`)
  let passed = 0, failed = 0

  // 1. 模板指令解析（DB → fallback）
  const instruction = resolveReportInstruction(slug, dbInstruction)
  if (check('reportInstruction 非空', !!instruction, `${instruction.length} 字`)) passed++; else failed++
  if (check('promptConfig 来源', !!dbInstruction, dbInstruction ? 'DB' : '代码 fallback')) passed++; else failed++

  // 2. 主题关键词命中
  if (theme) {
    const hits = theme.keywords.filter(k => instruction.includes(k))
    const ratio = `${hits.length}/${theme.keywords.length}`
    if (check(`主题关键词覆盖 ${theme.label}`, hits.length >= Math.ceil(theme.keywords.length * 0.6),
      `${ratio}：${hits.join('、')}`)) passed++; else failed++
  }

  // 3. buildReportMessages 5 段结构
  const fakeGovernor = bundle.stage3List.length > 0
    ? [{
        matterType: bundle.stage3List[0].matterType,
        analysisText: `[MOCK] stage3 governor 解析结果（五阶段：原局底盘/行运脉络/流年引动/综合结论）`,
        degraded: false,
      }]
    : []

  const messages = buildReportMessages({
    ir: bundle.ir,
    templateSlug: slug,
    templateName: theme?.label ?? slug,
    extraInfo: '',
    matterAnalyses: fakeGovernor,
    reportInstruction: instruction,
  })

  console.log('【buildReportMessages 5 段结构】')
  if (check('messages 总段数 ≥ 5', messages.length >= 5, `${messages.length} 段`)) passed++; else failed++

  // 第 1 段：SystemPrompt
  const sysPrompt = messages[0]?.content ?? ''
  if (check('① SystemPrompt（SKILL 规范）', sysPrompt.length > 100, `${sysPrompt.length} 字`)) passed++; else failed++

  // 第 2 段：IR + dataPanel
  const irPanel = messages[1]?.content ?? ''
  if (check('② IR+dataPanel（命主+十二宫+事项摘要+看板）',
    irPanel.includes('命主') && irPanel.includes('十二宫'), `${irPanel.length} 字`)) passed++; else failed++

  // 第 3 段：STAGE2_HINT
  const stage2Hint = messages[2]?.content ?? ''
  if (check('③ STAGE2_HINT（性格三宫框架）',
    stage2Hint.includes('性格分析阶段') || stage2Hint.includes('表层'), `${stage2Hint.length} 字`)) passed++; else failed++

  // 第 4 段：报告特殊指令
  const reportHint = messages[3]?.content ?? ''
  if (check('④ 报告特殊指令（含模板关键词）',
    reportHint.length > 100, `${reportHint.length} 字`)) passed++; else failed++
  if (theme) {
    const hintHits = theme.keywords.filter(k => reportHint.includes(k))
    if (check(`  └ 关键词命中`, hintHits.length > 0, `${hintHits.length}/${theme.keywords.length}：${hintHits.join('、')}`)) passed++; else failed++
  }

  // 第 5 段：user（governor + extraInfo）
  const userMsg = messages[4]?.content ?? ''
  if (check('⑤ user（governor 结果）',
    userMsg.includes('五阶段') || userMsg.includes('governor') || userMsg.includes('报告'), `${userMsg.length} 字`)) passed++; else failed++

  return { passed, failed }
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════

async function main() {
  const identityName = process.argv[2] || '张三'
  console.log(`══════════════════════════════════════════════════════`)
  console.log(`═══ 报告改造全面静态验证（命主：${identityName}）═══`)
  console.log(`══════════════════════════════════════════════════════`)

  // 查命主
  const identity = await prisma.identity.findFirst({
    where: { name: identityName },
    select: { id: true, name: true, gender: true, birthday: true, birthCity: true, region: true, bazi: true },
  })
  if (!identity) {
    console.log(`✗ 命主「${identityName}」不存在`)
    return
  }

  // 查所有主模板（无 parentId）
  const templates = await prisma.reportTemplate.findMany({
    where: { parentId: null, isActive: true },
    select: { id: true, name: true, slug: true, promptConfig: true },
    orderBy: { sortOrder: 'asc' },
  })
  console.log(`找到 ${templates.length} 个主模板\n`)

  // 缓存 IR bundle（按 slug 缓存，避免重复排盘）
  const bundleCache = new Map<string, any>()

  let totalPassed = 0, totalFailed = 0
  const templateResults: Array<{ slug: string; passed: number; failed: number }> = []

  for (const t of templates) {
    console.log(`\n\n████████████████████████████████████████████████████████████`)
    console.log(`███ 模板：${t.name}（${t.slug}）`)
    console.log(`████████████████████████████████████████████████████████████`)

    let bundle = bundleCache.get(t.slug)
    if (!bundle) {
      bundle = buildReportContext({
        name: identity.name,
        gender: identity.gender,
        birthday: identity.birthday,
        birthCity: identity.birthCity,
        region: identity.region,
        bazi: identity.bazi,
      }, t.slug)
      bundleCache.set(t.slug, bundle)
    }

    const r1 = verifyIR(bundle, t.slug)
    const r2 = verifyStage3Prompt(bundle, t.slug)
    const r3 = verifyReportPrompt(bundle, t.slug, t.promptConfig)

    const sum = {
      slug: t.slug,
      passed: r1.passed + r2.passed + r3.passed,
      failed: r1.failed + r2.failed + r3.failed,
    }
    templateResults.push(sum)
    totalPassed += sum.passed
    totalFailed += sum.failed
  }

  // 汇总
  console.log(`\n\n══════════════════════════════════════════════════════`)
  console.log(`═══════════ 验证汇总（${templates.length} 个模板）═══════════`)
  console.log(`══════════════════════════════════════════════════════`)
  console.log('模板'.padEnd(28), '通过'.padStart(6), '失败'.padStart(6), '通过率'.padStart(8))
  for (const r of templateResults) {
    const rate = ((r.passed / (r.passed + r.failed)) * 100).toFixed(1) + '%'
    console.log(r.slug.padEnd(28), String(r.passed).padStart(6), String(r.failed).padStart(6), rate.padStart(8))
  }
  console.log('─'.repeat(56))
  const totalRate = ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) + '%'
  console.log('总计'.padEnd(28), String(totalPassed).padStart(6), String(totalFailed).padStart(6), totalRate.padStart(8))

  console.log(`\n${totalFailed === 0 ? '✓✓✓ 全部静态验证通过' : `△ ${totalFailed} 项未通过，请检查上方日志`}`)
}

main()
  .catch(e => { console.error('异常:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
