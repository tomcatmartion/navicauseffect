/**
 * M7: LLM 表达层 — Prompt 组装器（v2）
 *
 * 职责：接收 IR JSON + 知识片段 + 事项数据，组装完整的 Prompt
 * 来源：data/ziwei-chat-prompt.md + data/System Prompt.md + data/User Prompt.md
 *
 * 已废弃：data/prompt_templates.json（不再使用）
 */

import type { IR, IRStage1, IRStage2, IRStage3or4, MatterType, DaXianSummaryEntry, DaXianDetailForPrompt, PalaceName } from '../types'
import { isIRStage1, isIRStage2, isIRStage3or4 } from './ir-schema'
import { yearToGan, yearToZhi, yearToZodiac } from '../utils/gan-zhi'
import {
  loadSystemPrompt,
  loadUnifiedTemplate,
  type DataFormatPalace,
  type DataFormatSihuaEntry,
  type DataFormatTrigger,
} from './prompt-config-loader'

// ═══════════════════════════════════════════════════════════════════
// 缓存 — System Prompt（5秒有效期，避免频繁读磁盘）
// ═══════════════════════════════════════════════════════════════════

let cachedSystemPrompt: string | null = null
let systemPromptCacheTime = 0

export function getSystemPrompt(): string {
  const now = Date.now()
  if (cachedSystemPrompt && now - systemPromptCacheTime < 5000) {
    return cachedSystemPrompt
  }
  cachedSystemPrompt = loadSystemPrompt()
  systemPromptCacheTime = now
  // 如果加载失败（空字符串），使用统一模板中的系统角色部分
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = extractSystemSectionFromTemplate()
  }
  return cachedSystemPrompt || buildFallbackSystemPrompt()
}

/**
 * 从统一模板中提取系统角色定义区块（第二节到第五节）
 */
