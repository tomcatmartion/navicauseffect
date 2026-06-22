/**
 * 报告生成服务 — 基于紫微斗数理论生成报告（与排盘页面同源 AI 链路）
 *
 * 改造要点（与排盘页面 stage3 governor 对齐）：
 *  - 不再使用自写 SYSTEM_PROMPT，改用 prompt-builder.getSystemPrompt()（含 SKILL 规范）
 *  - 主调用 prompt 注入 STAGE2_HINT（性格三宫框架），让 AI 用三宫框架解读性格
 *  - 模板特殊指令优先来自数据库 ReportTemplate.promptConfig，缺失时 fallback 到代码 TEMPLATE_INSTRUCTIONS
 *  - governor 预解析结果（每个 matterType 的 stage3 五阶段 AI 文本）作为 user message 注入
 *
 * 流程：
 * 1. 接收 ReportIR + matterAnalyses（governor 预解析结果）+ reportInstruction（模板特殊指令）
 * 2. 组装 5 段 messages：SystemPrompt + IR+dataPanel + STAGE2_HINT + reportInstruction + user
 * 3. callAI 生成 JSON 章节报告
 * 4. 输出 { dataPanel, chapters, matterAnalyses } 三段式结构
 */
import { callAI, type ChatMessage } from '@/lib/ai/skill-callers'
import { getSystemPrompt, STAGE2_HINT } from '@/core/llm-wrapper/prompt-builder'
import type { MatterType } from '@/core/types'
import type { ReportIR } from './report-pipeline'
// 模板特殊指令单一数据源（同时被 scripts/seed-template-prompt-config.ts 复用）
import { TEMPLATE_INSTRUCTIONS } from './template-instructions'

// re-export 保持向后兼容（外部若直接从 report-generator 引用 TEMPLATE_INSTRUCTIONS）
export { TEMPLATE_INSTRUCTIONS }

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface GenerateReportInput {
  /** 紫微 IR（排盘 + Stage 结论 + dataPanel） */
  ir: ReportIR
  templateSlug: string
  templateName: string
  extraInfo?: string
  /** 预解析的 stage3 governor 结果（每个 matterType 一条 AI 五阶段分析文本） */
  matterAnalyses: Array<{ matterType: MatterType; analysisText: string; degraded?: boolean }>
  /** 模板特殊指令（来自 DB.promptConfig 或代码 fallback TEMPLATE_INSTRUCTIONS） */
  reportInstruction: string
}

// ---------------------------------------------------------------------------
// 模板特殊指令（fallback 用；首选来自数据库 ReportTemplate.promptConfig）
// ---------------------------------------------------------------------------
// 说明：内容统一放在 ./template-instructions.ts，方便 seed 脚本独立 import。
// 数据库字段优先：调用方传入 reportInstruction 为 DB 值；为空时此处兜底。

/**
 * 获取模板特殊指令（DB → 代码 fallback）
 *
 * 调用方传入的 reportInstruction 若非空则用 DB 值；否则查代码 TEMPLATE_INSTRUCTIONS。
 */
export function resolveReportInstruction(templateSlug: string, dbInstruction?: string | null): string {
  if (dbInstruction && dbInstruction.trim()) return dbInstruction.trim()
  return TEMPLATE_INSTRUCTIONS[templateSlug] ?? `请基于以上紫微命盘数据与事项分析结论，生成一份紫微斗数分析报告。

要求：严格依据紫微十二宫、星曜、四化、大限流年分析，4-5个章节，每章1500-2500字，语言温暖专业。

返回 JSON：{"chapters": [{"title": "章节名", "content": "章节内容"}]}`
}

// ---------------------------------------------------------------------------
// IR 序列化为 system message（数据看板 JSON + 命盘快照）
// ---------------------------------------------------------------------------

