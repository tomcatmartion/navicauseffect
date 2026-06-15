/**
 * 报告生成服务 — 基于紫微斗数理论生成报告
 *
 * 改造说明（原基于八字，现纯紫微）：
 *  - 数据源：ReportIR（排盘 + Stage1/2/3 硬计算的紫微结论），替代 identity.bazi 八字字符串
 *  - SYSTEM_PROMPT：纯紫微斗数理论，禁止八字术语
 *  - 模板 prompt：按报告主题映射紫微宫位/星曜/四化，禁用八字概念
 *
 * 流程：
 * 1. 接收 ReportIR（由 report-pipeline 排盘+Stage 计算得出）
 * 2. 将 IR 序列化为紫微数据文本（十二宫/星曜/四化/大限流年/事项结论）
 * 3. 按模板主题构建紫微导向 prompt
 * 4. 调用 callAI 生成 JSON 章节报告
 */
import { callAI } from '@/lib/ai/skill-callers'
import type { ReportIR } from './report-pipeline'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface GenerateReportInput {
  /** 紫微 IR（排盘 + Stage 结论） */
  ir: ReportIR
  templateSlug: string
  templateName: string
  extraInfo?: string
}

// ---------------------------------------------------------------------------
// 系统提示词（纯紫微斗数，禁八字）
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是一位资深紫微斗数分析师，兼具心理学视角。你的分析必须严格基于提供的紫微命盘数据，采用紫微斗数理论。

【必须遵守】
1. 严格依据数据中的宫位、星曜、四化、评分与等级，不得编造任何未在数据中出现的宫位、星曜或四化
2. 全程使用紫微斗数理论框架：
   - 十二宫：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、奴仆（交友）、官禄（事业）、田宅、福德、父母
   - 十四主星：紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军
   - 四化：化禄（财源顺畅）、化权（掌控执行）、化科（名声贵人）、化忌（阻碍执念）
   - 大限（十年运势）、流年（年运）、三方四正（对宫/三合/夹宫会照）
3. 引用具体宫位与星曜支撑每个观点，例如「你的夫妻宫坐天机太阴，主…」
4. 等级用语转换：吉旺→强旺，平→一般，凶弱→偏弱
5. 语言温暖、专业、有洞察力，避免宿命论；用「你」称呼命主
6. 适当给出可操作建议

【严禁】
- 严禁使用八字理论：四柱、年柱/月柱/日柱/时柱、十神（比肩/劫财/食神等）、大运（八字式）、纳音、用神、喜忌、日主旺衰等术语
- 严禁把「大限」说成「大运」（大限是紫微十年运，大运是八字术语）
- 严禁给出绝对化的吉凶判决或具体金额/死亡/离婚预测

