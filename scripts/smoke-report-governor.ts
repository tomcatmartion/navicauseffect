/**
 * 报告生成新链路直接冒烟（绕过 HTTP/认证）
 *
 * 直接调用内部函数链：
 *   buildReportContext → runReportGovernors → generateReportContent
 *
 * 验证：
 *  - governor 调用成功（每个 matterType 拿到 analysisText）
 *  - 主调用成功（chapters 数组）
 *  - 输出含 stage3 五阶段痕迹 + 性格三宫 + 紫微术语
 *
 * 运行：pnpm tsx scripts/smoke-report-governor.ts [template-slug] [identity-name]
 */
// Polyfill: 让 server-only 包在 tsx 直接运行时变成 noop（webpack 处理在 tsx 下不生效）。
// 必须在任何业务代码 import 之前执行，所以全用 require 风格。
const Module = require('module')
const origRequire = Module.prototype.require
Module.prototype.require = function (id: string) {
  if (id === 'server-only') return {}
  return origRequire.apply(this, arguments)
}

require('dotenv/config')
const { prisma } = require('../src/lib/db')
const { buildReportContext } = require('../src/core/report/report-pipeline')
const { runReportGovernors } = require('../src/core/report/report-governor-runner')
const { generateReportContent, resolveReportInstruction } = require('../src/core/report/report-generator')

async function main() {
  const slug = process.argv[2] || 'talent-awakening'
  const identityName = process.argv[3] || '张三'

  // 1. 查命主
  const identity = await prisma.identity.findFirst({
    where: { name: identityName },
    select: { id: true, name: true, gender: true, birthday: true, birthCity: true, region: true, bazi: true },
  })
  if (!identity) {
    console.log(`✗ 命主「${identityName}」不存在`)
    return
  }
  console.log(`命主：${identity.name}（${identity.birthday}）`)

  // 2. 查模板（拿 promptConfig）
  const template = await prisma.reportTemplate.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, promptConfig: true },
  })
  if (!template) {
    console.log(`✗ 模板「${slug}」不存在`)
    return
  }
  console.log(`模板：${template.name}（${template.slug}）`)
  console.log(`promptConfig 来源：${template.promptConfig ? 'DB' : '代码 fallback'}`)

  // 3. 构建 bundle（排盘 + stage1/2/3 + IR + dataPanel）
  console.log('\n构建 IR 中...')
  const t0 = Date.now()
  const bundle = buildReportContext({
    name: identity.name,
    gender: identity.gender,
    birthday: identity.birthday,
    birthCity: identity.birthCity,
    region: identity.region,
    bazi: identity.bazi,
  }, slug)
  console.log(`IR 构建耗时：${((Date.now() - t0) / 1000).toFixed(2)}s`)
  console.log(`matters: ${bundle.stage3List.map(m => m.matterType).join('、') || '（无）'}`)
  console.log(`dataPanel：palaceScores=${bundle.ir.dataPanel.palaceScores.length}, patterns=${bundle.ir.dataPanel.patterns.length}, sihua=${bundle.ir.dataPanel.sihuaLanding.length}`)

  // 4. Stage3 Governor 预解析
  console.log('\nStage3 Governor 并行预解析中（AI 调用）...')
  const t1 = Date.now()
  const governorResults = await runReportGovernors({
    stage1: bundle.stage1,
    stage2: bundle.stage2,
    stage3List: bundle.stage3List,
    chartData: bundle.chartData,
    targetYear: bundle.targetYear,
  })
  console.log(`Governor 总耗时：${((Date.now() - t1) / 1000).toFixed(2)}s`)
  for (const r of governorResults) {
    console.log(`  ${r.matterType}：${r.degraded ? '⚠ 降级' : '✓ AI 解析'}，${r.analysisText.length} 字`)
  }

  // 5. 主调用
  console.log('\n主调用 AI 生成报告章节中...')
  const t2 = Date.now()
  const reportInstruction = resolveReportInstruction(slug, template.promptConfig)
  const genResult = await generateReportContent({
    ir: bundle.ir,
    templateSlug: slug,
    templateName: template.name,
    matterAnalyses: governorResults.map(r => ({
      matterType: r.matterType,
      analysisText: r.analysisText,
      degraded: r.degraded,
    })),
    reportInstruction,
  })
  console.log(`主调用耗时：${((Date.now() - t2) / 1000).toFixed(2)}s`)
  console.log(`状态：${genResult.status}`)
  if (genResult.errorMessage) {
    console.log(`错误：${genResult.errorMessage}`)
    return
  }

  // 6. 解析输出
  let contentText = ''
  let chapters: Array<{ title: string; content: string }> = []
  let matterAnalysesEcho: Array<{ matterType: string; degraded: boolean; preview: string }> = []
  try {
    const parsed = JSON.parse(genResult.content!) as {
      dataPanel: unknown
      chapters: typeof chapters
      matterAnalyses: typeof matterAnalysesEcho
    }
    chapters = parsed.chapters ?? []
    matterAnalysesEcho = parsed.matterAnalyses ?? []
    contentText = chapters.map(c => `${c.title}\n${c.content}`).join('\n\n')
  } catch (e) {
    console.log('✗ 输出 JSON 解析失败:', e)
    return
  }

  console.log(`\n═══ 报告章节（共 ${chapters.length} 章，${contentText.length} 字）═══`)
  console.log(chapters.map((c, i) => `${i + 1}. ${c.title}（${c.content.length}字）`).join('\n'))

  console.log(`\n═══ matterAnalyses 回声（${matterAnalysesEcho.length} 条）═══`)
  for (const m of matterAnalysesEcho) {
    console.log(`  ${m.matterType}：${m.degraded ? '降级' : 'AI'} → ${m.preview.slice(0, 80)}...`)
  }

  // 7. 术语验证
  const stage3Keywords = ['原局', '大限', '流年', '综合结论']
  const stage3Hits = stage3Keywords.filter(t => contentText.includes(t))
  console.log(`\n═══ 五阶段痕迹（${stage3Hits.length}/${stage3Keywords.length}）═══`)
  console.log(stage3Hits.length === stage3Keywords.length
    ? `✓ 全部命中：${stage3Hits.join('、')}`
    : `△ 缺失：${stage3Keywords.filter(t => !stage3Hits.includes(t)).join('、')}`)

  const personalityKeywords = ['命宫', '身宫', '太岁']
  const personalityHits = personalityKeywords.filter(t => contentText.includes(t))
  console.log(`性格三宫提及：${personalityHits.join('、') || '（无）'}`)

  // 八字污染检查
  const baziTerms = ['十神', '比肩', '劫财', '食神', '伤官', '大运', '用神', '纳音']
  const baziHits = baziTerms.filter(t => contentText.includes(t))
  console.log(baziHits.length ? `⚠ 含八字术语：${baziHits.join('、')}` : `✓ 无八字术语污染`)

  console.log(`\n═══ 总耗时 ${((Date.now() - t0) / 1000).toFixed(2)}s ═══`)
  console.log(stage3Hits.length === stage3Keywords.length && baziHits.length === 0
    ? '✓✓ 新链路验证通过'
    : '△ 需人工复核')
}

main()
  .catch(e => { console.error('异常:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
