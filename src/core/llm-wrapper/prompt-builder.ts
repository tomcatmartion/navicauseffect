/**
 * M7: LLM 表达层 — Prompt 组装器
 *
 * 职责：接收 IR JSON + 知识片段 + 词令模板，组装完整的 Prompt
 * 来源：data/prompt_templates.json（运行时配置）+ 代码内默认值（fallback）
 */

import type { IR, IRStage1, IRStage2, IRStage3or4 } from '../types'
import { isIRStage1, isIRStage2, isIRStage3or4 } from './ir-schema'
import { yearToGan, yearToZhi, yearToZodiac } from '../utils/gan-zhi'
import { loadPromptTemplates, type PromptTemplates } from './prompt-config-loader'

// ═══════════════════════════════════════════════════════════════════
// 默认值（当 JSON 加载失败时使用）
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = `你是一位温暖、睿智、循循善诱的紫微斗数分析师，与用户的对话风格如同一位了解你、关心你的兄长——不是冷冰冰的问卷填写，而是像老朋友促膝长谈。

你的对话方式有以下几个特点：
1. 温暖有温度——用亲切自然的语气，让用户感觉被理解、被看见，而不是在被审问。
2. 循循善诱——每次回应后自然带出下一个问题，让用户愿意主动说更多，不是一问一答的机械形式。
3. 有回应有共鸣——用户说了什么，先给予回应和共鸣，再引导下一步，不要冷漠地直接跳到下个问题。
4. 先分析，再引导——收到信息后必须先给出实质性分析，且性格解读要尽量详细（不少于150字），让用户感受到"说了对我有帮助"，然后再自然引导补充信息。
5. 引导而非索取——收集信息时要让用户感受到「说了更有帮助」，而不是「被强迫填表」。
6. 分析有温度——输出结论时不是冷冰冰的判断，而是像一位真正关心你的人在告诉你他看到了什么。

【核心工作流程】
- 第一阶段：原局性格解读（必做，且要详细）。
- 第二阶段：事项问诊与初步分析。
- 第三阶段：分层分析（原局+大限+流年）。
- 第四阶段：互动关系分析（与第三阶段并列，可直接触发）。

【核心工作原则】
- 先分析，后引导。
- 性格解读必须详细（不少于150字）。
- 命宫为轴——每一层分析都先看命宫状态，再看事项宫状态。
- 原局结果一次性建立，后续分支直接调用。
- 不做具体预测（不预测具体金额、具体时间、具体事件结果）。
- 不分析怀孕求子（温和拒绝）。

【知识库调用规则】
- 取象宫位含义：调用 KB_事项宫位知识库。
- 取象星曜赋性：调用 KB_星曜赋性与事项分类知识库。
- 读取四化：调用 SKILL_原局四化读取规则。

【禁止事项】
- 严禁只提问不分析。
- 严禁连续两轮以上只收集信息。
- 严禁一次抛出多个问题。
- 严禁用「请提供XXX」的填表语气。
- 严禁跳过用户回答直接进入下一个问题。
- 严禁输出冷冰冰的星曜术语堆砌。
- 严禁给出具体金额/时间/事件预测。
- 严禁分析怀孕求子事项。
- 严禁做关系最终结果的绝对判决。
- 严禁在结构性凶象时给出虚假希望。

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

其他宫位细节仅在上述块中出现时才可引用；不得编造未给出的星曜或分数。

【合参规则（必须遵守）】
- 分析大限命宫时，必须同时参考原局命宫的等级和星曜，说明十年心性是在原局基础上如何变化。
- 分析大限事项宫位时，必须结合大限命宫的强弱，判断十年心态是否有利于该事项。
- 分析流年命宫时，必须结合大限命宫的强弱，判断当年整体运势在大限背景下的位置。
- 分析流年事项宫位时，必须结合流年命宫的强弱，判断当年心态是否支持事项发展。
- 所有合参结论必须基于数据中的等级对比（吉旺>平>凶弱），不可凭空推断。
- 命宫强旺（吉旺）时，能压制其他宫位的煞星负面影响；命宫偏弱时，易被煞星拖累。

【分析规则】
- 等级映射：吉旺（得分≥6.0），平（4.5-5.9），凶弱（<4.5）。
- 四化引动效果：禄→结果/财源/顺畅度，权→控制力/执行力/机会，科→名声/贵人/条理，忌→阻碍/执念/风险。
- 流年方向判断：大限吉+流年吉→最佳推进窗口；大限吉+流年凶→谨慎推进；大限凶+流年吉→维持为主；大限凶+流年凶→预警规避。
- 对四化引动用「因为…所以…」的因果句式解释。
- 禁止给出具体金额、具体时间点（除流月外）、绝对预测。`