输出格式：JSON，含 chapters 数组，每个 chapter 有 title 和 content。`

// ---------------------------------------------------------------------------
// IR 序列化为紫微数据文本
// ---------------------------------------------------------------------------

function buildIRText(ir: ReportIR): string {
  const cs = ir.chartSnapshot
  const lines: string[] = []

  // 命主基础
  lines.push('【命主信息】')
  lines.push(`姓名：${ir.identity.name}（${ir.identity.gender}）`)
  lines.push(`阳历：${cs.solarDate}　农历：${cs.lunarDate}`)
  lines.push(`生年干支：${cs.birthGanZhi}　生肖：${cs.zodiac}　五行局：${cs.fiveElementsClass}　命主：${cs.soul}　身主：${cs.body}`)

  // 性格三宫画像
  if (ir.personality) {
    lines.push('')
    lines.push('【性格三宫画像（Stage2 结论）】')
    if (ir.personality.overallTone) lines.push(`整体基调：${ir.personality.overallTone}`)
    if (ir.personality.synthesis) lines.push(ir.personality.synthesis)
    if (ir.personality.mingTags) lines.push(`命宫定性：${ir.personality.mingTags.summary}`)
    if (ir.personality.shenTags) lines.push(`身宫定性：${ir.personality.shenTags.summary}`)
    if (ir.personality.taiSuiTags) lines.push(`太岁宫定性：${ir.personality.taiSuiTags.summary}`)
  }

  // 紫微十二宫
  lines.push('')
  lines.push('【紫微十二宫（原局命盘）】')
  for (const p of cs.allPalaces) {
    const stars = p.majorStars.length ? p.majorStars.join('、') : '空宫'
    const minor = p.minorStars.length ? `；辅星：${p.minorStars.join('、')}` : ''
    const decadal = p.decadal ? `　[大限 ${p.decadal.gan}干 ${p.decadal.range}]` : ''
    const bodyMark = p.isBodyPalace ? '（身宫）' : ''
    lines.push(`${p.name}（${p.diZhi}）${bodyMark}：${stars}${minor}${decadal}`)
  }
  lines.push(`生年四化：${cs.sihuaText}`)

  // 事项紫微深化分析（三层十二宫规范数据 + governorBlock，须严格依据）
  if (ir.matters.length > 0) {
    lines.push('')
    lines.push('【事项紫微深化分析（三层十二宫规范数据 + 因果链 + 四化落宫，须严格依据）】')
    for (const m of ir.matters) {
      lines.push(`■ ${m.matterType}（主看宫位：${m.primaryPalace}，评分 ${m.primaryScore.toFixed(1)}）`)
      if (m.analysisSummary) {
        lines.push(`  原局底盘：${m.analysisSummary.innateBase}`)
        lines.push(`  大限走向：${m.analysisSummary.fortuneTrend}`)
        lines.push(`  流年引动：${m.analysisSummary.yearlyTrigger}`)
        lines.push(`  综合结论：${m.analysisSummary.compositeConclusion}`)
        lines.push(`  风险建议：${m.analysisSummary.riskAdvice}`)
      }
      // governorBlock 数据（保护状态/四维度/因果链/禄随忌走/应对策略）
      if (m.governorData) {
        const g = m.governorData
        lines.push(`  保护状态：${g.primaryAnalysis.protectionStatus}；四维度分析：${g.primaryAnalysis.fourDimensionResult}`)
        if (g.causalChain) lines.push(`  因果链：${g.causalChain}`)
        if (g.luluJiFlow.length) lines.push(`  禄随忌走：${g.luluJiFlow.join('；')}`)
        if (g.resilience?.strategy) lines.push(`  应对策略：${g.resilience.strategy}`)
      }
      // 三层十二宫规范数据（原局/大限/流年，含三方四正 + 四化 + 引动）
      if (m.matterSpec) {
        const spec = m.matterSpec
        lines.push(`  〔三层规范数据〕`)
        // 原局
        lines.push(`    原局·命宫：${spec.yuanJu.ming.majorStars}（${spec.yuanJu.ming.earthlyBranch}）评分${spec.yuanJu.ming.score}(${spec.yuanJu.ming.level})`)
        for (const p of spec.yuanJu.primary) {
          const tq = p.threeQuadrants
          lines.push(`    原局·事项宫${p.palaceName}：${p.majorStars} 评分${p.score}(${p.level})；对宫${tq.opposite.palaceName}(${tq.opposite.level})、三合${tq.firstTrine.palaceName}/${tq.secondTrine.palaceName}`)
        }
        // 大限
        lines.push(`    大限(${spec.daXian.ageRange})·命宫：${spec.daXian.ming.majorStars} 评分${spec.daXian.ming.score}(${spec.daXian.ming.level})`)
        for (const p of spec.daXian.primary) {
          lines.push(`    大限·事项宫${p.palaceName}：${p.majorStars} 评分${p.score}(${p.level})`)
        }
        lines.push(`    大限四化：${spec.daXian.sihua.list.map(s => `${s.type}${s.star}→${s.palace}`).join('、') || '无'}`)
        // 流年
        lines.push(`    流年(${spec.liuNian.year})·命宫：${spec.liuNian.ming.majorStars} 评分${spec.liuNian.ming.score}(${spec.liuNian.ming.level})`)
        lines.push(`    流年四化：${spec.liuNian.sihua.list.map(s => `${s.type}${s.star}→${s.palace}`).join('、') || '无'}`)
      }
      lines.push(`  综合评分：${m.compositeScore.toFixed(1)}/10（${m.scoreLabel}），方向矩阵：大限${m.directionMatrix[0]}·流年${m.directionMatrix[1]}`)
    }
  }

  // 结构化数据看板（程序生成，报告中以表格形式呈现，AI 解读须呼应）
  if (ir.dataPanel.palaceScores.length) {
    lines.push('')
    lines.push('【结构化数据看板（报告将以此数据生成可视化表格，你的解读须与这些数据一致）】')
    lines.push(`十二宫评分：${ir.dataPanel.palaceScores.map(p => `${p.palace}${p.finalScore}(${p.level})`).join('、')}`)
    if (ir.dataPanel.sihuaLanding.length) {
      lines.push(`四化落宫：${ir.dataPanel.sihuaLanding.map(s => `${s.layer}·${s.type}${s.star}→${s.palace}`).join('；')}`)
    }
    if (ir.dataPanel.patterns.length) {
      lines.push(`格局：${ir.dataPanel.patterns.map(p => `${p.name}(${p.level})`).join('、')}`)
    }
  }

  // 时间上下文
  lines.push('')
  lines.push('【时间上下文】')
  lines.push(`当前：${ir.timeContext.currentYear}年（流年天干：${ir.timeContext.liuNianGan}）`)
  if (ir.timeContext.currentDaXian) {
    const d = ir.timeContext.currentDaXian
    lines.push(`当前大限：第${d.index}大限（${d.ageRange}岁），大限命宫落在${d.mingPalaceName}`)
  }

  // 重点宫位提示
  lines.push('')
  lines.push(`【本报告分析重点】${ir.focusPalaces}`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 模板主题 → 紫微导向 prompt（8 个模板，全部紫微化）
// ---------------------------------------------------------------------------

const TEMPLATE_PROMPTS: Record<string, string> = {
  // ========== 体验区 ==========
  'talent-awakening': `请基于以上紫微命盘数据，生成一份「天赋觉醒计划」分析报告。

