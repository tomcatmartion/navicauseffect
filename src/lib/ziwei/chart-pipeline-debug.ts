/**
 * 排盘页「规则解析」调试：与 Hybrid 编排共用 Stage1–4 + PromptBuilder，
 * 供前端与 iztro 序列化命盘对齐核验。
 */

import type {
  IRStage1,
  IRStage2,
  IRStage3or4,
  MatterType,
  PatternLevel,
  Stage3Output,
  Stage4Output,
} from '@/core/types'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { executeStage3 } from '@/core/stages/stage3-matter-analysis'
import { executeStage4 } from '@/core/stages/stage4-interaction'
import { routeMatter } from '@/core/router/decision-tree'
import { evaluateJsonPatterns } from '@/lib/ziwei/hybrid/patterns-dsl'
import {
  buildPrompt,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import { getDunGan } from '@/core/sihua-calculator/tables'
import type { TianGan, DiZhi } from '@/core/types'
import type { VirtualChart } from '@/core/tai-sui-rua-gua/virtual-chart'

export interface ChartPipelineDebugOptions {
  /** 事项类型（与面板一致） */
  affairType: MatterType
  /** 事项描述 */
  affair: string
  /** 流年（事项分析） */
  targetYear: number
  /** 互动调试：对方生年；不传则阶段四走单方分析 */
  partnerBirthYear?: number | null
}

/** 与 `ziwei-analysis-panel` 格局列表展示兼容 */
export interface UiPatternRow {
  name: string
  category: string
  effect: 'positive' | 'negative' | 'mixed'
  source: string
  description: string
  level?: string
}

export interface UiPalaceRow {
  palace: string
  diZhi: string
  level: string
  finalScore: number
}

export interface ChartPipelineDebugSnapshot {
  engine: 'hybrid-stages'
  patterns: UiPatternRow[]
  dslPatternHits: Array<{ id: string; name: string }>
  allPalaces: Record<string, UiPalaceRow>
  personality: {
    overview: string
    traits: { surface: string[]; middle: string[]; core: string[] }
    fourDimensions: {
      self: string
      opposite: string
      trine: string
      flanking: string
      synthesis: string
    }
    strengths: string[]
    weaknesses: string[]
    advice: { overall: string; career: string; relationship: string; health: string }
    knowledgeSnippets: Array<{ source: string; key: string; content: string }>
  }
  affair: {
    overview: string
    conclusion: {
      probability: string
      opportunities: string[]
      obstacles: string[]
    }
    advice: { strategy: string[] }
  }
  extended: {
    birthGan: TianGan
    taiSuiZhi: DiZhi
    dunGanStem: TianGan
    shengNianSihua: Record<string, string>
    taiSuiPalaceStemSihua: Record<string, string>
    dunGanNote: string
    mergedSihuaEntries: Array<{ type: string; star: string; source: string }>
    specialOverlaps: Array<{ type: string; star: string }>
    threeLayerTable: unknown
    taiSuiRua: {
      mode: 'full' | 'solo'
      partnerYear: number | null
      virtualChart: ReturnType<typeof serializeVirtualChart> | null
      tensionPoints: string[]
    }
    prompts: {
      stage1: string
      stage2: string
      stage3: string
      stage4: string
    }
  }
}

function patternLevelToEffect(level: PatternLevel): 'positive' | 'negative' | 'mixed' {
  if (level === '大吉' || level === '中吉' || level === '小吉') return 'positive'
  if (level === '大凶' || level === '中凶' || level === '小凶') return 'negative'
  return 'mixed'
}

function serializeVirtualChart(v: VirtualChart | null) {
  if (!v) return null
  return {
    gan: v.gan,
    zhi: v.zhi,
    virtualMingGong: v.virtualMingGong,
    virtualPalaces: v.virtualPalaces,
    incomingStars: v.incomingStars,
    sihua: v.sihua,
  }
}

function joinPromptPreview(
  ir: IRStage1 | IRStage2 | IRStage3or4,
  knowledgeContents: string[],
  userStub: string,
  stageHint: string,
): string {
  const msgs = buildPrompt(ir, knowledgeContents, userStub, stageHint)
  return msgs.map(m => `【${m.role}】\n${m.content}`).join('\n\n—\n\n')
}

function buildStage3Ir(output: Stage3Output): IRStage3or4 {
  return {
    stage: 3,
    matterType: output.matterType,
    primaryAnalysis: output.primaryAnalysis,
    daXianAnalysis: output.allDaXianMappings.map(d => ({
      index: d.index,
      ageRange: `${d.ageRange[0]}~${d.ageRange[1]}`,
      daXianGan: d.daXianGan,
      sihuaPositions: d.mutagen,
      tone: (d.mutagen[3] ? '艰辛期' : '顺畅期') as '顺畅期' | '艰辛期' | '危机期' | '转机期',
      isCurrent: false,
    })),
    liuNianAnalysis: {
      liuNianGan: '甲',
      sihuaPositions: [],
      direction: output.directionMatrix[1] === '吉' ? '吉' : '凶',
      daXianRelation: output.directionMatrix,
      window: output.directionWindow,
    },
  }
}

function buildStage4Ir(output: Stage4Output): IRStage3or4 {
  return {
    stage: 4,
    matterType: '互动关系',
    primaryAnalysis: {
      palace: '夫妻',
      fourDimensionResult: '互动关系分析',
      mingGongRegulation: '',
      protectionStatus: '',
      innateLevel: '互动分析',
    },
    daXianAnalysis: [],
    liuNianAnalysis: {
      liuNianGan: output.interaction.partnerGan === ('—' as TianGan) ? '甲' : output.interaction.partnerGan,
      sihuaPositions: [],
      direction: '吉',
      daXianRelation: '吉吉',
      window: '推进窗口',
    },
  }
}

/**
 * 基于与 Hybrid 相同的 `chartData`（serializeAstrolabeForReading）构建调试快照。
 */
export function buildChartPipelineDebugSnapshot(
  chartData: Record<string, unknown>,
  opts: ChartPipelineDebugOptions,
): ChartPipelineDebugSnapshot {
  const stage1 = executeStage1({ chartData })
  const stage2 = executeStage2({ stage1, question: opts.affair || '性格与事项调试' })

  const matchedNames = new Set(stage1.allPatterns.map(p => p.name))
  const starsByPalaceIndex = stage1.scoringCtx.palaces.map(p => p.majorStars.map(s => String(s)))
  const dslHits = evaluateJsonPatterns({ starsByPalaceIndex, matchedPatternNames: matchedNames })

  const patterns: UiPatternRow[] = stage1.allPatterns.map(p => ({
    name: p.name,
    category: p.category || '格局',
    effect: patternLevelToEffect(p.level),
    source: 'natal',
    description: `${p.level}（倍率×${p.multiplier}）`,
    level: p.level,
  }))

  const allPalaces: Record<string, UiPalaceRow> = {}
  for (const ps of stage1.palaceScores) {
    allPalaces[ps.diZhi] = {
      palace: ps.palace,
      diZhi: ps.diZhi,
      level: ps.tone,
      finalScore: ps.finalScore,
    }
  }

  const surfaceTags = stage2.mingGongTags.selfTags.slice(0, 5)
  const middleTags = stage2.shenGongTags.selfTags.slice(0, 5)
  const coreTags = stage2.taiSuiTags.selfTags.slice(0, 5)

  const trineStrengths = stage2.mingGongTags.trineTags.filter(t => t.includes('强力支撑'))
  const oppositeIssues = stage2.mingGongTags.oppositeTags.filter(t => t.includes('制约'))

  const luCount = (stage2.mingGongHolographic.sihuaDirection.match(/化禄/g) || []).length
  const quanCount = (stage2.mingGongHolographic.sihuaDirection.match(/化权/g) || []).length
  const jiCount = (stage2.mingGongHolographic.sihuaDirection.match(/化忌/g) || []).length

  const personality = {
    overview: [
      `命宫（${stage2.mingGongTags.palace}·${stage2.mingGongTags.diZhi}）：${stage2.mingGongTags.summary}`,
      `身宫（${stage2.shenGongTags.palace}·${stage2.shenGongTags.diZhi}）：${stage2.shenGongTags.summary}`,
      `太岁宫（${stage2.taiSuiTags.palace}·${stage2.taiSuiTags.diZhi}）：${stage2.taiSuiTags.summary}`,
      `整体基调：${stage2.overallTone}`,
      `全息底色：${stage2.mingGongHolographic.summary}`,
    ].join('\n'),
    traits: {
      surface: surfaceTags.length ? surfaceTags : ['（暂无表层标签）'],
      core: coreTags.length ? coreTags : ['（暂无核心特质）'],
      middle: middleTags.length ? middleTags : ['（暂无中层特质）'],
    },
    fourDimensions: {
      self: stage2.mingGongTags.selfTags.slice(0, 3).join('、'),
      opposite: stage2.mingGongTags.oppositeTags[0] || '中性投射',
      trine: stage2.mingGongTags.trineTags[0] || '三合支撑一般',
      flanking: stage2.mingGongTags.flankingTags[0] || '夹宫不成立',
      synthesis: `本宫${stage2.mingGongTags.summary}；对宫${stage2.mingGongTags.oppositeTags[0] || '中性'}；三合${stage2.mingGongTags.trineTags[0] || '支撑一般'}`,
    },
    strengths: [
      ...(trineStrengths.length > 0 ? [`三合强旺：${trineStrengths[0]}`] : []),
      ...(stage2.mingGongHolographic.auspiciousEffect.includes('加持') ? [`吉星加持：${stage2.mingGongHolographic.auspiciousEffect.split('，')[0]}`] : []),
      ...(luCount > 0 ? [`化禄${luCount}颗：圆融顺畅`] : []),
      ...(quanCount > 0 ? [`化权${quanCount}颗：主导意识强`] : []),
    ],
    weaknesses: [
      ...(oppositeIssues.length > 0 ? [`对宫制约：${oppositeIssues[0]}`] : []),
      ...(stage2.mingGongHolographic.inauspiciousEffect.includes('干扰') ? [`煞星干扰：${stage2.mingGongHolographic.inauspiciousEffect.split('，')[0]}`] : []),
      ...(jiCount > 0 ? [`化忌${jiCount}颗：执念倾向`] : []),
    ],
    advice: {
      overall: `命宫全息底色为${stage2.mingGongHolographic.summary}，${stage2.overallTone}。建议注重${stage2.mingGongHolographic.auspiciousEffect.includes('加持') ? '发挥吉星优势' : '平衡性格双面性'}。`,
      career: quanCount > 0 ? '化权入命，适合主导型工作，可承担管理或决策角色' : luCount > 0 ? '化禄入命，适合人际协调型工作，财运亨通' : jiCount > 0 ? '化忌影响，宜选择稳定领域，避免激进决策' : '命局平稳，根据主星特质选择适合的发展方向',
      relationship: jiCount > 0 ? '情感表达需注意避免执着，多沟通理解' : luCount > 0 ? '人缘佳，感情发展顺畅，注意珍惜缘分' : '感情顺其自然，相互理解是长久之道',
      health: stage2.overallTone.includes('弱') ? '注意抵抗力培养，保持规律作息' : '精力充沛，注意劳逸结合',
    },
    knowledgeSnippets: stage2.knowledgeSnippets.map(s => ({
      source: s.source,
      key: s.key,
      content: s.content,
    })),
  }

  const route = routeMatter(opts.affairType, {})
  const stage3 = executeStage3({
    stage1,
    stage2,
    matterType: opts.affairType,
    routeResult: route,
    chartData,
    targetYear: opts.targetYear,
  })

  const affair = {
    overview: [
      `事项：${opts.affair}（${opts.affairType}）`,
      `主看宫：${stage3.primaryAnalysis.palace} — ${stage3.primaryAnalysis.fourDimensionResult}`,
      `命宫调节：${stage3.primaryAnalysis.mingGongRegulation}`,
      `格局保护：${stage3.primaryAnalysis.protectionStatus}`,
      `方向窗口：${stage3.directionWindow}；矩阵 ${JSON.stringify(stage3.directionMatrix)}`,
    ].join('\n'),
    conclusion: {
      probability: `${stage3.directionWindow}（由方向矩阵推导，非概率预测）`,
      opportunities: [
        `主看${stage3.primaryAnalysis.palace}`,
        ...route.secondaryPalaces.map(p => `兼看${p}`),
      ],
      obstacles:
        route.specialConditions.length > 0
          ? route.specialConditions
          : stage1.mergedSihua.specialOverlaps.map(o => `${o.type}：${o.star}`),
    },
    advice: {
      strategy: stage3.knowledgeSnippets.slice(0, 6).map(
        s => `[${s.source}/${s.key}] ${s.content.slice(0, 120)}`,
      ),
    },
  }

  const birthGan = stage1.scoringCtx.birthGan
  const taiSuiZhi = stage1.scoringCtx.taiSuiZhi
  const dunGanStem = getDunGan(birthGan, taiSuiZhi)

  const partnerYear = opts.partnerBirthYear ?? null
  const stage4 = executeStage4({
    stage1,
    stage2,
    partnerBirthYear: partnerYear,
    chartData,
    targetYear: opts.targetYear,
    focusContext: { matterType: opts.affairType, primaryPalace: route.primaryPalace },
  })

  const ir1: IRStage1 = {
    stage: 1,
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    hasParentInfo: stage1.hasParentInfo,
  }
  const ir2: IRStage2 = {
    stage: 2,
    mingGongTags: stage2.mingGongTags,
    shenGongTags: stage2.shenGongTags,
    taiSuiTags: stage2.taiSuiTags,
    overallTone: stage2.overallTone,
    mingGongHolographic: stage2.mingGongHolographic,
  }

  const prompts = {
    stage1: joinPromptPreview(ir1, stage1.knowledgeSnippets.map(s => s.content), '（排盘页调试）', STAGE1_HINT),
    stage2: joinPromptPreview(ir2, stage2.knowledgeSnippets.map(s => s.content), '（排盘页调试）', STAGE2_HINT),
    stage3: joinPromptPreview(
      buildStage3Ir(stage3),
      stage3.knowledgeSnippets.map(s => s.content),
      `（排盘页调试）${opts.affair}`,
      STAGE3_HINT,
    ),
    stage4: joinPromptPreview(
      buildStage4Ir(stage4),
      stage4.knowledgeSnippets.map(s => s.content),
      partnerYear ? `（排盘页调试）对方${partnerYear}年生` : '（排盘页调试）单方关系宫',
      STAGE4_HINT,
    ),
  }

  return {
    engine: 'hybrid-stages',
    patterns,
    dslPatternHits: dslHits.map(d => ({ id: d.id, name: d.name })),
    allPalaces,
    personality,
    affair,
    extended: {
      birthGan,
      taiSuiZhi,
      dunGanStem,
      shengNianSihua: {
        禄: String(stage1.mergedSihua.shengNian.禄),
        权: String(stage1.mergedSihua.shengNian.权),
        科: String(stage1.mergedSihua.shengNian.科),
        忌: String(stage1.mergedSihua.shengNian.忌),
      },
      taiSuiPalaceStemSihua: {
        禄: String(stage1.mergedSihua.dunGan.禄),
        权: String(stage1.mergedSihua.dunGan.权),
        科: String(stage1.mergedSihua.dunGan.科),
        忌: String(stage1.mergedSihua.dunGan.忌),
      },
      dunGanNote:
        '太岁宫宫干四化：太岁宫为生年地支所在宫，宫干由五虎遁（生年干起遁）定出，再查天干四化表；与文档中「遁干四化」所指之干一致，称谓不同。',
      mergedSihuaEntries: stage1.mergedSihua.entries.map(e => ({
        type: e.type,
        star: String(e.star),
        source: e.source,
      })),
      specialOverlaps: stage1.mergedSihua.specialOverlaps.map(o => ({
        type: o.type,
        star: String(o.star),
      })),
      threeLayerTable: stage3.threeLayerTable as unknown,
      taiSuiRua: {
        mode: partnerYear ? 'full' : 'solo',
        partnerYear,
        virtualChart: serializeVirtualChart(stage4.interaction.virtualChart),
        tensionPoints: stage4.interaction.tensionPoints,
      },
      prompts,
    },
  }
}