function extractSystemSectionFromTemplate(): string {
  const template = loadUnifiedTemplate()
  // 提取从「## 一、系统角色定义」到「## 六、数据格式说明」之间的内容
  const startMatch = template.match(/## 一、系统角色定义/)
  const endMatch = template.match(/## 六、数据格式说明/)
  if (startMatch?.index !== undefined && endMatch?.index !== undefined) {
    return template.slice(startMatch.index, endMatch.index).trim()
  }
  return ''
}

/**
 * Fallback — 当所有文件都加载失败时的最低限度 System Prompt
 */
function buildFallbackSystemPrompt(): string {
  return `你是一位温暖、睿智的紫微斗数分析师，与用户的对话风格如同一位了解你、关心你的兄长。

核心原则：
1. 严格基于数据中的事实，不得编造任何宫位、星曜、四化、分数、等级。
2. 分析时必须引用数据中的具体数值。
3. 使用平实、亲切的语言，多用"你"来称呼用户。
4. 对等级用语转化：吉旺→"强旺"，平→"一般"，凶弱→"偏弱"。
5. 对四化引动用"因为…所以…"的因果句式解释。
6. 禁止给出具体金额、具体时间点、绝对预测。

禁止事项：
- 严禁只提问不分析。
- 严禁连续两轮以上只收集信息。
- 严禁给出具体金额/时间/事件预测。
- 严禁分析怀孕求子事项。`
}

// ═══════════════════════════════════════════════════════════════════
// 短语库（直接在代码中定义，不再从 JSON 加载）
// ═══════════════════════════════════════════════════════════════════

const PHRASE_LIBRARY: Record<string, string> = {
  greeting: '好，我拿到你的命盘了。我先静下心来好好看看你的结构……',
  closing: '如果您还有其他问题，随时可以继续问我。',
  no_birth_year: '没关系，我们照样能看得很清楚。继续说你的性格——',
  no_partner_year: '没关系，这个不强求。不过如果有这个信息的话，我能帮你看到的东西会更具体。',
  ask_parent_year: '如果你愿意告诉我父母的生年，我可以把父母宫的影响也纳入评分，结果会更贴近你。',
  encourage_detail: '说得越具体，我能看到的东西就越有价值。',
}

export function getPhrase(key: string, params?: Record<string, string>): string {
  let phrase = PHRASE_LIBRARY[key] || ''
  if (params && phrase) {
    for (const [k, v] of Object.entries(params)) {
      phrase = phrase.replace(`{${k}}`, v)
    }
  }
  return phrase
}

// ═══════════════════════════════════════════════════════════════════
// 阶段提示（直接在代码中定义，不再从 JSON 加载）
// ═══════════════════════════════════════════════════════════════════

export const STAGE1_HINT = `你正在阶段一：宫位评分。
请以温暖的方式询问用户是否能提供父母生年，说明这对个性化评分的价值。
如果用户不提供，直接使用标准评分结果并告知。

开场白建议：「${PHRASE_LIBRARY.greeting}」`

export const STAGE2_HINT = `你现在进入【性格分析阶段】。请严格遵循以下三层递进结构：

1. 表层（命宫）：外在表现、第一印象、社交面具。早年即凸显，终身有影响。
2. 中层（身宫）：遇到问题时的实际应对手段和态度，是「真正的处理模式」。第三个大限（约25-35岁）开始比重逐渐增加。
3. 内核层（太岁宫，即生年支所在宫位）：天性根底、潜意识执念、最本源的驱动力。终身存在，越晚或压力越大时越暴露。

输出顺序：先表层，再中层，最后内核层，并合参说明三者是统一、互补还是矛盾。

【格局引用要求】
- 如果在命宫、身宫或太岁宫中触发了格局（特别是大吉/大凶格局），必须在对应层级分析中引用该格局的名称和简要描述，将其融入性格解读，让人物形象更丰满。
- 例如：命宫有「君臣庆会」大吉格局，可描述为"你天生具有领袖气质，善于统筹资源"；命宫有「孤君在野」中凶格局，可描述为"你内心常有孤独感，不轻易信任他人"。
- 格局信息会以 patterns 列表的形式提供，每个条目包含格局名称、等级和简要描述。

【同宫特殊情况】
- 命宫与身宫同宫：表层与中层高度重合，性情表里如一，遇到问题的反应就是外在表现。
- 身宫与太岁宫同宫：中层与内核层重合，应对方式直接来自天性驱动，非常一致但缺乏缓冲。
- 命宫与太岁宫同宫：表层与内核层重合，外在表现即天性，早年就很本色。

核心要求：
1. 先分析，再引导——必须先给出实质性分析，让用户感受到"说了对我有帮助"。
2. 性格解读必须详细（不少于150字）。
3. 每次只问一个问题。
4. 严禁只提问不分析。
5. 必须说明三宫的显现时机：命宫特质从小就明显；身宫特质约30岁后（第三大限）才逐渐凸显；太岁宫特质只在涉及核心利益或重大抉择时才爆发。避免让用户误以为所有特质当下完全体现。`

export const STAGE3_HINT = `你现在进入【事项分析阶段】。必须严格按照以下五阶段框架分析，不可跳过任何阶段。

═══ 阶段一：原局底盘分析 ═══
1. 命宫全息底色带入
   - 从性格定性数据中提取命宫强弱、原局四化方向、六吉六煞、性格底色
   - 这些信息统领后续所有宫位解读
2. 识别原局关键格局
   - 检查事项宫位是否存在护佑机制（双禄夹、禄存在宫、天府守财库等）
   - 空宫规则：事项宫位空宫→借对宫星曜论，吉象减半、凶象更凶
   - 护佑格局完整→凶限虽艰仍能全身而退；护佑格局破损→可能彻底崩盘
3. 事项宫位四维合参（必须按以下顺序分析）
   - 本宫：主星旺弱 + 所有星曜（四化/六吉/六煞），评估该宫本身能量等级
   - 对宫：判断是加强本宫还是制约本宫
   - 合宫：三合宫是强力后援还是侧翼受压
   - 临宫：左右邻宫夹制，是激励还是压制
   - 命宫调节：命强能驾驭凶象，命弱凶象直接穿透
4. 得出先天格局定性：强旺顺遂 / 中等有阻 / 虚浮困难 / 凶危高风险

═══ 阶段二：行运分析 ═══
1. 逐大限梳理（从第一大限到当下大限）
   - 每个大限：宫干四化落位 → 引动方向（吉化激活吉格 / 忌化激活凶象）
   - 标记事项宫位在每个大限中的激活或沉寂状态
2. 当下大限深析
   - 大限命宫×原局命宫合参：这十年命主心性如何变化
   - 大限四化完整落位：吉化激活什么，忌化激活什么
   - 大限事项宫四维：该事项在这十年的被激活程度
   - 检验护佑机制在大限中是否完整
3. 当下大限定性：顺畅期 / 艰辛期 / 危机期 / 转机期

═══ 阶段三：流年引动 ═══
1. 重叠性验证：流年引动所作用宫位与事项核心宫位的重叠程度（直接相关/间接不相关）
2. 流年命宫×大限命宫合参 → 定今年触发点
3. 流年四化落位 → 今年引动哪些宫位
4. 流年与大限方向判断（方向矩阵）
   - 吉◇吉 → 最佳推进窗口，主动出击
   - 吉◇凶 → 部分化解，谨慎推进
   - 凶◇吉 → 有波折干扰，维持为主
   - 凶◇凶 → 风险最高，预警规避
5. 确定时间窗口：推进窗口 / 蛰伏期 / 挑战期 / 风险期

═══ 阶段四：综合输出 ═══
三层合参（原局基础+大限走向+今年表现），输出：
- 综合结论（含综合分和等级）
- 核心观点（3条，必须引用具体数据）
- 调整建议（可调整的给出方向）或风险预警（不可调整的给出替代方案）

═══ 阶段五：深入追问与引导后续 ═══
分析完成后，先基于分析结果对用户做针对性的深入追问，再引导后续：
1. 根据分析中发现的吉凶关键点，提出1个具体的深入问题，帮助用户聚焦（例如：发现流年财帛宫凶弱，可问"你今年有没有特别注意某个大额支出或投资计划？"）。
2. 如果分析中涉及合伙、感情互动等，主动询问是否需要互动关系分析（"如果有合伙人的出生年份，我可以帮你看看你们的配合情况"）。
3. 如果分析中发现时间窗口（如"推进窗口"），提醒用户把握时机，并询问是否需要更细的流月分析。
4. 引导而非索取——每次只问一个问题，让用户感受到「说了更有帮助」而不是「被强迫填表」。

【格局引用要求】
- 在分析事项宫位及其相关宫位时，如果该宫位触发了格局（特别是大吉/大凶格局），必须引用该格局的名称和描述，将其融入事件解读中。
- 例如：求职时官禄宫有「君臣庆会」大吉格局，可解读为"你天生适合管理岗位，这次求职可以主动争取领导角色"；求财时财帛宫有「火贪横发」中吉格局，可解读为"你的财运有突然爆发的机会，但需要注意把握时机"。
- 格局信息会以 patterns 列表的形式提供。

【问诊信息收集（隐藏标记，用户不可见）】
如果你从对话中推断出以下信息，请在回复的最末尾用隐藏标记输出（用户不会看到这段内容）。
如果没有任何信息可提取，直接省略，不要输出空 JSON。

格式（放在回复最后，用 <memory_update> 标签包裹）：
<memory_update>{"routingAnswers": {"hasLabor": true, "hasPartner": true, "partnerBirthYear": 1985}}</memory_update>

各事项的抽取字段：
- 求财：hasLabor(是否有劳力), hasPartner(是否有合伙), partnerBirthYear(合伙人生年), isRemote(是否异地), businessType(业务特点:劳力/销售)
- 求爱：loveType(自由/相亲), relationshipStage(寻找中/已有对象)
- 求学：isRemote(是否异地), isExam(是否备考)
- 求职：isSwitch(是否跳槽), needManage(是否管理岗), isRemote(是否异地)
- 求健康：isSpecific(是否具体症状)
- 求名：isOnline(是否网络传播)

⚠️ 重要：这段标记不要让用户看到或感知到。如无法提取任何信息，完全省略，不要输出空值。

═══ 分析禁令（必须遵守）═══
⛔ 严禁跳过原局分析直接分析行运
⛔ 严禁只做原局不做行运（三层缺一不完整）
⛔ 严禁只做当下大限（必须从第一大限梳理到当下）
⛔ 严禁忽略大限宫干四化
⛔ 严禁忽略格局保护机制
⛔ 严禁只看单宫（必须四维合参）
⛔ 严禁以宫位旺衰直接判断（必须以命宫强弱为基准调节）
⛔ 严禁脱离命主性格底色

通用要求：
1. 以聊天方式自然收集前提条件，再进行三层分析。不可用「请提供XXX」的填表语气。
2. 每层分析先看命宫状态再看事项宫状态（合参规则）。
3. 严格基于数据事实，不得编造宫位、星曜、四化、分数、等级。
4. 分析时必须引用数据中的具体数值来支撑观点。
5. 使用平实、亲切的语言，多用「你」来称呼用户。
6. 不做具体预测（不预测金额、时间、事件结果）。
7. 对四化引动用「因为…所以…」的因果句式解释。
8. 结论要有温度，给出具体可感的建议。`

export const STAGE4_HINT = `你现在进入【互动关系分析阶段】。请基于以下入卦数据和互动分析结果，描述双方互动模式、核心张力点，并给出可调整的建议或风险预警。

核心要求：
1. 收集对方生年后，进行太岁入卦三维合参分析。
2. 分析入卦者维度、命主维度、时间维度，综合输出互动模式定性。
3. 注意区分「可调整」「须谨慎」「不可调整」三种情况。
4. 严禁做关系最终结果的绝对判决。
5. 严禁在结构性凶象时给出虚假希望。`

// ═══════════════════════════════════════════════════════════════════
// 核心函数：buildPrompt（组装完整 Prompt）
// ═══════════════════════════════════════════════════════════════════

/**
 * 组装完整 Prompt
 *
 * @param ir IR 中间表示
 * @param knowledgeSnippets 知识片段
 * @param userMessage 用户消息
 * @param stageHint 阶段提示
 */
export function buildPrompt(
  ir: IR,
  knowledgeSnippets: string[],
  userMessage: string,
  stageHint?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  // 1. System Prompt（来自 System Prompt.md）
  messages.push({
    role: 'system',
    content: getSystemPrompt(),
  })

  // 2. IR 数据注入
  const irContext = buildIRContext(ir)
  messages.push({
    role: 'system',
    content: `【计算结果 IR】\n${irContext}`,
  })

  // 3. 知识片段注入
  if (knowledgeSnippets.length > 0) {
    messages.push({
      role: 'system',
      content: `【知识库片段】\n${knowledgeSnippets.join('\n\n')}`,
    })
  }

  // 4. 阶段提示
  if (stageHint) {
    messages.push({
      role: 'system',
      content: `【当前阶段指令】\n${stageHint}`,
    })
  }

  // 5. 用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  })

  return messages
}

// ═══════════════════════════════════════════════════════════════════
// 核心函数：buildMatterAnalysisData
// 按「输出给大模型的数据格式.json」结构组装事项分析数据
// ═══════════════════════════════════════════════════════════════════

/** 事项分析数据（对应 输出给大模型的数据格式.json） */
export interface MatterAnalysisData {
  matterType: string
  mode: string
  targetYear: number
  currentYear: number
  yuanJu: {
    ming: DataFormatPalace
    primary: DataFormatPalace
    secondary: DataFormatPalace[]
    sihuaSummary: {
      shengNian: DataFormatSihuaEntry[]
      taiSui: DataFormatSihuaEntry[]
    }
  }
  daXian: {
    ageRange: string
    ming: DataFormatPalace
    primary: DataFormatPalace
    sihua: { list: DataFormatSihuaEntry[] }
    triggersToYuanJu: { list: DataFormatTrigger[] }
  }
  liuNian: {
    year: number
    ming: DataFormatPalace
    primary: DataFormatPalace
    sihua: { list: DataFormatSihuaEntry[] }
    luCun: { palace: string }
    triggersToDaXian: { list: DataFormatTrigger[] }
    overlap: {
      primaryPalace: string
      affectedPalaces: string[]
      isDirect: boolean
    }
  }
  compositeScore: number
  scoreLabel: string
}

/**
 * 从 Stage 输出中提取宫位评分和等级
 */
interface PalaceScoreEntry {
  palace: string
  diZhi: string
  finalScore: number
  tone: string
}

/**
 * 从 Stage3 输出构建按「输出给大模型的数据格式.json」格式的结构化数据
 */
export function buildMatterAnalysisData(params: {
  matterType: MatterType | string
  targetYear: number
  currentYear?: number
  mode?: string
  palaceScores: PalaceScoreEntry[]
  mergedSihua: { entries: Array<{ type: string; star: string; source: string }>; specialOverlaps: Array<{ type: string; star: string }> }
  stage3: {
    primaryAnalysis: { palace: string; innateLevel: string; fourDimensionResult: string; mingGongRegulation: string; protectionStatus: string }
    allDaXianMappings: Array<{
      index: number
      ageRange: [number, number]
      daXianGan: string
      mutagen: string[]
      mingPalaceName?: string
      palaceIndex?: number
    }>
    currentDaXianMapping?: { index: number; ageRange: [number, number]; daXianGan: string; mutagen?: string[]; mingPalaceName?: string }
    currentDaXianQualitative?: string
    liuNianSihuaPositions?: string[]
    directionMatrix: string
    directionWindow: string
    compositeScore?: number
    scoreLabel?: string
    scoreAction?: string
    sihuaLandingReport?: {
      layers: Array<{
        layer: string
        stemLabel: string
        direction: string
        layerScore: number
        rows: Array<{
          sihuaType: string
          star: string
          palace: string | null
          inMatterFocus: boolean
          hitsOppositeOfFocus: boolean
          palaceQuality: string
        }>
      }>
    }
    analysisSummary?: {
      innateBase: string
      fortuneTrend: string
      yearlyTrigger: string
      compositeConclusion: string
      riskAdvice: string
    }
  }
  chartData: Record<string, unknown>
  primaryPalaceName: string
}): MatterAnalysisData {
  const {
    matterType, targetYear, palaceScores, mergedSihua, stage3, primaryPalaceName,
  } = params
  const currentYear = params.currentYear ?? new Date().getFullYear()
  const mode = params.mode ?? '未发生'

  // 辅助：查找宫位评分
  const findPalace = (name: string): PalaceScoreEntry | undefined =>
    palaceScores.find(p => p.palace === name)

  // 辅助：构建宫位数据
  const buildPalace = (
    palaceName: string,
    score: number,
    level: string,
    majorStars: string,
    minorStars: string,
    sihua: string | null,
    threeQuadrants?: {
      opposite: DataFormatPalace
      firstTrine: DataFormatPalace
      secondTrine: DataFormatPalace
    },
  ): DataFormatPalace => ({
    palaceName,
    majorStars,
    minorStars,
    sihua,
    score: Math.round(score * 10) / 10,
    level,
    ...(threeQuadrants ? { threeQuadrants } : {}),
  })

  // 辅助：等级映射
  const toLevel = (tone: string, score: number): string => {
    if (tone === '吉旺' || score >= 6.0) return '吉旺'
    if (tone === '凶弱' || score < 4.5) return '凶弱'
    return '平'
  }

  // ── 原局数据 ──
  const mingScore = findPalace('命宫')
  const primaryScore = findPalace(primaryPalaceName)

  // 从 chartData 提取星曜信息
  const palaces = (params.chartData?.palaces as Array<Record<string, unknown>>) || []
  const findPalaceStars = (name: string) => {
    const p = palaces.find(pp => pp.name === name)
    const majors = ((p?.majorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string).join('+')
    const minors = ((p?.minorStars as Array<Record<string, unknown>>) || []).map(s => s.name as string).join('+')
    const sihua = ((p?.majorStars as Array<Record<string, unknown>>) || [])
      .filter(s => s.mutagen).map(s => `${s.name}化${s.mutagen}`).join('、') || null
    return { majors: majors || '空', minors: minors || '', sihua }
  }

  // 三方四正：对宫、三合宫
  const buildThreeQuadrants = (palaceName: string): DataFormatPalace['threeQuadrants'] | undefined => {
    // 三方四正映射（简化版：基于宫位名查找相关宫位）
    const palaceRelations: Record<string, { opposite: string; firstTrine: string; secondTrine: string }> = {
      '命宫': { opposite: '迁移', firstTrine: '财帛', secondTrine: '官禄' },
      '兄弟': { opposite: '仆役', firstTrine: '疾厄', secondTrine: '田宅' },
      '夫妻': { opposite: '官禄', firstTrine: '迁移', secondTrine: '福德' },
      '子女': { opposite: '田宅', firstTrine: '仆役', secondTrine: '父母' },
      '财帛': { opposite: '福德', firstTrine: '命宫', secondTrine: '官禄' },
      '疾厄': { opposite: '父母', firstTrine: '兄弟', secondTrine: '田宅' },
      '迁移': { opposite: '命宫', firstTrine: '夫妻', secondTrine: '福德' },
      '仆役': { opposite: '兄弟', firstTrine: '子女', secondTrine: '父母' },
      '官禄': { opposite: '夫妻', firstTrine: '财帛', secondTrine: '命宫' },
      '福德': { opposite: '财帛', firstTrine: '夫妻', secondTrine: '迁移' },
      '田宅': { opposite: '子女', firstTrine: '兄弟', secondTrine: '疾厄' },
      '父母': { opposite: '疾厄', firstTrine: '子女', secondTrine: '仆役' },
    }

    const rel = palaceRelations[palaceName]
    if (!rel) return undefined

    const buildRelatedPalace = (name: string): DataFormatPalace => {
      const stars = findPalaceStars(name)
      const score = findPalace(name)
      return buildPalace(
        name, score?.finalScore ?? 0, score ? toLevel(score.tone, score.finalScore) : '平',
        stars.majors, stars.minors, stars.sihua,
      )
    }

    return {
      opposite: buildRelatedPalace(rel.opposite),
      firstTrine: buildRelatedPalace(rel.firstTrine),
      secondTrine: buildRelatedPalace(rel.secondTrine),
    }
  }

  // 命宫
  const mingStars = findPalaceStars('命宫')
  const mingPalace = buildPalace(
    '命宫',
    mingScore?.finalScore ?? 0,
    mingScore ? toLevel(mingScore.tone, mingScore.finalScore) : '平',
    mingStars.majors,
    mingStars.minors,
    mingStars.sihua,
  )

  // 事项核心宫位
  const primaryStars = findPalaceStars(primaryPalaceName)
  const primaryPalace = buildPalace(
    primaryPalaceName,
    primaryScore?.finalScore ?? 0,
    primaryScore ? toLevel(primaryScore.tone, primaryScore.finalScore) : '平',
    primaryStars.majors,
    primaryStars.minors,
    primaryStars.sihua,
    buildThreeQuadrants(primaryPalaceName),
  )

  // 辅助宫位（大限命宫所在宫位和事项对宫）
  const secondaryPalaces: DataFormatPalace[] = []
  const currentDaXian = stage3.currentDaXianMapping
  if (currentDaXian) {
    // 大限命宫：动态从大限映射中获取实际宫位名
    const daXianMingName = (currentDaXian.mingPalaceName as PalaceName | undefined) ?? '迁移'
    const daXianMingScore = findPalace(daXianMingName)
    if (daXianMingScore) {
      const stars = findPalaceStars(daXianMingName)
      secondaryPalaces.push(buildPalace(
        daXianMingName, daXianMingScore.finalScore,
        toLevel(daXianMingScore.tone, daXianMingScore.finalScore),
        stars.majors, stars.minors, stars.sihua,
      ))
    }
  }

  // 四化摘要
  const shengNianSihua: DataFormatSihuaEntry[] = mergedSihua.entries
    .filter(e => e.source === '生年')
    .map(e => ({ type: e.type, star: e.star, palace: '' }))
  const taiSuiSihua: DataFormatSihuaEntry[] = mergedSihua.entries
    .filter(e => e.source === '太岁')
    .map(e => ({ type: e.type, star: e.star, palace: '' }))

  // ── 大限数据 ──
  const currentDaXianMapping = stage3.currentDaXianMapping
  const daXianAgeRange = currentDaXianMapping
    ? `${currentDaXianMapping.ageRange[0]}-${currentDaXianMapping.ageRange[1]}`
    : '未知'

  // 大限命宫
  const daXianMingPalace = (() => {
    // 动态从大限映射中获取大限命宫对应的原局宫位名
    const daXianMingName = (currentDaXianMapping?.mingPalaceName as PalaceName | undefined) ?? '迁移'
    const daXianMingStars = findPalaceStars(daXianMingName)
    const daXianMingScoreEntry = findPalace(daXianMingName)
    return buildPalace(
      daXianMingName,
      daXianMingScoreEntry?.finalScore ?? 0,
      daXianMingScoreEntry ? toLevel(daXianMingScoreEntry.tone, daXianMingScoreEntry.finalScore) : '平',
      daXianMingStars.majors,
      daXianMingStars.minors,
      daXianMingStars.sihua,
    )
  })()

  // 大限事项宫
  const daXianPrimaryPalace = buildPalace(
    primaryPalaceName,
    primaryScore?.finalScore ?? 0,
    primaryScore ? toLevel(primaryScore.tone, primaryScore.finalScore) : '平',
    primaryStars.majors,
    primaryStars.minors,
    primaryStars.sihua,
    buildThreeQuadrants(primaryPalaceName),
  )

  // 大限四化
  const daXianSihuaList: DataFormatSihuaEntry[] = (currentDaXianMapping?.mutagen ?? [])
    .map(m => {
      // mutagen 格式："化禄 天梁(迁移宫)"
      const match = m.match(/化(.)\s+(\S+)\((.+)\)/)
      if (match) {
        return { type: match[1], star: match[2], palace: match[3] }
      }
      return null
    })
    .filter((e): e is DataFormatSihuaEntry => e !== null)

  // 大限四化对原局的引动
  const daXianTriggers: DataFormatTrigger[] = []

  // ── 流年数据 ──
  // 流年命宫：动态计算（流年地支对应的原局宫位名）
  // 使用 stage3 中已有的 palaceIndex 或 fallback 到命宫
  const liuNianMingName: string = (() => {
    // 尝试从 allDaXianMappings 中找到流年信息
    // 流年命宫不固定，这里用默认值；实际由 formatMatterAnalysis 处理
    return '命宫'
  })()
  const liuNianMingStars = findPalaceStars(liuNianMingName)
  const liuNianMingScore = findPalace(liuNianMingName)
  const liuNianMingPalace = buildPalace(
    liuNianMingName,
    liuNianMingScore?.finalScore ?? 0,
    liuNianMingScore ? toLevel(liuNianMingScore.tone, liuNianMingScore.finalScore) : '平',
    liuNianMingStars.majors,
    liuNianMingStars.minors,
    liuNianMingStars.sihua,
  )

  // 流年事项宫
  const liuNianPrimaryPalace = buildPalace(
    primaryPalaceName,
    primaryScore?.finalScore ?? 0,
    primaryScore ? toLevel(primaryScore.tone, primaryScore.finalScore) : '平',
    primaryStars.majors,
    primaryStars.minors,
    primaryStars.sihua,
    buildThreeQuadrants(primaryPalaceName),
  )

  // 流年四化
  const liuNianSihuaList: DataFormatSihuaEntry[] = (stage3.liuNianSihuaPositions ?? [])
    .map(m => {
      const match = m.match(/化(.)\s+(\S+)\((.+)\)/)
      if (match) {
        return { type: match[1], star: match[2], palace: match[3] }
      }
      return null
    })
    .filter((e): e is DataFormatSihuaEntry => e !== null)

  // 重叠性
  const overlap = {
    primaryPalace: primaryPalaceName,
    affectedPalaces: [primaryPalaceName],
    isDirect: true,
  }

  return {
    matterType: String(matterType),
    mode,
    targetYear,
    currentYear,
    yuanJu: {
      ming: mingPalace,
      primary: primaryPalace,
      secondary: secondaryPalaces,
      sihuaSummary: {
        shengNian: shengNianSihua,
        taiSui: taiSuiSihua,
      },
    },
    daXian: {
      ageRange: daXianAgeRange,
      ming: daXianMingPalace,
      primary: daXianPrimaryPalace,
      sihua: { list: daXianSihuaList },
      triggersToYuanJu: { list: daXianTriggers },
    },
    liuNian: {
      year: targetYear,
      ming: liuNianMingPalace,
      primary: liuNianPrimaryPalace,
      sihua: { list: liuNianSihuaList },
      luCun: { palace: '待计算' },
      triggersToDaXian: { list: [] },
      overlap,
    },
    compositeScore: stage3.compositeScore ?? 0,
    scoreLabel: stage3.scoreLabel ?? '待评估',
  }
}

// ═══════════════════════════════════════════════════════════════════
// IR 上下文构建（保留原有逻辑）
// ═══════════════════════════════════════════════════════════════════

function buildIRContext(ir: IR): string {
  if (isIRStage1(ir)) return buildStage1Context(ir)
  if (isIRStage2(ir)) return buildStage2Context(ir)
  if (isIRStage3or4(ir)) return buildStage3or4Context(ir)
  return JSON.stringify(ir, null, 2)
}

function buildStage1Context(ir: IRStage1): string {
  const sorted = [...ir.palaceScores].sort((a, b) => b.finalScore - a.finalScore)
  const mingIdx = sorted.findIndex(p => p.palace === '命宫')
  const ordered = mingIdx > 0 ? [sorted[mingIdx]!, ...sorted.filter((_, i) => i !== mingIdx)] : sorted
  const scores = ordered
    .map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`)
    .join('\n')

  const patterns = ir.allPatterns.map(p => `${p.name}(${p.level})`).join('、')
  const sihua = ir.mergedSihua.entries.map(e => `${e.type}${e.star}(${e.source})`).join('；')
  const overlaps = ir.mergedSihua.specialOverlaps.map(o => `${o.type}: ${o.star}`).join('；')

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
    : '无'}
${buildDaXianContextBlock(ir.allDaXianSummary, ir.currentDaXian)}`
}

function buildStage2Context(ir: IRStage2): string {
  const scores = ir.palaceScores.map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`).join('\n')
  const patterns = ir.allPatterns.map(p => `${p.name}(${p.level})`).join('、')
  const sihua = ir.mergedSihua.entries.map(e => `${e.type}${e.star}(${e.source})`).join('；')

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
命宫全息底色：${ir.mingGongHolographic.summary}
${buildDaXianContextBlock(ir.allDaXianSummary, ir.currentDaXian)}`
}

function buildStage3or4Context(ir: IRStage3or4): string {
  const p = ir.primaryAnalysis
  const decadalLines = ir.daXianAnalysis.map(d => {
    const cur = d.isCurrent ? '（当前大限）' : ''
    return `- 第${d.index}大限 ${d.ageRange}${cur}：宫干${d.daXianGan}；四化落位 ${d.sihuaPositions.join('、') || '—'}；定性 ${d.tone}`
  })
  const ln = ir.liuNianAnalysis
  const yearlyBlock = `- 流年干${ln.liuNianGan}；流年四化 ${ln.sihuaPositions.join('、') || '—'}；方向 ${ln.direction}；与大限关系 ${ln.daXianRelation}；时间窗口 ${ln.window}`

  const scores = ir.palaceScores.map(p => `${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} ${p.tone}`).join('\n')
  const patterns = ir.allPatterns.map(p => `${p.name}(${p.level})`).join('、')
  const sihua = ir.mergedSihua.entries.map(e => `${e.type}${e.star}(${e.source})`).join('；')

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
// 大限数据展示（新增：Stage1/2 中展示全量大限评分）
// ═══════════════════════════════════════════════════════════════════

function buildDaXianContextBlock(
  summary?: DaXianSummaryEntry[],
  current?: DaXianDetailForPrompt,
): string {
  if (!summary?.length) return ''

  const lines = summary.map(d => {
    const marker = d.isCurrent ? ' ★当前' : ''
    // 每个大限的十二宫评分
    const scoreLine = d.palaceScores.length
      ? d.palaceScores.map(p => `${p.palace}(${p.finalScore.toFixed(1)}${p.tone})`).join(' ')
      : '无评分'
    return `  第${d.index}大限 ${d.ageRange}岁：宫干${d.daXianGan}，命宫→${d.mingPalaceName}，四化${d.sihuaStars.join('、')}${d.topPatterns.length ? '，格局' + d.topPatterns.join('、') : ''}${marker}
    ${scoreLine}`
  }).join('\n')

  let currentBlock = ''
  if (current) {
    const sorted = [...current.palaceScores].sort((a, b) => b.finalScore - a.finalScore)
    const top3 = sorted.slice(0, 3).map(p => `${p.palace}(${p.finalScore.toFixed(1)}${p.tone})`).join('、')
    const low3 = sorted.slice(-3).reverse().map(p => `${p.palace}(${p.finalScore.toFixed(1)}${p.tone})`).join('、')
    currentBlock = `

当前大限详情：第${current.index}大限（${current.ageRange}），宫干${current.daXianGan}，大限命宫在${current.mingPalaceName}
四化：${current.sihuaPositions.join('、')}
定性：${current.tone}
强旺宫：${top3}
偏弱宫：${low3}`
  }

  return `
大限全景（${summary.length}步大限）：
${lines}${currentBlock}`
}

// ═══════════════════════════════════════════════════════════════════
// 命盘快照构建（保留原有逻辑）
// ═══════════════════════════════════════════════════════════════════

export interface ChartSnapshotCtx {
  birthGan?: string
  taiSuiZhi?: string
}

export function buildChartSnapshotObject(chartData: Record<string, unknown>, ctx?: ChartSnapshotCtx): import('../types').ChartSnapshot {
  const palaces = (chartData?.palaces as Array<Record<string, unknown>>) || []
  const birthGan = ctx?.birthGan ?? (chartData?.birthGan as string | undefined) ?? '未知'
  const birthZhi = ctx?.taiSuiZhi ?? (chartData?.taiSuiZhi as string | undefined) ?? '未知'

  const ming = palaces.find(p => p.name === '命宫')
  const shen = palaces.find(p => p.isBodyPalace)
  const taiSui = birthZhi !== '未知' ? palaces.find(p => p.earthlyBranch === birthZhi) : undefined

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

  const decadalLines: string[] = []
  for (const p of palaces) {
    const decadal = p.decadal as { range: [number, number]; heavenlyStem: string } | undefined
    if (decadal && decadal.range[0] > 0) {
      decadalLines.push(`${p.name}(${p.earthlyBranch}): ${decadal.heavenlyStem}干，${decadal.range[0]}~${decadal.range[1]}岁`)
    }
  }

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

// ═══════════════════════════════════════════════════════════════════
// 性格数据构建（保留原有逻辑）
// ═══════════════════════════════════════════════════════════════════

export function buildPersonalityData(stage2Output: {
  mingGongTags?: { summary: string }
  shenGongTags?: { summary: string }
  taiSuiTags?: { summary: string }
  overallTone?: string
  personalityTriad?: {
    synthesis?: string
    mingLayer?: { description: string; manifestationTiming?: string }
    shenLayer?: { description: string; manifestationTiming?: string }
    taiSuiLayer?: { description: string; manifestationTiming?: string }
  }
}): string {
  const triad = stage2Output.personalityTriad
  const triadBlock = triad
    ? `\n【性格三宫 JSON 画像】\n命宫：${triad.mingLayer?.description ?? ''}（显现时机：${triad.mingLayer?.manifestationTiming ?? '终身显现'}）\n身宫：${triad.shenLayer?.description ?? ''}（显现时机：${triad.shenLayer?.manifestationTiming ?? '第三大限后逐渐明显'}）\n太岁宫：${triad.taiSuiLayer?.description ?? ''}（显现时机：${triad.taiSuiLayer?.manifestationTiming ?? '涉及核心利益或重大抉择时爆发'}）\n综合：${triad.synthesis ?? ''}\n\n【显现时机提示】请根据以上三宫的显现时机，在性格解读中提示用户：命宫特质从小就明显；身宫特质约30岁后才逐渐显现；太岁宫特质只在涉及核心利益或重大抉择时才爆发。避免让用户误以为所有特质当下都完全体现。`
    : ''
  return `命宫：${stage2Output.mingGongTags?.summary || '待分析'}
身宫：${stage2Output.shenGongTags?.summary || '待分析'}
太岁宫：${stage2Output.taiSuiTags?.summary || '待分析'}
整体基调：${stage2Output.overallTone || '待分析'}${triadBlock}`
}

// ═══════════════════════════════════════════════════════════════════
// 通用模板填充
// ═══════════════════════════════════════════════════════════════════

function fillTemplate(template: string, params: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════
// 阶段 Prompt 构建函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 构建阶段二用户 Prompt（性格分析）
 */
export function buildStage2UserPrompt(
  chartSnapshot: string,
  personalityData: string,
  userQuestion: string,
): string {
  return `【命盘速览】
${chartSnapshot}

【性格定性数据】
${personalityData}

用户问题：${userQuestion}

请输出详细的性格分析。`
}

/**
 * 事项分析 Governor 参数（五阶段框架）
 */
export interface EventAnalysisGovernorParams {
  intent: string
  primaryPalaceData: string
  protectionStatus: string
  fourDimensionResult: string
  slimmedDescriptions: string
  daXianTimeline: string
  causalChain: string
  luluJiFlow: string
  sihuaLandingDetail: string
  holographicBackground: string
  governorStrategy: string
  crisisSuffix: string
}

const GOVERNOR_TEMPLATE = `【一、原局底盘】
事项意图：{{INTENT}}
主看宫位：{{PRIMARY_PALACE_DATA}}
护佑机制：{{PROTECTION_STATUS}}
四维合参：{{FOUR_DIMENSION_RESULT}}
断语参考：
{{SLIMMED_DESCRIPTIONS}}

【二、行运脉络】
大限梳理：
{{DAXIAN_TIMELINE}}
行运因果：{{CAUSAL_CHAIN}}
禄忌流转：{{LULU_JI_FLOW}}

【三、流年引动】
四化落宫明细：
{{SIHUA_LANDING_DETAIL}}

【四、性格底色】
{{HOLOGRAPHIC_BACKGROUND}}

【五、咨询策略】{{GOVERNOR_STRATEGY}}

请以温暖兄长的口吻，严格按照「原局底盘→行运脉络→流年引动→综合结论」的四章节结构生成分析报告，不得臆造未给出的宫位或四化。{{CRISIS_SUFFIX}}`

/** 事项分析 governor 模板 */
export function buildEventAnalysisGovernorPrompt(params: EventAnalysisGovernorParams): string {
  return GOVERNOR_TEMPLATE
    .replace(/\{\{INTENT\}\}/g, params.intent)
    .replace(/\{\{PRIMARY_PALACE_DATA\}\}/g, params.primaryPalaceData)
    .replace(/\{\{PROTECTION_STATUS\}\}/g, params.protectionStatus)
    .replace(/\{\{FOUR_DIMENSION_RESULT\}\}/g, params.fourDimensionResult)
    .replace(/\{\{SLIMMED_DESCRIPTIONS\}\}/g, params.slimmedDescriptions)
    .replace(/\{\{DAXIAN_TIMELINE\}\}/g, params.daXianTimeline)
    .replace(/\{\{CAUSAL_CHAIN\}\}/g, params.causalChain)
    .replace(/\{\{LULU_JI_FLOW\}\}/g, params.luluJiFlow)
    .replace(/\{\{SIHUA_LANDING_DETAIL\}\}/g, params.sihuaLandingDetail)
    .replace(/\{\{HOLOGRAPHIC_BACKGROUND\}\}/g, params.holographicBackground)
    .replace(/\{\{GOVERNOR_STRATEGY\}\}/g, params.governorStrategy)
    .replace(/\{\{CRISIS_SUFFIX\}\}/g, params.crisisSuffix)
}

/**
 * 构建阶段三用户 Prompt（事项分析）
 * 包含按「输出给大模型的数据格式.json」结构组装的数据
 */
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
  matterDataJson?: string,
): string {
  const blocks: string[] = []

  // 如果有按新格式组装的完整数据，优先使用
  if (matterDataJson) {
    blocks.push(`请根据以下事项分析数据，生成一份${matter}分析报告。`)
    blocks.push(`【数据】`)
    blocks.push(matterDataJson)
  } else {
    // 回退到旧格式
    blocks.push(`【事项类型】${matter}`)
    blocks.push(`【主看宫位】${primaryPalace}（得分${primaryScore}，等级${brightness}）`)
    blocks.push(`【主星赋性】${starDescription}`)
    blocks.push(`【宫位描述】${eventDescription}`)
    blocks.push(`【行运分析】大限方向：${daXianDir}，流年方向：${liuNianDir}，时间窗口：${timeWindow}`)
    blocks.push(`【特殊条件】${specialConditions}`)
  }

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
  return `【入卦数据分析】
${interactionData}
【核心张力点】${tension}
【可调整建议】${advice}

请输出互动关系分析。`
}
