/**
 * 报告生成紫微数据管道 — 排盘 + Stage 计算 + IR 拼装 + 结构化数据看板
 *
 * 三部分输出（ReportIR）：
 *  1. 深化 IR（给 AI 解读）：命盘快照 + 性格三宫 + 每事项 MatterAnalysisSpec（三层十二宫规范数据）
 *     + governorBlock 数据（因果链/禄随忌走/保护状态/四维度）+ 四化落宫 + 逐大限走势 + 格局
 *  2. dataPanel（程序生成的可视化数据，无 AI 幻觉）：宫位评分表/四化落宫/大限走势/格局/事项评分/性格三宫
 *  3. 元信息（命主/时间上下文/重点宫位）
 *
 * 报告最终输出 { dataPanel, chapters }：dataPanel 可视化 + chapters AI 解读。
 */
import { astro } from 'iztro'
import {
  serializeAstrolabeForReading,
  serializeHoroscopeForReading,
} from '@/lib/ziwei/serialize-chart-for-reading'
import { MAJOR_CITIES, calculateTrueSolarTime } from '@/lib/solar-time'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { resolveMatterRoute } from '@/core/router/matter-route-resolver'
import { buildChartSnapshotObject } from '@/core/llm-wrapper/prompt-builder'
import { findCurrentDaXianFromChart, resolveLiuNianGan } from '@/core/limit-analyzer/fortune-engine'
import { formatMatterAnalysis } from '@/core/format/matter-analysis-formatter'
import type {
  MatterType, ChartSnapshot, FourDimensionTags, PalaceScore, PatternMatch,
} from '@/core/types'
import type { MatterAnalysisSpec } from '@/core/format/types'

// ════════════════════════════════════════════════════════════
// 类型
// ════════════════════════════════════════════════════════════

export interface ReportIdentity {
  name: string
  gender: 'MALE' | 'FEMALE' | string
  birthday: string
  birthCity?: string | null
  region?: string | null
  bazi?: string | null
}

// ── dataPanel：结构化可视化数据 ──

export interface DataPanelPalace {
  palace: string
  diZhi: string
  majorStars: string[]
  finalScore: number
  level: string
  isBodyPalace: boolean
}

export interface DataPanelSihua {
  layer: string
  type: string
  star: string
  palace: string
}

export interface DataPanelDaXian {
  index: number
  ageRange: string
  tone: string
  daXianGan: string
  mingPalace: string
  mutagen: string[]
  isCurrent: boolean
}

export interface DataPanelMatter {
  matterType: MatterType
  primaryPalace: string
  primaryScore: number
  compositeScore: number
  scoreLabel: string
  direction: string
}

export interface ReportDataPanel {
  palaceScores: DataPanelPalace[]
  sihuaLanding: DataPanelSihua[]
  daXianTimeline: DataPanelDaXian[]
  patterns: Array<{ name: string; level: string; category: string }>
  matters: DataPanelMatter[]
  personalityTriad: {
    overallTone: string
    ming: string
    shen: string
    taiSui: string
  } | null
}

// ── 深化事项分析（给 AI）──

export interface ReportDeepMatter {
  matterType: MatterType
  /** 三层十二宫规范数据（原局/大限/流年，含三方四正+四化+引动） */
  matterSpec: MatterAnalysisSpec | null
  /** governorBlock 数据（因果链/禄随忌走/保护状态/四维度/危机策略） */
  governorData: {
    causalChain: string
    luluJiFlow: string[]
    resilience: { strategy: string; promptSuffix: string } | null
    primaryAnalysis: { palace: string; innateLevel: string; protectionStatus: string; fourDimensionResult: string }
  } | null
  analysisSummary: {
    innateBase: string
    fortuneTrend: string
    yearlyTrigger: string
    compositeConclusion: string
    riskAdvice: string
  } | null
  compositeScore: number
  scoreLabel: string
  directionMatrix: [string, string]
  primaryPalace: string
  primaryScore: number
}

// ── 完整 IR ──

export interface ReportIR {
  identity: { name: string; gender: string; solarDate: string; lunarDate: string }
  chartSnapshot: ChartSnapshot
  personality: {
    synthesis: string
    overallTone: string
    mingTags: FourDimensionTags | null
    shenTags: FourDimensionTags | null
    taiSuiTags: FourDimensionTags | null
  } | null
  /** 深化事项分析（含三层规范数据 + governorBlock） */
  matters: ReportDeepMatter[]
  timeContext: {
    currentYear: number
    liuNianGan: string
    currentDaXian: { index: number; ageRange: string; mingPalaceName: string } | null
  }
  focusPalaces: string
  baziAux: string | null
  /** 结构化可视化数据看板（程序生成，供前端渲染表格/图表） */
  dataPanel: ReportDataPanel
  /** AI 预解析的事项 governor 结果（由 report-governor-runner 填充，主调用 prompt 引用） */
  matterAnalysisTexts?: Array<{ matterType: MatterType; text: string; degraded?: boolean }>
}