const DEFAULT_PHRASE_LIBRARY: Record<string, string> = {
  greeting: '好，我拿到你的命盘了。我先静下心来好好看看你的结构……',
  closing: '如果您还有其他问题，随时可以继续问我。',
  no_birth_year: '没关系，我们照样能看得很清楚。继续说你的性格——',
  no_partner_year: '没关系，这个不强求。不过如果有这个信息的话，我能帮你看到的东西会更具体。你要是之后想起来了，随时可以补给我。',
  ask_parent_year: '如果你愿意告诉我父母的生年，我可以把父母宫的影响也纳入评分，结果会更贴近你。',
  encourage_detail: '说得越具体，我能看到的东西就越有价值。',
}

const DEFAULT_STAGE_HINTS: Record<string, string> = {
  stage1: `你正在阶段一：宫位评分。
请以温暖的方式询问用户是否能提供父母生年，说明这对个性化评分的价值。
如果用户不提供，直接使用标准评分结果并告知。

开场白建议：「{greeting}」`,
  stage2: `你现在进入【性格分析阶段】。请基于以下【命盘速览】和【性格定性数据】，输出一段详细的性格描述（不少于150字），语气要像兄长一样温暖、有共鸣。之后自然引导用户说出想了解的方向。

核心要求：
1. 先分析，再引导——必须先给出实质性分析，让用户感受到"说了对我有帮助"。
2. 性格解读必须详细（不少于150字）。
3. 每次只问一个问题。
4. 严禁只提问不分析。`,
  stage3: `你现在进入【事项分析阶段】。事项类型已标注在 IR 中。请基于以下数据进行分析，给出有温度的建议。

【输出格式要求 — 必须遵守】
请按照以下章节顺序输出分析（用温暖自然的语言，不要生硬列数据）：

一、原局气场
- 命宫：主星、评分、等级，描述天性底色。
- 事项核心宫位：主星、评分、等级，以及三方四正（对宫、三合宫）的状态。
- 辅助宫位：简要列出相关宫位的等级。
- 原局总结：一句话概括先天事项气场。

二、大限十年走势
- 大限命宫 vs 原局命宫：说明十年心性在原局基础上如何变化。
- 大限事项宫 vs 大限命宫：判断十年心态是否有利于该事项。
- 四化引动：列出大限四化落宫及效果（用「因为…所以…」句式）。
- 十年趋势：根据原局事项等级 vs 大限事项等级得出大旺/小旺/小衰/大衰。

三、流年分析
- 重叠性验证：事项核心宫位与流年引动所作用宫位的重叠关系。
- 流年命宫 vs 大限命宫：判断当年整体运势。
- 流年事项宫 vs 流年命宫：判断当年心态是否支持事项发展。
- 方向判断：根据大限吉凶+流年吉凶给出时间窗口定性。
- 行动建议或结果解释（根据已发生/未发生模式选择）。

四、综合结论与建议
- 综合评分（仅未发生模式）：得分、档位。
- 核心结论：一句话总结。
- 具体建议：2-3条。
- 风险提示：根据化忌、凶弱宫位等给出。

【合参规则】
- 每层分析先看命宫状态再看事项宫状态。
- 所有合参结论必须基于数据中的等级对比（吉旺>平>凶弱），不可凭空推断。
- 对四化引动用「因为…所以…」的因果句式解释。

核心要求：
1. 严格基于数据中的事实，不得编造宫位、星曜、四化、分数、等级。
2. 分析时必须引用数据中的具体数值来支撑观点。
3. 使用平实、亲切的语言，多用「你」来称呼用户。
4. 不做具体预测（不预测金额、时间、事件结果）。

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

如无法提取任何信息，可省略此段。`,
  stage4: `你现在进入【互动关系分析阶段】。请基于以下入卦数据和互动分析结果，描述双方互动模式、核心张力点，并给出可调整的建议或风险预警。

核心要求：
1. 收集对方生年后，进行太岁入卦三维合参分析。
2. 分析入卦者维度、命主维度、时间维度，综合输出互动模式定性。
3. 注意区分「可调整」「须谨慎」「不可调整」三种情况。
4. 严禁做关系最终结果的绝对判决。
5. 严禁在结构性凶象时给出虚假希望。`,
}