报告须围绕紫微宫位与星曜展开，结构（4-5章，约8000字）：
1. "天赋密码" — 依据命宫主星的赋性，解读命主的天赋底色（结合命宫星曜庙旺与四化）
2. "潜能地图" — 依据福德宫（兴趣潜能）与官禄宫（才能施展），识别隐藏才能
3. "职业基因" — 依据官禄宫主星与三方四正，分析最适合的职业方向
4. "觉醒指南" — 结合当前大限命宫，给出将天赋转化为优势的建议
5. "天赋守护" — 依据化忌落宫与煞星会照，指出阻碍因素与应对

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（2000-3000字）"}]}`,

  'love-atlas': `请基于以上紫微命盘数据，生成一份「爱情图鉴」分析报告。

报告须围绕紫微夫妻宫与桃花星展开，结构（4-5章，约7000字）：
1. "感情底色" — 依据夫妻宫主星与四化，解读命主的情感模式
2. "桃花解码" — 依据桃花星（红鸾/天喜/咸池/沐浴）落宫，分析异性缘
3. "正缘画像" — 依据夫妻宫星曜组合与对宫（官禄），描绘正缘特征
4. "相处之道" — 依据福德宫（情感需求）与命宫，分析感情优劣势
5. "爱情锦囊" — 结合当前大限夫妻宫引动，给出提升感情运的建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（1500-2500字")}]}`,

  'life-kline': `请基于以上紫微命盘数据，生成一份「人生K线图」运势分析报告。

报告须围绕大限（十年运）走势与流年节点展开，结构（4-5章，约9000字）：
1. "人生大盘" — 依据命宫与身宫主星，解读一生运势的基本格局
2. "十年大限" — 依据各宫位的大限范围与当前大限命宫，逐段分析十年走势
3. "流年关键节点" — 依据流年四化引动与流年命宫，分析未来几年转折点
4. "人生周期" — 依据财帛/官禄/夫妻宫的大限流转，分析各维度周期规律
5. "趋势研判" — 综合大限吉凶与流年方向矩阵，判断关键年份

注意：紫微称「大限」不称「大运」。

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（2000-3000字）"}]}`,

  // ========== 会员区 ==========
  'life-full-analysis': `请基于以上紫微命盘数据，生成一份「命书·人生命理通鉴」综合报告。

这是一份基于紫微斗数的全方位解读，须覆盖十二宫各维度，结构（8-10章，约30000字）：
1. "命盘总论" — 命宫主星与性格三宫（命/身/太岁）综合解读
2. "性格内观" — 依据性格三宫画像，分析深层性格与内在驱动力
3. "事业版图" — 依据官禄宫主星、四化与大限官禄引动
4. "财富密码" — 依据财帛宫主星、禄存与化禄落宫
5. "情感世界" — 依据夫妻宫与桃花星
6. "健康指南" — 依据疾厄宫主星与四化
7. "人际磁场" — 依据奴仆宫（交友）与迁移宫
8. "学业智慧" — 依据官禄宫与文昌文曲
9. "大限流年" — 各大限走势与流年关键点
10. "人生建议" — 综合十二宫与大限流年的建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（3000-4000字）"}]}`,

  'annual-fortune': `请基于以上紫微命盘数据，生成一份「运书·${new Date().getFullYear()}年度运势」分析报告。

报告须围绕流年四化引动与十二宫流年展开，结构（6-8章，约20000字）：
1. "年度总运" — 依据流年命宫主星与流年四化，概览全年运势
2. "事业运势" — 依据流年官禄宫引动与流年化权/化科
3. "财富运势" — 依据流年财帛宫与流年化禄/禄存
4. "感情运势" — 依据流年夫妻宫与桃花星引动
5. "健康运势" — 依据流年疾厄宫与流年化忌
6. "人际运势" — 依据流年迁移宫与奴仆宫
7. "月度指南" — 依据流月命宫流转（如数据有）
8. "年度锦囊" — 综合流年方向矩阵给出趋吉避凶建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（2500-3500字")}]}`,

  'compatibility-report': `请基于以上紫微命盘数据，生成一份「缘书·关系倾向报告」。

注意：此报告为命主单视角的关系倾向分析（非双人合盘）。结构（5-6章，约10000字）：
1. "缘起" — 依据命宫主星，分析命主的关系底色与缘分类型
2. "性格互补" — 依据夫妻宫星曜，分析最佳匹配的性格类型
3. "事业合作" — 依据奴仆宫（交友）与官禄宫，分析事业合作特征
4. "感情匹配" — 依据夫妻宫与对宫（官禄），分析感情匹配建议
5. "友情密码" — 依据迁移宫（外缘）与兄弟宫，分析社交友情
6. "相处之道" — 综合命宫、夫妻宫、迁移宫给出关系维护建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（1500-2500字）"}]}`,

  'lucky-tips': `请基于以上紫微命盘数据，生成一份「好运锦囊」开运指南。

报告须围绕紫微贵人星与禄存展开，结构（4-5章，约5000字）：
1. "幸运密码" — 依据命宫主星五行与宫位地支，推断幸运色/数字/方位
2. "贵人图谱" — 依据天魁/天钺（贵人星）与左辅/右弼落宫，分析贵人特征
3. "开运方位" — 依据禄存与天马落宫，分析有利方位
4. "时空密码" — 依据流年禄存与化禄落宫，分析有利时机
5. "锦囊妙计" — 综合命宫与大限，给出开运建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（1000-1500字）"}]}`,

  'academic': `请基于以上紫微命盘数据，生成一份「学业主题」分析报告。

报告须围绕官禄宫与文昌文曲展开，结构（4-5章，约6000字）：
1. "学习天赋" — 依据命宫主星，分析思维方式与学习能力
2. "文昌运势" — 依据文昌/文曲落宫与四化，分析学业运与考试运
3. "专业方向" — 依据官禄宫主星与三方四正，建议适合的专业
4. "进修指南" — 依据当前大限官禄引动，分析深造时机
5. "学业锦囊" — 提升学习效率的紫微建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（1200-1800字）"}]}`,

  'past-life': `请基于以上紫微命盘数据，生成一份「前世今生」灵性探索报告。

报告须围绕福德宫（业力）与命宫（灵魂底色）展开，结构（4-5章，约6000字）：
1. "灵魂印记" — 依据福德宫主星，解读灵魂特质与深层意识
2. "前世回溯" — 依据福德宫四化与煞星，推测可能的业力课题
3. "今生功课" — 依据命宫主星与太岁宫，分析今生需完成的生命课题
4. "灵魂缘分" — 依据夫妻宫与福德宫，分析缘分类型
5. "觉醒之路" — 依据当前大限福德引动，给出灵性成长建议

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容（1200-1800字")}]}`,
}

