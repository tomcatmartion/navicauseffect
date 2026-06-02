/**
 * M7: LLM 表达层 — Prompt 组装器（v2）
 *
 * 职责：接收 IR JSON + 知识片段 + 事项数据，组装完整的 Prompt
 * 来源：data/ziwei-chat-prompt.md + data/System Prompt.md + data/User Prompt.md
 *
 * 已废弃：data/prompt_templates.json（不再使用）
 */

import type { IR, IRStage1, IRStage2, IRStage3or4, MatterType } from '../types'
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

function getSystemPrompt(): string {
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

export const STAGE2_HINT = `你现在进入【性格分析阶段】。请基于以下【命盘速览】和【性格定性数据】，输出一段详细的性格描述（不少于150字），语气要像兄长一样温暖、有共鸣。之后自然引导用户说出想了解的方向。

核心要求：
1. 先分析，再引导——必须先给出实质性分析，让用户感受到"说了对我有帮助"。
2. 性格解读必须详细（不少于150字）。
3. 每次只问一个问题。
4. 严禁只提问不分析。`

export const STAGE3_HINT = `你现在进入【事项分析阶段】。请基于提供的事项分析数据，按照「原局气场→大限十年走势→流年分析→综合结论」的四章节结构输出分析报告。

核心要求：
1. 严格基于数据中的事实，不得编造宫位、星曜、四化、分数、等级。
2. 分析时必须引用数据中的具体数值来支撑观点。
3. 使用平实、亲切的语言，多用「你」来称呼用户。
4. 不做具体预测（不预测金额、时间、事件结果）。
5. 对四化引动用「因为…所以…」的因果句式解释。
6. 每层分析先看命宫状态再看事项宫状态（合参规则）。`

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
    currentDaXianMapping?: { index: number; ageRange: [number, number]; daXianGan: string; mutagen?: string[] }
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
    // 大限命宫通常落在迁移宫或其他宫位
    const daXianMingName = findPalaceStars('迁移').majors ? '迁移' : '命宫'
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
    // 大限命宫：从当前大限映射中获取
    const daXianMingStars = findPalaceStars('迁移')
    const daXianMingScoreEntry = findPalace('迁移')
    return buildPalace(
      daXianMingScoreEntry ? '迁移' : '命宫',
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
  // 流年命宫
  const liuNianMingStars = findPalaceStars('夫妻') // 流年命宫会根据年份变化
  const liuNianMingScore = findPalace('夫妻')
  const liuNianMingPalace = buildPalace(
    liuNianMingScore ? '夫妻' : '命宫',
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
    : '无'}`
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
 * 事项分析 Governor 参数
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

const GOVERNOR_TEMPLATE = `【命理运算结果】
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

/** 事项分析 governor 模板 */
export function buildEventAnalysisGovernorPrompt(params: EventAnalysisGovernorParams): string {
  return GOVERNOR_TEMPLATE
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