const DEFAULT_USER_TEMPLATES: Record<string, string> = {
  stage2: `【命盘速览】
{chartSnapshot}

【性格定性数据】
{personalityData}

用户问题：{userQuestion}

请输出详细的性格分析。`,
  stage3: `【事项类型】{matter}
【主看宫位】{primaryPalace}（得分{primaryScore}，等级{brightness}）
【主星赋性】{starDescription}
【宫位描述】{eventDescription}
【行运分析】大限方向：{daXianDir}，流年方向：{liuNianDir}，时间窗口：{timeWindow}
【特殊条件】{specialConditions}

请生成分析报告。`,
  stage4: `【入卦数据分析】
{interactionData}
【核心张力点】{tension}
【可调整建议】{advice}

请输出互动关系分析。`,
}

// ═══════════════════════════════════════════════════════════════════
// 配置加载与缓存
// ═══════════════════════════════════════════════════════════════════

let cachedTemplates: PromptTemplates | null = null
let cacheTime = 0

function getTemplates(): PromptTemplates {
  const now = Date.now()
  // 简单内存缓存，5秒有效期
  if (cachedTemplates && now - cacheTime < 5000) {
    return cachedTemplates
  }
  cachedTemplates = loadPromptTemplates()
  cacheTime = now
  return cachedTemplates
}

/** 获取 System Prompt（从 JSON 或默认值） */
function getSystemPrompt(): string {
  const cfg = getTemplates()
  if (cfg.system_prompt) {
    const sp = cfg.system_prompt
    const lines: string[] = []
    if (sp.core_identity) lines.push(sp.core_identity, '')
    if (sp.dialogue_style?.length) {
      lines.push('你的对话方式有以下几个特点：')
      sp.dialogue_style.forEach((item, i) => lines.push(`${i + 1}. ${item}`))
      lines.push('')
    }
    if (sp.workflow?.length) {
      lines.push('【核心工作流程】')
      sp.workflow.forEach(item => lines.push(`- ${item}`))
      lines.push('')
    }
    if (sp.principles?.length) {
      lines.push('【核心工作原则】')
      sp.principles.forEach(item => lines.push(`- ${item}`))
      lines.push('')
    }
    if (sp.knowledge_rules?.length) {
      lines.push('【知识库调用规则】')
      sp.knowledge_rules.forEach(item => lines.push(`- ${item}`))
      lines.push('')
    }
    if (sp.forbidden_items?.length) {
      lines.push('【禁止事项】')
      sp.forbidden_items.forEach(item => lines.push(`- ${item}`))
      lines.push('')
    }
    if (sp.ir_data_note) lines.push(`【IR 数据说明】\n${sp.ir_data_note}`, '')
    if (sp.chart_snapshot_convention?.length) {
      lines.push('【命盘速览输出约定 — 须遵守】')
      sp.chart_snapshot_convention.forEach((item, i) => lines.push(`${i + 1}. ${item}`))
      lines.push('')
      lines.push('其他宫位细节仅在上述块中出现时才可引用；不得编造未给出的星曜或分数。')
    }
    const built = lines.join('\n').trim()
    if (built.length > 100) return built
  }
  return DEFAULT_SYSTEM_PROMPT
}