// ════════════════════════════════════════════════════════════
// 模板主题 → 紫微事项映射
// ════════════════════════════════════════════════════════════

export const TEMPLATE_MAP: Record<string, { matters: MatterType[]; focus: string }> = {
  'talent-awakening': {
    matters: ['求职'],
    focus: '命宫主星（天赋底色）、官禄宫（才能与事业方向）、福德宫（兴趣与潜能）',
  },
  'love-atlas': {
    matters: ['求爱'],
    focus: '夫妻宫（感情模式）、桃花星（红鸾/天喜/咸池/沐浴）、福德宫（情感需求）',
  },
  'life-kline': {
    matters: ['求财', '求职'],
    focus: '十二宫大限范围（十年走势）、当前大限与流年关键节点、财帛宫与官禄宫趋势',
  },
  'life-full-analysis': {
    matters: ['求财', '求职', '求爱', '求健康'],
    focus: '全盘十二宫、性格三宫（命宫/身宫/太岁宫）、各大限走势与流年引动',
  },
  'annual-fortune': {
    matters: ['求财', '求职'],
    focus: '流年命宫、流年四化（禄权科忌）引动、十二宫流年吉凶、流年方向判断',
  },
  'compatibility-report': {
    matters: ['求爱'],
    focus: '命宫（自身特质）、夫妻宫（伴侣画像）、迁移宫（人际外缘）——单视角关系倾向分析',
  },
  'lucky-tips': {
    matters: ['求财'],
    focus: '命宫、禄存落宫位置、贵人星（天魁/天钺/左辅/右弼）、文昌文曲',
  },
  'academic': {
    matters: ['求学'],
    focus: '官禄宫（学业方向）、文昌/文曲落宫、命宫（思维方式）',
  },
  'past-life': {
    matters: [],
    focus: '福德宫（业力与潜意识）、命宫（灵魂底色）、性格三宫深层画像',
  },
}

// ════════════════════════════════════════════════════════════
// 排盘
// ════════════════════════════════════════════════════════════

function parseBirthday(birthday: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const m = birthday.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/)
  if (!m) throw new Error(`无法解析出生时间：${birthday}`)
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] }
}

function resolveLongitude(birthCity?: string | null, region?: string | null): number {
  const place = birthCity || region || ''
  const hit = MAJOR_CITIES.find(c => place.includes(c.name))
  return hit?.longitude ?? 120
}

function resolveTimeIndex(
  birthday: string,
  birthCity?: string | null,
  region?: string | null,
): { timeIndex: number; year: number; month: number; day: number; hour: number } {
  const { year, month, day, hour, minute } = parseBirthday(birthday)
  const longitude = resolveLongitude(birthCity, region)
  const date = new Date(year, month - 1, day)
  const { timeIndex } = calculateTrueSolarTime(date, hour, minute, longitude)
  return { timeIndex, year, month, day, hour }
}

export function buildReportChartData(identity: ReportIdentity): Record<string, unknown> {
  const { timeIndex, year, month, day, hour } = resolveTimeIndex(identity.birthday, identity.birthCity, identity.region)
  const gender = identity.gender === 'MALE' ? '男' : '女'
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const targetYear = new Date().getFullYear()
  const astrolabe = astro.bySolar(dateStr, timeIndex, gender as '男' | '女', true)
  const horoscope = astrolabe.horoscope(new Date(targetYear, month - 1, day), timeIndex)
  return serializeAstrolabeForReading(
    astrolabe as unknown as Record<string, unknown>,
    { year, month, day, hour, gender, solar: true },
    {
      horoscope: serializeHoroscopeForReading(horoscope, targetYear) as unknown as Record<string, unknown>,
      referenceYear: targetYear,
    },
  )
}

// ════════════════════════════════════════════════════════════
// Stage 计算 + 深化数据提取
// ════════════════════════════════════════════════════════════

type Stage1 = ReturnType<typeof executeStage1>
type Stage2 = ReturnType<typeof executeStage2>
type Stage3 = ReturnType<typeof executeStage3>