function buildIRSystemMessage(ir: ReportIR): string {
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
    lines.push('【性格三宫画像（Stage2 硬计算结论）】')
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

  // 事项深化分析（governor 数据摘要 + 三层十二宫规范数据，作为数据参考）
  if (ir.matters.length > 0) {
    lines.push('')
    lines.push('【事项深化分析数据摘要（Stage3 硬计算结论，AI 须严格依据）】')
    for (const m of ir.matters) {
      lines.push(`■ ${m.matterType}（主看宫位：${m.primaryPalace}，评分 ${m.primaryScore.toFixed(1)}）`)
      if (m.analysisSummary) {
        lines.push(`  原局底盘：${m.analysisSummary.innateBase}`)
        lines.push(`  大限走向：${m.analysisSummary.fortuneTrend}`)
        lines.push(`  流年引动：${m.analysisSummary.yearlyTrigger}`)
        lines.push(`  综合结论：${m.analysisSummary.compositeConclusion}`)
        lines.push(`  风险建议：${m.analysisSummary.riskAdvice}`)
      }
      if (m.governorData) {
        const g = m.governorData
        lines.push(`  保护状态：${g.primaryAnalysis.protectionStatus}；四维度分析：${g.primaryAnalysis.fourDimensionResult}`)
        if (g.causalChain) lines.push(`  因果链：${g.causalChain}`)
        if (g.luluJiFlow.length) lines.push(`  禄随忌走：${g.luluJiFlow.join('；')}`)
        if (g.resilience?.strategy) lines.push(`  应对策略：${g.resilience.strategy}`)
      }
      lines.push(`  综合评分：${m.compositeScore.toFixed(1)}/10（${m.scoreLabel}），方向矩阵：大限${m.directionMatrix[0]}·流年${m.directionMatrix[1]}`)
    }
  }

  // 结构化数据看板（程序生成，AI 须呼应）
  if (ir.dataPanel.palaceScores.length) {
    lines.push('')
    lines.push('【结构化数据看板（程序生成，报告中将以表格呈现，AI 解读须与这些数据一致）】')
    lines.push(`十二宫评分：${ir.dataPanel.palaceScores.map(p => `${p.palace}${p.finalScore}(${p.level})`).join('、')}`)
    if (ir.dataPanel.sihuaLanding.length) {
      lines.push(`四化落宫：${ir.dataPanel.sihuaLanding.map(s => `${s.layer}·${s.type}${s.star}→${s.palace}`).join('；')}`)
    }
    if (ir.dataPanel.patterns.length) {
      lines.push(`格局：${ir.dataPanel.patterns.map(p => `${p.name}(${p.level})`).join('、')}`)
    }
    if (ir.dataPanel.daXianTimeline.length) {
      lines.push(`大限走势：${ir.dataPanel.daXianTimeline.map(d => `第${d.index}大限(${d.ageRange})${d.isCurrent ? '★当前' : ''}[${d.tone}]`).join('；')}`)
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
// 组装 messages（5 段：SystemPrompt + IR+dataPanel + STAGE2_HINT + reportInstruction + user）
// ---------------------------------------------------------------------------

export function buildReportMessages(input: GenerateReportInput): ChatMessage[] {
  const messages: ChatMessage[] = []

  // 1. System Prompt（含 SKILL 规范，来自 data/System Prompt.md）
  messages.push({
    role: 'system',
    content: getSystemPrompt(),
  })

  // 2. IR 数据 + 结构化数据看板（让 AI 严格依据）
  messages.push({
    role: 'system',
    content: `【计算结果 IR（紫微命盘 + Stage1/2/3 硬计算结论）】\n${buildIRSystemMessage(input.ir)}`,
  })

  // 3. STAGE2_HINT 性格三宫框架（让 AI 用三宫框架解读性格章节）
  messages.push({
    role: 'system',
    content: `【性格解读框架（必须遵守）】\n${STAGE2_HINT}`,
  })

  // 4. 模板特殊指令（报告级章节要求，来自 DB.promptConfig 或代码 fallback）
  messages.push({
    role: 'system',
    content: `【报告级特殊指令】\n${input.reportInstruction}`,
  })

  // 5. 用户消息：governor 预解析结果 + extraInfo
  const userParts: string[] = []
  if (input.matterAnalyses.length > 0) {
    userParts.push('【事项 AI 五阶段分析结论（Stage3 Governor 已解析，须作为权威依据融入报告）】')
    for (const m of input.matterAnalyses) {
      const tag = m.degraded ? '（程序降级摘要）' : ''
      userParts.push(`━━━ ${m.matterType}${tag} ━━━`)
      userParts.push(m.analysisText)
    }
  }
  if (input.extraInfo?.trim()) {
    userParts.push('')
    userParts.push(`【用户特别关注】${input.extraInfo.trim()}`)
  }
  userParts.push('')
  userParts.push('请综合以上数据与事项分析结论，按报告级特殊指令生成完整 JSON 报告。')

  messages.push({
    role: 'user',
    content: userParts.join('\n'),
  })

  return messages
}

// ---------------------------------------------------------------------------
// 生成报告主函数
// ---------------------------------------------------------------------------

export async function generateReportContent(
  input: GenerateReportInput
): Promise<{ content: string; status: 'COMPLETED' | 'FAILED'; errorMessage?: string }> {
  try {
    const messages = buildReportMessages(input)

    const result = await callAI({
      messages,
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

    // 三段式输出：dataPanel（程序可视化）+ chapters（AI 解读）+ matterAnalyses（governor 预解析）
    return {
      content: JSON.stringify({
        dataPanel: input.ir.dataPanel,
        chapters,
        matterAnalyses: input.matterAnalyses.map(m => ({
          matterType: m.matterType,
          degraded: m.degraded ?? false,
          preview: m.analysisText.slice(0, 200),
        })),
      }),
      status: 'COMPLETED',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误'
    console.error('[generateReportContent] 生成失败:', msg)
    return { content: '', status: 'FAILED', errorMessage: msg }
  }
}
