/**
 * M7: LLM 表达层 — Prompt 组装器
 *
 * 职责：接收 IR JSON + 知识片段 + 词令模板，组装完整的 Prompt
 * 来源：TEMPLATE_词令prompt设计 V1.0
 */

import type { IR, IRStage1, IRStage2, IRStage3or4 } from '../types'
import { isIRStage1, isIRStage2, isIRStage3or4 } from './ir-schema'

// ═══════════════════════════════════════════════════════════════════
// System Prompt 模板
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `你是一位温暖、睿智、循循善诱的紫微斗数分析师，与用户的对话风格如同一位了解你、关心你的兄长——不是冷冰冰的问卷填写，而是像老朋友促膝长谈。

你的对话方式有以下几个特点：
1. 温暖有温度——用亲切自然的语气，让用户感觉被理解、被看见，而不是在被审问
2. 循循善诱——每次回应后自然带出下一个问题，让用户愿意主动说更多
3. 有回应有共鸣——用户说了什么，先给予回应和共鸣，再引导下一步
4. 引导而非索取——收集信息时要让用户感受到「说了更有帮助」
5. 分析有温度——输出结论时不是冷冰冰的判断，而是像一位真正关心你的人

【工作流程】
你的工作分为四个阶段，必须按顺序执行，不得跳步：
阶段一：宫位评分 — 收到命盘数据后处理
阶段二：性格定性＋事项问诊 — 评分完成后进行
阶段三：事项分析 — 识别事项类型后进行原局/大限/流年三层分析
阶段四：互动关系分析 — 收集对方生年后进行太岁入卦三维合参

【核心原则】
1. 望闻问切，先问后析
2. 命宫为轴——每层分析先看命宫再看事项宫
3. 原局结果一次性建立
4. 不做具体预测（不预测金额、时间、事件结果）
5. 不分析怀孕求子事项
6. 每次只问一个问题

【IR 数据说明】
你会收到系统计算好的 IR JSON 数据，这是确定性计算的结果，不可修改。你的任务是将这些结构化数据转化为有温度的自然语言。

【命盘速览输出约定 — 须遵守】
系统在「阶段一」注入的 IR 文本已固定包含以下块（顺序一致，便于你逐块引用）：
1. 「十二宫评分」：全宫一行一项，命宫条目会优先紧接在块首后出现。
2. 「格局」：JSON 格局引擎命中列表（可能为空）。
3. 「原局四化」：生年 + 太岁宫宫干四化条目。
4. 「特殊叠加」：双忌叠压、权忌交冲等（可能为空）。
5. 「父母信息」：有/无。
阶段二起会追加命宫/身宫/太岁宫标签与全息底色。阶段三/四的 IR 会以分块摘要呈现：主看宫、大限列表（含宫干与四化落位、是否当前限）、流年干与流年四化及窗口定性；请勿臆造未出现在 IR 中的大限/流年干支。

其他宫位细节仅在上述块中出现时才可引用；不得编造未给出的星曜或分数。`

// ═══════════════════════════════════════════════════════════════════
// 各阶段 Prompt 组装
// ═══════════════════════════════════════════════════════════════════

/**
 * 组装完整 Prompt
 *
 * @param ir IR 中间表示
 * @param knowledgeSnippets 知识片段（由编排层从知识字典查好注入）
 * @param userMessage 用户消息
 * @param stageHint 阶段提示（可选覆盖）
 */
export function buildPrompt(
  ir: IR,
  knowledgeSnippets: string[],
  userMessage: string,
  stageHint?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  // System prompt
  messages.push({
    role: 'system',
    content: SYSTEM_PROMPT,
  })

  // IR 数据注入
  const irContext = buildIRContext(ir)
  messages.push({
    role: 'system',
    content: `【计算结果 IR】\n${irContext}`,
  })

  // 知识片段注入
  if (knowledgeSnippets.length > 0) {
    messages.push({
      role: 'system',
      content: `【知识库片段】\n${knowledgeSnippets.join('\n\n')}`,
    })
  }

  // 阶段提示
  if (stageHint) {
    messages.push({
      role: 'system',
      content: `【当前阶段指令】\n${stageHint}`,
    })
  }

  // 用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  })

  return messages
}

/**
 * 将 IR 转为可读文本供 LLM 消费
 */
function buildIRContext(ir: IR): string {
  if (isIRStage1(ir)) {
    return buildStage1Context(ir)
  }
  if (isIRStage2(ir)) {
    return buildStage2Context(ir)
  }
  if (isIRStage3or4(ir)) {
    return buildStage3or4Context(ir)
  }
  return JSON.stringify(ir, null, 2)
}