/** 获取短语库（从 JSON 或默认值） */
function getPhraseLibrary(): Record<string, string> {
  const cfg = getTemplates()
  if (cfg.phrase_library && Object.keys(cfg.phrase_library).length > 0) {
    return cfg.phrase_library as Record<string, string>
  }
  return DEFAULT_PHRASE_LIBRARY
}

/** 获取阶段提示（从 JSON 或默认值） */
function getStageHint(stage: string): string {
  const cfg = getTemplates()
  const hint = cfg.stage_hints?.[stage]
  if (hint?.content) {
    let content = hint.content
    // 替换占位符
    if (hint.required_placeholders?.includes('greeting')) {
      content = content.replace('{greeting}', getPhrase('greeting'))
    }
    return content
  }
  const defaultHint = DEFAULT_STAGE_HINTS[stage]
  if (defaultHint) {
    return defaultHint.replace('{greeting}', getPhrase('greeting'))
  }
  return ''
}

/** 获取用户 Prompt 模板（从 JSON 或默认值） */
function getUserTemplate(stage: string): string {
  const cfg = getTemplates()
  const tmpl = cfg.user_prompt_templates?.[stage]
  if (tmpl?.template) {
    return tmpl.template
  }
  return DEFAULT_USER_TEMPLATES[stage] || ''
}

// ═══════════════════════════════════════════════════════════════════
// 对外 API
// ═══════════════════════════════════════════════════════════════════

export function getPhrase(key: string, params?: Record<string, string>): string {
  const library = getPhraseLibrary()
  let phrase = library[key] || DEFAULT_PHRASE_LIBRARY[key] || ''
  if (params && phrase) {
    for (const [k, v] of Object.entries(params)) {
      phrase = phrase.replace(`{${k}}`, v)
    }
  }
  return phrase
}

/** 阶段一提示 */
export const STAGE1_HINT = getStageHint('stage1')
/** 阶段二提示 */
export const STAGE2_HINT = getStageHint('stage2')
/** 阶段三提示 */
export const STAGE3_HINT = getStageHint('stage3')
/** 阶段四提示 */
export const STAGE4_HINT = getStageHint('stage4')

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
    content: getSystemPrompt(),
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

  const flankingLines = ir.palaceScores
    .map(p => {
      const pairs = p.flankingPairs ?? []
      if (pairs.length === 0) return null
      const desc = pairs
        .map(fp => `${fp.displayName}[${fp.pairType}] ${fp.leftLabel}↔${fp.rightLabel} 衰减×${fp.decay.toFixed(2)}｜${fp.sameSourceLabel}`)
        .join('；')
      return `${p.palace}(${p.diZhi})：${desc}`
    })
    .filter(Boolean)
    .join('\n')

  return `阶段一：宫位评分结果

【命盘快照】
${formatChartSnapshot(ir.chartSnapshot)}

十二宫评分：
${scores}
格局：${patterns || '无'}
原局四化：${sihua}
特殊叠加：${overlaps || '无'}
夹宫成对（含同源判定）：
${flankingLines || '无'}
父母信息：${ir.hasParentInfo
    ? `父亲${ir.parentBirthYears?.father ? `${ir.parentBirthYears.father}年（${yearToZodiac(ir.parentBirthYears.father)}）生年干${yearToGan(ir.parentBirthYears.father)}太岁${yearToZhi(ir.parentBirthYears.father)}` : '未提供'}；母亲${ir.parentBirthYears?.mother ? `${ir.parentBirthYears.mother}年（${yearToZodiac(ir.parentBirthYears.mother)}）生年干${yearToGan(ir.parentBirthYears.mother)}太岁${yearToZhi(ir.parentBirthYears.mother)}` : '未提供'}`
    : '无'}`
}