// ---------------------------------------------------------------------------
// 构建 user prompt
// ---------------------------------------------------------------------------

function buildUserPrompt(input: GenerateReportInput): string {
  const irText = buildIRText(input.ir)
  const extra = input.extraInfo?.trim() ? `\n\n【用户特别关注】${input.extraInfo.trim()}` : ''
  const tmpl = TEMPLATE_PROMPTS[input.templateSlug]

  if (tmpl) {
    return `${irText}${extra}\n\n${tmpl}`
  }
  // 通用模板（未在映射表中的模板）
  return `${irText}${extra}\n\n请基于以上紫微命盘数据，生成一份「${input.templateName}」紫微斗数分析报告。\n\n要求：严格依据紫微十二宫、星曜、四化、大限流年分析，4-5个章节，每章1500-2500字，语言温暖专业。\n\n返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容"}]}`
}

// ---------------------------------------------------------------------------
// 生成报告主函数
// ---------------------------------------------------------------------------

export async function generateReportContent(
  input: GenerateReportInput
): Promise<{ content: string; status: 'COMPLETED' | 'FAILED'; errorMessage?: string }> {
  try {
    const userPrompt = buildUserPrompt(input)

    const result = await callAI({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16384,
    })

    if (!result.content) {
      return { content: '', status: 'FAILED', errorMessage: 'AI 未返回任何内容' }
    }

    // 清理 AI 返回的 markdown 代码块包裹
    let cleaned = result.content.trim()
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
    cleaned = cleaned.trim()

    // 解析 chapters（AI 可能返回 {chapters} 或纯文本）
    let chapters: Array<{ title: string; content: string }>
    try {
      const parsed = JSON.parse(cleaned)
      chapters = Array.isArray(parsed.chapters) && parsed.chapters.length
        ? parsed.chapters
        : [{ title: input.templateName, content: cleaned }]
    } catch {
      chapters = [{ title: input.templateName, content: cleaned }]
    }
    // 双结构输出：dataPanel（程序生成的可视化数据看板）+ chapters（AI 解读）
    return {
      content: JSON.stringify({ dataPanel: input.ir.dataPanel, chapters }),
      status: 'COMPLETED',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误'
    console.error('[generateReportContent] 生成失败:', msg)
    return { content: '', status: 'FAILED', errorMessage: msg }
  }
}