function runReportStages(
  chartData: Record<string, unknown>,
  matters: MatterType[],
  targetYear: number,
) {
  const stage1 = executeStage1({ chartData })
  const stage2 = executeStage2({ stage1, question: '' })
  const stage3List = matters.map(matterType => {
    const route = resolveMatterRoute(matterType, '')
    const stage3 = executeStage3({ stage1, stage2, matterType, routeResult: route, chartData, targetYear })
    // 复用对话同源的 formatMatterAnalysis 生成三层十二宫规范数据
    let matterSpec: MatterAnalysisSpec | null = null
    try {
      matterSpec = formatMatterAnalysis({ stage1, stage3, matterType, targetYear, chartData })
    } catch (e) {
      console.error(`[report-pipeline] formatMatterAnalysis 失败 (${matterType}):`, e instanceof Error ? e.message : e)
    }
    return { matterType, stage3, matterSpec }
  })
  return { stage1, stage2, stage3List }
}

/** 等级映射（吉旺→强旺 等） */
function mapLevel(tone: string): string {
  if (tone === '吉旺') return '强旺'
  if (tone === '凶弱') return '偏弱'
  return '一般'
}

/** 提取深化事项分析（matterSpec + governorData + analysisSummary） */
function extractDeepMatter(
  stage1: Stage1,
  item: { matterType: MatterType; stage3: Stage3; matterSpec: MatterAnalysisSpec | null },
): ReportDeepMatter {
  const { matterType, stage3, matterSpec } = item
  const summary = stage3.analysisSummary ?? null
  const primaryPalace = stage3.primaryAnalysis?.palace ?? matterType
  const primaryScore = stage1.palaceScores.find(p => p.palace === primaryPalace)?.finalScore ?? 0
  const directionMatrix = (stage3.directionMatrix ?? ['平', '平']) as unknown as [string, string]

  const governorData = stage3.primaryAnalysis
    ? {
        causalChain: stage3.causalChain ?? '',
        luluJiFlow: stage3.luluJiFlow ?? [],
        resilience: stage3.resilience
          ? { strategy: stage3.resilience.strategy ?? '', promptSuffix: stage3.resilience.promptSuffix ?? '' }
          : null,
        primaryAnalysis: {
          palace: stage3.primaryAnalysis.palace ?? primaryPalace,
          innateLevel: stage3.primaryAnalysis.innateLevel ?? '',
          protectionStatus: stage3.primaryAnalysis.protectionStatus ?? '未检测',
          fourDimensionResult: stage3.primaryAnalysis.fourDimensionResult ?? '未分析',
        },
      }
    : null

  return {
    matterType,
    matterSpec,
    governorData,
    analysisSummary: summary
      ? {
          innateBase: summary.innateBase,
          fortuneTrend: summary.fortuneTrend,
          yearlyTrigger: summary.yearlyTrigger,
          compositeConclusion: summary.compositeConclusion,
          riskAdvice: summary.riskAdvice,
        }
      : null,
    compositeScore: typeof stage3.compositeScore === 'number' ? stage3.compositeScore : 0,
    scoreLabel: stage3.scoreLabel ?? '',
    directionMatrix,
    primaryPalace,
    primaryScore,
  }
}

// ════════════════════════════════════════════════════════════
// dataPanel 构建（结构化可视化数据）
// ════════════════════════════════════════════════════════════