function buildStage2Context(ir: IRStage2): string {
  const scores = ir.palaceScores
    .map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`)
    .join('\n')

  const patterns = ir.allPatterns
    .map(p => `${p.name}(${p.level})`)
    .join('、')

  const sihua = ir.mergedSihua.entries
    .map(e => `${e.type}${e.star}(${e.source})`)
    .join('；')

  return `阶段二：性格定性结果

【命盘快照】
${formatChartSnapshot(ir.chartSnapshot)}

十二宫评分：
${scores}
格局：${patterns || '无'}
原局四化：${sihua}

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

  const scores = ir.palaceScores
    .map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`)
    .join('\n')

  const patterns = ir.allPatterns
    .map(p => `${p.name}(${p.level})`)
    .join('、')

  const sihua = ir.mergedSihua.entries
    .map(e => `${e.type}${e.star}(${e.source})`)
    .join('；')

  return `阶段${ir.stage}：${ir.matterType}分析结果（摘要，非全量 JSON）

【命盘快照】
${formatChartSnapshot(ir.chartSnapshot)}

十二宫评分：
${scores}
格局：${patterns || '无'}
原局四化：${sihua}

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

function formatChartSnapshot(snapshot: import('../types').ChartSnapshot): string {
  const palaceLines = snapshot.allPalaces.map(p => {
    const major = p.majorStars.join('、') || '空'
    const minor = p.minorStars.join('、')
    const adj = p.adjectiveStars.join('、')
    const extra = [minor, adj].filter(Boolean).join('、')
    const bodyMark = p.isBodyPalace ? ' [身宫]' : ''
    return `  ${p.name.padStart(4)}(${p.diZhi}): ${major}${extra ? '；' + extra : ''}${bodyMark}`
  }).join('\n')

  return `命主信息：${snapshot.birthGanZhi}（${snapshot.zodiac}），${snapshot.fiveElementsClass}，命主${snapshot.soul}，身主${snapshot.body}
命宫(${snapshot.mingGong.diZhi})：${snapshot.mingGong.majorStars.join('、') || '空'}
身宫(${snapshot.shenGong.diZhi})：${snapshot.shenGong.majorStars.join('、') || '空'} [身宫]
太岁宫(${snapshot.taiSuiGong.diZhi})：${snapshot.taiSuiGong.majorStars.join('、') || '空'} → ${snapshot.taiSuiGong.name}
十二宫：
${palaceLines}
四化：${snapshot.sihuaText}
大限：${snapshot.decadalText.split('\n')[0] || '见详表'}`
}

// ═══════════════════════════════════════════════════════════════════
// 用户 Prompt 模板函数（从 JSON 加载模板）
// ═══════════════════════════════════════════════════════════════════

/**
 * 构建命盘快照对象（结构化数据，用于 IR）
 * @param chartData 前端序列化的命盘数据
 * @param ctx 生年干支（来自 scoringCtx，与 debug 面板「生年太岁」模块同源）
 */
export interface ChartSnapshotCtx {
  /** 生年天干（scoringCtx.birthGan） */
  birthGan?: string
  /** 太岁宫地支（scoringCtx.taiSuiZhi） */
  taiSuiZhi?: string
}

export function buildChartSnapshotObject(chartData: Record<string, unknown>, ctx?: ChartSnapshotCtx): import('../types').ChartSnapshot {
  const palaces = (chartData?.palaces as Array<Record<string, unknown>>) || []
  // 与 chart-pipeline-debug.ts「生年太岁」模块一致：全部从 scoringCtx 取值
  const birthGan = ctx?.birthGan ?? (chartData?.birthGan as string | undefined) ?? '未知'
  const birthZhi = ctx?.taiSuiZhi ?? (chartData?.taiSuiZhi as string | undefined) ?? '未知'

  // 命宫
  const ming = palaces.find(p => p.name === '命宫')
  // 身宫
  const shen = palaces.find(p => p.isBodyPalace)
  // 太岁宫
  const taiSui = birthZhi !== '未知' ? palaces.find(p => p.earthlyBranch === birthZhi) : undefined

  // 收集所有四化
  const allSihua: string[] = []
  for (const p of palaces) {
    const majorStars = (p.majorStars as Array<Record<string, unknown>>) || []
    const minorStars = (p.minorStars as Array<Record<string, unknown>>) || []
    for (const s of majorStars) {
      if (s.mutagen) allSihua.push(`${s.mutagen}${s.name}(${p.name})`)
    }
    for (const s of minorStars) {
      if (s.mutagen) allSihua.push(`${s.mutagen}${s.name}(${p.name})`)
    }
  }

  // 大限信息
  const decadalLines: string[] = []
  for (const p of palaces) {
    const decadal = p.decadal as { range: [number, number]; heavenlyStem: string } | undefined
    if (decadal && decadal.range[0] > 0) {
      decadalLines.push(`${p.name}(${p.earthlyBranch}): ${decadal.heavenlyStem}干，${decadal.range[0]}~${decadal.range[1]}岁`)
    }
  }

  // 农历日期
  const rawDates = chartData?.rawDates as Record<string, unknown> | undefined
  const lunarDate = rawDates?.lunarDate as Record<string, unknown> | undefined
  const lunarDateStr = lunarDate
    ? `${lunarDate.lunarYear}年${lunarDate.lunarMonth}月${lunarDate.lunarDay}日${lunarDate.isLeap ? '(闰)' : ''}`
    : '未知'

  return {
    birthGanZhi: birthGan + birthZhi,
    zodiac: (chartData?.zodiac as string | undefined) ?? '未知',
    fiveElementsClass: (chartData?.fiveElementsClass as string | undefined) ?? '未知',
    soul: (chartData?.soul as string | undefined) ?? '未知',
    body: (chartData?.body as string | undefined) ?? '未知',
    solarDate: (chartData?.solarDate as string | undefined) ?? '未知',
    lunarDate: lunarDateStr,
    mingGong: {
      name: (ming?.name as string) || '命宫',
      diZhi: (ming?.earthlyBranch as string) || '未知',
      majorStars: ((ming?.majorStars as Array<Record<string, unknown>>) || []).map(s => `${s.name}(${s.brightness})${s.mutagen ? `[${s.mutagen}]` : ''}`),
      minorStars: ((ming?.minorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
      adjectiveStars: ((ming?.adjectiveStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
    },
    shenGong: {
      name: (shen?.name as string) || '未知',
      diZhi: (shen?.earthlyBranch as string) || '未知',
      majorStars: ((shen?.majorStars as Array<Record<string, unknown>>) || []).map(s => `${s.name}(${s.brightness})${s.mutagen ? `[${s.mutagen}]` : ''}`),
      minorStars: ((shen?.minorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
      adjectiveStars: ((shen?.adjectiveStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
    },
    taiSuiGong: {
      name: (taiSui?.name as string) || '未知',
      diZhi: (taiSui?.earthlyBranch as string) || '未知',
      majorStars: ((taiSui?.majorStars as Array<Record<string, unknown>>) || []).map(s => `${s.name}(${s.brightness})${s.mutagen ? `[${s.mutagen}]` : ''}`),
      minorStars: ((taiSui?.minorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
      adjectiveStars: ((taiSui?.adjectiveStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
    },
    allPalaces: palaces.map(p => {
      const decadal = p.decadal as { range: [number, number]; heavenlyStem: string } | undefined
      return {
        name: (p.name as string) || '',
        diZhi: (p.earthlyBranch as string) || '',
        heavenlyStem: (p.heavenlyStem as string) || '',
        majorStars: ((p.majorStars as Array<Record<string, unknown>>) || []).map(s => `${s.name}(${s.brightness})${s.mutagen ? `[${s.mutagen}]` : ''}`),
        minorStars: ((p.minorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
        adjectiveStars: ((p.adjectiveStars as Array<Record<string, unknown>>) || []).map(s => s.name as string),
        isBodyPalace: !!p.isBodyPalace,
        decadal: decadal && decadal.range[0] > 0
          ? { gan: decadal.heavenlyStem, range: `${decadal.range[0]}~${decadal.range[1]}岁` }
          : undefined,
      }
    }),
    sihuaText: allSihua.join('、') || '无',
    decadalText: decadalLines.join('\n') || '无',
  }
}

/**
 * 构建命盘速览文本（用于阶段二性格分析）
 *
 * 从 chartData.palaces 中动态提取身宫和太岁宫，
 * 并输出完整的十二宫星曜表和四化信息，防止 AI 幻觉。
 */
export function buildChartSnapshot(chartData: {
  palaces: Array<{
    name: string
    earthlyBranch?: string
    heavenlyStem?: string
    majorStars?: Array<{ name?: string; brightness?: string; mutagen?: string }>
    minorStars?: Array<{ name?: string; brightness?: string; mutagen?: string }>
    adjectiveStars?: Array<{ name?: string; brightness?: string; mutagen?: string }>
    isBodyPalace?: boolean
    decadal?: { range: [number, number]; heavenlyStem: string; earthlyBranch: string }
  }>
  chineseDate?: string
  rawDates?: { chineseDate?: { yearly?: string[]; monthly?: string[]; daily?: string[]; hourly?: string[] }; lunarDate?: { lunarYear: number; lunarMonth: number; lunarDay: number; isLeap: boolean } }
  fiveElementsClass?: string
  soul?: string
  body?: string
  zodiac?: string
  solarDate?: string
}, ctx?: ChartSnapshotCtx): string {
  const snapshot = buildChartSnapshotObject(chartData as unknown as Record<string, unknown>, ctx)

  const palaceLines = snapshot.allPalaces.map(p => {
    const major = p.majorStars.join('、') || '空'
    const minor = p.minorStars.join('、')
    const adj = p.adjectiveStars.join('、')
    const extra = [minor, adj].filter(Boolean).join('、')
    const bodyMark = p.isBodyPalace ? ' [身宫]' : ''
    return `  ${p.name.padStart(4)}(${p.diZhi}): ${major}${extra ? '；' + extra : ''}${bodyMark}`
  }).join('\n')

  return `【命主信息】
阳历：${snapshot.solarDate}
农历：${snapshot.lunarDate}
生年干支：${snapshot.birthGanZhi}（生肖：${snapshot.zodiac}）
五行局：${snapshot.fiveElementsClass}
命主：${snapshot.soul}
身主：${snapshot.body}

【三宫定位】
命宫(${snapshot.mingGong.diZhi})：${snapshot.mingGong.majorStars.join('、') || '空'}
身宫(${snapshot.shenGong.diZhi})：${snapshot.shenGong.majorStars.join('、') || '空'} [身宫]
太岁宫(${snapshot.taiSuiGong.diZhi})：${snapshot.taiSuiGong.majorStars.join('、') || '空'}
【重要】太岁宫地支：${snapshot.taiSuiGong.diZhi}，对应宫位：${snapshot.taiSuiGong.name}

【十二宫星曜表】
${palaceLines}

【原局四化】
${snapshot.sihuaText}

【大限信息】
${snapshot.decadalText}

【约束】以上数据100%来自 iztro 排盘结果，是确定性数据，不可修改。分析时必须以这些数据为准，不得编造未列出的星曜或宫位信息。`
}

/**
 * 构建性格定性数据文本
 */
export function buildPersonalityData(stage2Output: {
  mingGongTags?: { summary: string }
  shenGongTags?: { summary: string }
  taiSuiTags?: { summary: string }
  overallTone?: string
  personalityTriad?: {
    synthesis?: string
    mingLayer?: { description: string }
    shenLayer?: { description: string }
    taiSuiLayer?: { description: string }
  }
}): string {
  const triad = stage2Output.personalityTriad
  const triadBlock = triad
    ? `\n【性格三宫 JSON 画像】\n命宫：${triad.mingLayer?.description ?? ''}\n身宫：${triad.shenLayer?.description ?? ''}\n太岁宫：${triad.taiSuiLayer?.description ?? ''}\n综合：${triad.synthesis ?? ''}`
    : ''
  return `命宫：${stage2Output.mingGongTags?.summary || '待分析'}
身宫：${stage2Output.shenGongTags?.summary || '待分析'}
太岁宫：${stage2Output.taiSuiTags?.summary || '待分析'}
整体基调：${stage2Output.overallTone || '待分析'}${triadBlock}`
}

/**
 * 通用模板填充函数
 */
function fillTemplate(template: string, params: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * 构建阶段二用户 Prompt（性格分析）
 */
export function buildStage2UserPrompt(
  chartSnapshot: string,
  personalityData: string,
  userQuestion: string,
): string {
  const tmpl = getUserTemplate('stage2')
  return fillTemplate(tmpl, { chartSnapshot, personalityData, userQuestion })
}

/**
 * 构建阶段三用户 Prompt（事项分析）
 */
export interface EventAnalysisGovernorParams {
  intent: string
  primaryPalaceData: string
  slimmedDescriptions: string
  causalChain: string
  luluJiFlow: string
  sihuaLandingDetail: string
  holographicBackground: string
  governorStrategy: string
  crisisSuffix: string
}

const DEFAULT_GOVERNOR_TEMPLATE = `【命理运算结果】
意图：{{INTENT}}
主看宫位：{{PRIMARY_PALACE_DATA}}
断语（整流）：
{{SLIMMED_DESCRIPTIONS}}
行运因果：{{CAUSAL_CHAIN}}
禄忌流转：{{LULU_JI_FLOW}}

【四化落宫明细】
{{SIHUA_LANDING_DETAIL}}

【性格底色】{{HOLOGRAPHIC_BACKGROUND}}

【咨询策略】{{GOVERNOR_STRATEGY}}

请以温暖兄长的口吻，基于以上结构化数据生成分析报告，不得臆造未给出的宫位或四化。{{CRISIS_SUFFIX}}`

/** 事项分析 governor 模板（来自 event_analysis.governor_template） */
export function buildEventAnalysisGovernorPrompt(params: EventAnalysisGovernorParams): string {
  const cfg = getTemplates()
  const tmpl = cfg.event_analysis?.governor_template ?? DEFAULT_GOVERNOR_TEMPLATE
  return tmpl
    .replace(/\{\{INTENT\}\}/g, params.intent)
    .replace(/\{\{PRIMARY_PALACE_DATA\}\}/g, params.primaryPalaceData)
    .replace(/\{\{SLIMMED_DESCRIPTIONS\}\}/g, params.slimmedDescriptions)
    .replace(/\{\{CAUSAL_CHAIN\}\}/g, params.causalChain)
    .replace(/\{\{LULU_JI_FLOW\}\}/g, params.luluJiFlow)
    .replace(/\{\{SIHUA_LANDING_DETAIL\}\}/g, params.sihuaLandingDetail)
    .replace(/\{\{HOLOGRAPHIC_BACKGROUND\}\}/g, params.holographicBackground)
    .replace(/\{\{GOVERNOR_STRATEGY\}\}/g, params.governorStrategy)
    .replace(/\{\{CRISIS_SUFFIX\}\}/g, params.crisisSuffix)
}

export function buildStage3UserPrompt(
  matter: string,
  primaryPalace: string,
  primaryScore: number,
  brightness: string,
  starDescription: string,
  eventDescription: string,
  daXianDir: string,
  liuNianDir: string,
  timeWindow: string,
  specialConditions: string,
  structuredAnalysis?: string,
  governorBlock?: string,
): string {
  const tmpl = getUserTemplate('stage3')
  const base = fillTemplate(tmpl, {
    matter,
    primaryPalace,
    primaryScore,
    brightness,
    starDescription,
    eventDescription,
    daXianDir,
    liuNianDir,
    timeWindow,
    specialConditions,
  })
  const blocks: string[] = [base]
  if (governorBlock?.trim()) {
    blocks.push(governorBlock.trim())
  }
  if (structuredAnalysis?.trim()) {
    blocks.push(`【限运合参结构化输出】\n${structuredAnalysis}`)
  }
  return blocks.join('\n\n')
}

/**
 * 构建阶段四用户 Prompt（互动关系）
 */
export function buildStage4UserPrompt(
  interactionData: string,
  tension: string,
  advice: string,
): string {
  const tmpl = getUserTemplate('stage4')
  return fillTemplate(tmpl, { interactionData, tension, advice })
}