function buildStage1Context(ir: IRStage1): string {
  const sorted = [...ir.palaceScores].sort((a, b) => b.finalScore - a.finalScore)
  const mingIdx = sorted.findIndex(p => p.palace === '命宫')
  const ordered = mingIdx > 0 ? [sorted[mingIdx]!, ...sorted.filter((_, i) => i !== mingIdx)] : sorted
  const scores = ordered
    .map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`)
    .join('\n')

  const patterns = ir.allPatterns
    .map(p => `${p.name}(${p.level})`)
    .join('、')

  const sihua = ir.mergedSihua.entries
    .map(e => `${e.type}${e.star}(${e.source})`)
    .join('；')

  const overlaps = ir.mergedSihua.specialOverlaps
    .map(o => `${o.type}: ${o.star}`)
    .join('；')

  return `阶段一：宫位评分结果
十二宫评分：
${scores}
格局：${patterns || '无'}
原局四化：${sihua}
特殊叠加：${overlaps || '无'}
父母信息：${ir.hasParentInfo ? '有' : '无'}`
}

function buildStage2Context(ir: IRStage2): string {
  return `阶段二：性格定性结果
命宫标签：${ir.mingGongTags.summary}
身宫标签：${ir.shenGongTags.summary}
太岁宫标签：${ir.taiSuiTags.summary}
整体基调：${ir.overallTone}
命宫全息底色：${ir.mingGongHolographic.summary}`
}

function buildStage3or4Context(ir: IRStage3or4): string {
  const p = ir.primaryAnalysis
  const decadalLines = ir.daXianAnalysis.map(d => {
    const cur = d.isCurrent ? '（当前大限）' : ''
    return `- 第${d.index}大限 ${d.ageRange}${cur}：宫干${d.daXianGan}；四化落位 ${d.sihuaPositions.join('、') || '—'}；定性 ${d.tone}`
  })
  const ln = ir.liuNianAnalysis
  const yearlyBlock = `- 流年干${ln.liuNianGan}；流年四化 ${ln.sihuaPositions.join('、') || '—'}；方向 ${ln.direction}；与大限关系 ${ln.daXianRelation}；时间窗口 ${ln.window}`

  return `阶段${ir.stage}：${ir.matterType}分析结果（摘要，非全量 JSON）
主看宫：${p.palace}
四维合参：${p.fourDimensionResult}
命宫调节：${p.mingGongRegulation}
格局保护：${p.protectionStatus}
先天层次：${p.innateLevel}
大限层：
${decadalLines.length ? decadalLines.join('\n') : '—'}
流年层：
${yearlyBlock}`
}

// ═══════════════════════════════════════════════════════════════════
// 阶段提示模板
// ═══════════════════════════════════════════════════════════════════

/** 阶段一提示 */
export const STAGE1_HINT = `你正在阶段一：宫位评分。
请以温暖的方式询问用户是否能提供父母生年，说明这对个性化评分的价值。
如果用户不提供，直接使用标准评分结果并告知。`

/** 阶段二提示 */
export const STAGE2_HINT = `你正在阶段二：性格定性+事项问诊。
先以有温度的方式呈现命主性格图谱（让用户有「被看见」的感受），
然后自然引导用户说出最想了解的方向。每次只问一个问题。`

/** 阶段三提示 */
export const STAGE3_HINT = `你正在阶段三：事项分析。
以聊天方式自然收集前提条件，再进行原局/大限/流年三层分析。
每层分析先看命宫状态再看事项宫状态。
结论要有温度，给出具体可感的建议。

【问诊信息抽取】
在生成分析报告时，请同时从对话上下文中提取以下问诊信息（如用户已提供），
并在回复末尾附上一段 JSON 格式的抽取结果：

问诊抽取字段（根据事项类型选取）：
- 求财：hasLabor(是否有劳力), hasPartner(是否有合伙), partnerBirthYear(合伙人生年), isRemote(是否异地), businessType(业务特点:劳力/销售)
- 求爱：loveType(自由/相亲), relationshipStage(寻找中/已有对象)
- 求学：isRemote(是否异地), isExam(是否备考)
- 求职：isSwitch(是否跳槽), needManage(是否管理岗), isRemote(是否异地)
- 求健康：isSpecific(是否具体症状)
- 求名：isOnline(是否网络传播)

格式示例（放在回复最后）：
【问诊抽取】
{"hasLabor": true, "hasPartner": true, "partnerBirthYear": 1985}

如无法提取任何信息，可省略此段。`

/** 阶段四提示 */
export const STAGE4_HINT = `你正在阶段四：互动关系分析。
收集对方生年后，进行太岁入卦三维合参分析。
分析入卦者维度、命主维度、时间维度，综合输出互动模式定性。
注意区分「可调整」「须谨慎」「不可调整」三种情况。`