function buildDataPanel(
  stage1: Stage1,
  stage2: Stage2,
  chartSnapshot: ChartSnapshot,
  deepMatters: ReportDeepMatter[],
  currentDaXianIdx: number | null,
): ReportDataPanel {
  // 十二宫评分表
  const palaceScores: DataPanelPalace[] = stage1.palaceScores.map((p: PalaceScore) => ({
    palace: p.palace,
    diZhi: p.diZhi,
    majorStars: p.majorStars.map(s => s.star),
    finalScore: Number(p.finalScore.toFixed(2)),
    level: mapLevel(p.tone),
    isBodyPalace: chartSnapshot.shenGong.name === p.palace,
  }))

  // 四化落宫（从首个有 matterSpec 的事项提取全局四化：原局+大限+流年）
  const sihuaLanding: DataPanelSihua[] = []
  const firstSpec = deepMatters.find(m => m.matterSpec)?.matterSpec
  if (firstSpec) {
    for (const s of firstSpec.yuanJu.sihuaSummary.shengNian) {
      sihuaLanding.push({ layer: '原局·生年', type: s.type, star: s.star, palace: s.palace })
    }
    for (const s of firstSpec.yuanJu.sihuaSummary.taiSui) {
      sihuaLanding.push({ layer: '原局·太岁', type: s.type, star: s.star, palace: s.palace })
    }
    for (const s of firstSpec.daXian.sihua.list) {
      sihuaLanding.push({ layer: `大限(${firstSpec.daXian.ageRange})`, type: s.type, star: s.star, palace: s.palace })
    }
    for (const s of firstSpec.liuNian.sihua.list) {
      sihuaLanding.push({ layer: `流年(${firstSpec.liuNian.year})`, type: s.type, star: s.star, palace: s.palace })
    }
  }

  // 逐大限走势由 buildReportIR 用 stage3.allDaXianMappings（命盘级全量）填充
  const daXianTimeline: DataPanelDaXian[] = []

  // 格局列表
  const patterns = stage1.allPatterns.map((p: PatternMatch) => ({
    name: p.name,
    level: p.level,
    category: p.category,
  }))

  // 事项评分汇总
  const matters: DataPanelMatter[] = deepMatters.map(m => ({
    matterType: m.matterType,
    primaryPalace: m.primaryPalace,
    primaryScore: Number(m.primaryScore.toFixed(2)),
    compositeScore: Number(m.compositeScore.toFixed(2)),
    scoreLabel: m.scoreLabel,
    direction: `${m.directionMatrix[0]}·${m.directionMatrix[1]}`,
  }))

  // 性格三宫
  const personalityTriad = stage2.personalityTriad
    ? {
        overallTone: stage2.overallTone ?? '',
        ming: stage2.mingGongTags?.summary ?? '',
        shen: stage2.shenGongTags?.summary ?? '',
        taiSui: stage2.taiSuiTags?.summary ?? '',
      }
    : null

  return { palaceScores, sihuaLanding, daXianTimeline, patterns, matters, personalityTriad }
}

// ════════════════════════════════════════════════════════════
// IR 拼装
// ════════════════════════════════════════════════════════════

function buildReportIR(
  identity: ReportIdentity,
  chartData: Record<string, unknown>,
  stage1: Stage1,
  stage2: Stage2,
  stage3List: Array<{ matterType: MatterType; stage3: Stage3; matterSpec: MatterAnalysisSpec | null }>,
  focusPalaces: string,
): ReportIR {
  const chartSnapshot = buildChartSnapshotObject(chartData, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  const targetYear = new Date().getFullYear()
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentDaXian = findCurrentDaXianFromChart([], targetYear, birthYear, chartData)
  const liuNianGan = resolveLiuNianGan(chartData, targetYear)
  const currentDaXianIdx = currentDaXian?.index ?? null

  const personality = stage2.personalityTriad
    ? {
        synthesis: stage2.personalityTriad.synthesis ?? '',
        overallTone: stage2.overallTone ?? '',
        mingTags: stage2.mingGongTags ?? null,
        shenTags: stage2.shenGongTags ?? null,
        taiSuiTags: stage2.taiSuiTags ?? null,
      }
    : null

  const matters = stage3List.map(item => extractDeepMatter(stage1, item))

  // dataPanel：daXianTimeline 用 stage3 的 allDaXianMappings（命盘级，全量）
  // 当 matters 为空（如 past-life 模板）时，fallback 到 stage1.allDaXianSummary
  const allDaXianRaw = stage3List[0]?.stage3.allDaXianMappings ?? []
  const palaceScores = stage1.palaceScores.map((p: PalaceScore) => ({
    palace: p.palace, diZhi: p.diZhi,
    majorStars: p.majorStars.map(s => s.star),
    finalScore: Number(p.finalScore.toFixed(2)),
    level: mapLevel(p.tone),
    isBodyPalace: chartSnapshot.shenGong.name === p.palace,
  }))
  const daXianTimeline = allDaXianRaw.length > 0
    ? allDaXianRaw.map(d => ({
        index: d.index,
        ageRange: `${d.ageRange[0]}~${d.ageRange[1]}`,
        tone: d.index === currentDaXianIdx ? '当前' : (d.mutagen?.[3] ? '艰辛期' : '顺畅期'),
        daXianGan: d.daXianGan,
        mingPalace: d.mingPalaceName,
        mutagen: d.mutagen ?? [],
        isCurrent: d.index === currentDaXianIdx,
      }))
    : (stage1.allDaXianSummary ?? []).map(d => ({
        index: d.index,
        ageRange: d.ageRange,
        tone: d.isCurrent ? '当前' : '—',
        daXianGan: d.daXianGan,
        mingPalace: d.mingPalaceName,
        mutagen: d.sihuaStars ?? [],
        isCurrent: d.isCurrent,
      }))

  // 组装 dataPanel（sihuaLanding/patterns/matters/personalityTriad 用 buildDataPanel）
  const basePanel = buildDataPanel(stage1, stage2, chartSnapshot, matters, currentDaXianIdx)
  // 当 matters 为空时，sihuaLanding 也为空（依赖 matterSpec）→ fallback 用 stage1 全局四化标注
  const sihuaLanding = basePanel.sihuaLanding.length > 0
    ? basePanel.sihuaLanding
    : (stage1.mergedSihua.palaceAnnotations ?? []).flatMap(ann =>
        ann.annotations.map(a => ({
          layer: '原局·全局',
          type: String(a.type ?? ''),
          star: a.star,
          palace: ann.palaceName,
        }))
      )
  const dataPanel: ReportDataPanel = {
    ...basePanel,
    sihuaLanding,
    daXianTimeline, // 用全量 allDaXianMappings（或 stage1 fallback）覆盖
    palaceScores,
  }

  return {
    identity: {
      name: identity.name,
      gender: identity.gender === 'MALE' ? '男' : '女',
      solarDate: chartSnapshot.solarDate,
      lunarDate: chartSnapshot.lunarDate,
    },
    chartSnapshot,
    personality,
    matters,
    timeContext: {
      currentYear: targetYear,
      liuNianGan,
      currentDaXian: currentDaXian
        ? { index: currentDaXian.index, ageRange: `${currentDaXian.ageRange[0]}~${currentDaXian.ageRange[1]}`, mingPalaceName: currentDaXian.mingPalaceName }
        : null,
    },
    focusPalaces,
    baziAux: identity.bazi ?? null,
    dataPanel,
  }
}

// ════════════════════════════════════════════════════════════
// 主入口
// ════════════════════════════════════════════════════════════

/**
 * 报告上下文 Bundle：包含 IR + stage 中间值 + chartData
 *
 * 返回中间值的目的：让 report-governor-runner 能直接复用 stage1/2/3 + chartData，
 * 不需要重排盘或重算 stage。
 */
export interface ReportContextBundle {
  ir: ReportIR
  stage1: Stage1
  stage2: Stage2
  stage3List: Array<{ matterType: MatterType; stage3: Stage3; matterSpec: MatterAnalysisSpec | null }>
  chartData: Record<string, unknown>
  targetYear: number
}

export function buildReportContext(identity: ReportIdentity, templateSlug: string): ReportContextBundle {
  const tmpl = TEMPLATE_MAP[templateSlug] ?? { matters: [] as MatterType[], focus: '命宫与十二宫整体格局' }
  const chartData = buildReportChartData(identity)
  const targetYear = new Date().getFullYear()
  const { stage1, stage2, stage3List } = runReportStages(chartData, tmpl.matters, targetYear)
  const ir = buildReportIR(identity, chartData, stage1, stage2, stage3List, tmpl.focus)
  return { ir, stage1, stage2, stage3List, chartData, targetYear }
}

/**
 * 基于 ChartSnapshot 构建报告 IR（避免重排盘，复用 stage1/2 快照）
 *
 * 与 buildReportContext 等价输出，但 chartData 和 stage1/2 来自持久化快照，
 * 节省 ~200-500ms 排盘时间，且多次报告生成保证命盘一致
 */
export function buildReportContextFromSnapshot(
  identity: ReportIdentity,
  templateSlug: string,
  snapshot: {
    reading: Record<string, unknown>
    stage1: unknown
    stage2: unknown
  },
): ReportContextBundle {
  const tmpl = TEMPLATE_MAP[templateSlug] ?? { matters: [] as MatterType[], focus: '命宫与十二宫整体格局' }
  const chartData = snapshot.reading
  const targetYear = new Date().getFullYear()
  // stage1/2 来自 snapshot，避免重算；stage3 仍需计算（依赖 matterType）
  const stage1 = snapshot.stage1 as ReturnType<typeof executeStage1>
  const stage2 = snapshot.stage2 as ReturnType<typeof executeStage2>
  const stage3List = tmpl.matters.map(matterType => {
    const route = resolveMatterRoute(matterType, '')
    const stage3 = executeStage3({ stage1, stage2, matterType, routeResult: route, chartData, targetYear })
    let matterSpec: MatterAnalysisSpec | null = null
    try {
      matterSpec = formatMatterAnalysis({ stage1, stage3, matterType, targetYear, chartData })
    } catch (e) {
      console.error(`[report-pipeline] formatMatterAnalysis 失败 (${matterType}):`, e instanceof Error ? e.message : e)
    }
    return { matterType, stage3, matterSpec }
  })
  const ir = buildReportIR(identity, chartData, stage1, stage2, stage3List, tmpl.focus)
  return { ir, stage1, stage2, stage3List, chartData, targetYear }
}
