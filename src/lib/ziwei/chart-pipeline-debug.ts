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
import { runCoreChartStages } from '@/core/pipeline/run-chart-stages'
import { evaluateJsonPatterns } from '@/core/adapters/iztro/patterns-dsl'
import { getPatternDefinition, getPatternMultiplier } from '@/core/energy-evaluator/patterns'
import {
  buildPrompt,
  buildChartSnapshotObject,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import type { TianGan, DiZhi, PalaceBrightness } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import type { VirtualChart } from '@/core/tai-sui-rua-gua/virtual-chart'
import { getWeakerBrightness } from '@/core/energy-evaluator/scoring-flow'
import { getFlankingDecay } from '@/core/knowledge-dict/query'
import { evaluateLimitPatterns } from '@/core/limit-analyzer/limit-pattern-evaluator'
import { getShengNianSihua, getDunGanSihua } from '@/core/sihua-calculator'
import { getDunGan, getSihuaTable } from '@/core/sihua-calculator/tables'
// getDunGan 也在 sihua-calculator/index 中 re-export，避免重复导入
import { yearToGan, yearToZhi, yearToZodiac } from '@/core/utils/gan-zhi'
import { resolveLiuNianGan } from '@/core/limit-analyzer/fortune-engine'
import type { LimitPatternsOutput, LimitPatternResult } from '@/core/types'

export interface ChartPipelineDebugOptions {
  /** 事项类型（与面板一致） */
  affairType: MatterType
  /** 事项描述 */
  affair: string
  /** 流年（事项分析） */
  targetYear: number
  /** 互动调试：对方生年；不传则阶段四走单方分析 */
  partnerBirthYear?: number | null
  /** 父母出生年份（可选，影响父母四化评分） */
  parentBirthYears?: { father?: number; mother?: number }
}

/** 与 `ziwei-analysis-panel` 格局列表展示兼容 */
export interface UiPatternRow {
  name: string
  category: string
  effect: 'positive' | 'negative' | 'mixed'
  source: string
  description: string
  level?: string
  /** 调试：格局判定详情 */
  debug?: {
    /** 成格所需的星曜组合 */
    requiredStars: string[]
    /** 星曜所在宫位（地支） */
    starPalaces: Record<string, string>
    /** 吉凶判定依据 */
    judgmentBasis: string
    /** 倍率取值来源 */
    multiplierSource: string
    /** 实际倍率值 */
    multiplierValue: number
    /** 引动条件说明 */
    triggerCondition: string
  }
}

export interface UiPalaceRow {
  palace: string
  diZhi: string
  level: string
  finalScore: number
  /** 调试：宫位计算详情 */
  debug?: {
    /** 骨架基础分 */
    skeletonScore: number
    /** 骨架分来源说明 */
    skeletonSource: string
    /** 天花板 */
    ceiling: number
    /** 加分总分 */
    bonusTotal: number
    /** 加分来源明细 */
    bonusBreakdown: Array<{ source: string; value: number; detail: string }>
    /** 减分总分 */
    penaltyTotal: number
    /** 减分来源明细 */
    penaltyBreakdown: Array<{ source: string; value: number; detail: string }>
    /** 禄存加减分 */
    luCunDelta: number
    /** 格局倍率 */
    patternMultiplier: number
    /** 格局倍率来源说明 */
    patternMultiplierSource: string
    /** 是否绝败 */
    isAbsoluteFail: boolean
    /** 临界状态 */
    criticalStatus: string
    /** 制煞能力 */
    subdueLevel: string
    /** 本宫主星 */
    majorStars: Array<{ star: string; brightness: string }>
    /** 本宫所有星曜（含辅星、四化） */
    allStars: Array<{ name: string; sihua?: string; sihuaSource?: string }>
    /** 计算公式说明 */
    formula: string
    /** 参与计算的宫位（三方四正+夹宫） */
    relatedPalaces: Array<{ palace: string; diZhi: string; role: string }>
    /** 锚定宫格局（以该宫为 anchor 时成格列表） */
    anchorPatterns?: Array<{ name: string; level: string; multiplier: number }>
    /** 六步评分流程（基于 scoring.json formula 部分） */
    sixSteps?: {
      /** 步骤0：空宫借对宫 */
      step0_emptyBorrow?: {
        isEmpty: boolean
        borrowedFrom?: string
        borrowDepth?: number
        borrowFactor?: number
      }
      /** 步骤1：初始基础分 */
      step1_skeleton: {
        baseScore: number
        ceiling: number
        brightness: string
      }
      /** 步骤2：加分阶段 */
      step2_bonus: {
        scoreAfterBonus: number
        details: {
          '2.1_三方四正吉星': number
          '2.2_命主生年化禄': number
          '2.3_命主遁干化禄': number
          '2.4_父亲生年化禄': number
          '2.5_父亲遁干化禄': number
          '2.6_母亲生年化禄': number
          '2.7_母亲遁干化禄': number
          '2.8_吉格倍率': number
        }
        /** 2.1-2.7 原始总和（不含倍率） */
        sumBonus: number
        /** 吉格倍率 G（同 details['2.8_吉格倍率']） */
        G: number
      }
      /** 步骤3：重新定性 */
      step3_warmCool: {
        label: string
      }
      /** 步骤4：减分阶段（v2.3：化忌拆分为6个独立项） */
      step4_penalty: {
        scoreAfterPenalty: number
        details: {
          '4.1_三方四正煞星': number
          '4.2_命主生年化忌': number
          '4.3_命主遁干化忌': number
          '4.4_父亲生年化忌': number
          '4.5_父亲遁干化忌': number
          '4.6_母亲生年化忌': number
          '4.7_母亲遁干化忌': number
          '4.8_凶格倍率': number
        }
        intensityFactor: number
        /** 4.1-4.7 原始总和（不含倍率） */
        sumPenalty: number
        /** 凶格倍率 H（同 details['4.8_凶格倍率']） */
        H: number
      }
      /** 步骤5：禄存调整 */
      step5_luCun: {
        scoreAfterLuCun: number
        delta: number
      }
      /** 步骤6：天花板截断与强制绝败 */
      step6_ceiling: {
        finalScore: number
        isAbsoluteFail: boolean
        specialFlags: string[]
      }
    }
  }
}

export interface UiLimitPatternRow {
  /** 运限类型 */
  limitType: string
  /** 运限标识 */
  limitLabel: string
  /** 运限命宫地支 */
  mingPalaceZhi: string
  /** 运限天干 */
  limitGan: string
  /** 匹配到的格局 */
  patterns: UiPatternRow[]
  /** 与原局格局对比 */
  comparison?: {
    natalPatternCount: number
    newPatternCount: number
    lostPatternCount: number
    sustainedPatternCount: number
    conclusion: string
  }
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
    /** 命宫能级评分 */
    mingGongScore: number
    scoreLevel: string
    scoreInfluence: string
    /** 格局影响 */
    patternInfluences: string[]
    /** 三方四正交互 */
    trineInteraction: string
    oppositeInteraction: string
    /** 夹宫影响 */
    flankingInfluence: string
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
  /** 运限格局识别结果 */
  limitPatterns: {
    /** 原局格局 */
    natal: UiPatternRow[]
    /** 十大限格局 */
    decadal: UiLimitPatternRow[]
    /** 流年格局 */
    yearly: UiLimitPatternRow[]
    /** 综合分析 */
    synthesis: {
      trend: string
      keyDecennials: string[]
      peakYears: number[]
    }
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
  /** 父母四化元数据（干支 + 化禄/化忌/遁干星名） */
  parentSihuaMeta?: {
    father?: { year: number; gan: string; zhi: string; zodiac: string; luStar: string; jiStar: string; dunGan: string; dunLuStar: string; dunJiStar: string }
    mother?: { year: number; gan: string; zhi: string; zodiac: string; luStar: string; jiStar: string; dunGan: string; dunLuStar: string; dunJiStar: string }
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

function buildStage3Ir(
  output: Stage3Output,
  chartData: Record<string, unknown>,
  targetYear: number,
  stage1Ref: { palaceScores: import('@/core/types').PalaceScore[]; allPatterns: import('@/core/types').PatternMatch[]; mergedSihua: import('@/core/types').MergedSihua; scoringCtx?: import('@/core/llm-wrapper/prompt-builder').ChartSnapshotCtx & { taiSuiZhi?: string; birthGan?: string } },
): IRStage3or4 {
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
      liuNianGan: resolveLiuNianGan(chartData, targetYear),
      sihuaPositions: [],
      direction: output.directionMatrix[1] === '吉' ? '吉' : '凶',
      daXianRelation: output.directionMatrix,
      window: output.directionWindow,
    },
    palaceScores: stage1Ref.palaceScores,
    allPatterns: stage1Ref.allPatterns,
    mergedSihua: stage1Ref.mergedSihua,
    chartSnapshot: buildChartSnapshotObject(chartData, stage1Ref.scoringCtx),
  }
}

function buildStage4Ir(
  output: Stage4Output,
  chartData: Record<string, unknown>,
  targetYear: number,
  stage1Ref: { palaceScores: import('@/core/types').PalaceScore[]; allPatterns: import('@/core/types').PatternMatch[]; mergedSihua: import('@/core/types').MergedSihua; scoringCtx?: import('@/core/llm-wrapper/prompt-builder').ChartSnapshotCtx & { taiSuiZhi?: string; birthGan?: string } },
): IRStage3or4 {
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
      liuNianGan: resolveLiuNianGan(chartData, targetYear),
      sihuaPositions: [],
      direction: '吉',
      daXianRelation: '吉吉',
      window: '推进窗口',
    },
    palaceScores: stage1Ref.palaceScores,
    allPatterns: stage1Ref.allPatterns,
    mergedSihua: stage1Ref.mergedSihua,
    chartSnapshot: buildChartSnapshotObject(chartData, stage1Ref.scoringCtx),
  }
}

/**
 * 基于与 Hybrid 相同的 `chartData`（serializeAstrolabeForReading）构建调试快照。
 */
export function buildChartPipelineDebugSnapshot(
  chartData: Record<string, unknown>,
  opts: ChartPipelineDebugOptions,
): ChartPipelineDebugSnapshot {
  const { stage1, stage2, stage3, stage4, route } = runCoreChartStages(chartData, {
    question: opts.affair || '性格与事项调试',
    matterType: opts.affairType,
    targetYear: opts.targetYear,
    partnerBirthYear: opts.partnerBirthYear,
    parentBirthYears: opts.parentBirthYears,
  })

  // ═══════════════════════════════════════════════════════════════════
  // 运限格局识别
  // ═══════════════════════════════════════════════════════════════════
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const gender = birthInfo?.gender === '女' ? '女' : '男'

  const limitPatternsOutput = evaluateLimitPatterns({
    natalCtx: stage1.scoringCtx,
    chartData,
    birthYear,
    gender,
    targetYears: [opts.targetYear - 2, opts.targetYear - 1, opts.targetYear, opts.targetYear + 1, opts.targetYear + 2],
  })

  // 转换运限格局为 UI 格式
  const uiLimitPatternRow = (lp: LimitPatternResult): UiLimitPatternRow => ({
    limitType: lp.limitType,
    limitLabel: lp.limitLabel,
    mingPalaceZhi: lp.mingPalaceZhi,
    limitGan: lp.limitGan,
    patterns: lp.patterns.map(p => ({
      name: p.name,
      category: p.category || '格局',
      effect: patternLevelToEffect(p.level),
      source: lp.limitType === '大限' ? 'decennial' : lp.limitType === '流年' ? 'yearly' : 'minor',
      description: `${p.level}（倍率×${p.multiplier}）`,
      level: p.level,
      debug: {
        requiredStars: [p.name],
        starPalaces: {},
        judgmentBasis: `${p.level}（${p.category}类）｜运限：${lp.limitLabel}`,
        multiplierSource: `运限格局倍率：${p.level} → ×${p.multiplier}`,
        multiplierValue: p.multiplier,
        triggerCondition: `运限天干${lp.limitGan}四化引动`,
      },
    })),
    comparison: lp.comparisonWithNatal,
  })

  const limitPatterns = {
    natal: limitPatternsOutput.natalPatterns.map(p => ({
      name: p.name,
      category: p.category || '格局',
      effect: patternLevelToEffect(p.level),
      source: 'natal',
      description: `${p.level}（倍率×${p.multiplier}）`,
      level: p.level,
      debug: {
        requiredStars: [p.name],
        starPalaces: {},
        judgmentBasis: `${p.level}（${p.category}类）｜原局格局`,
        multiplierSource: `原局格局倍率：${p.level} → ×${p.multiplier}`,
        multiplierValue: p.multiplier,
        triggerCondition: '原局星曜组合成格',
      },
    })),
    decadal: limitPatternsOutput.decadalPatterns.map(uiLimitPatternRow),
    yearly: limitPatternsOutput.yearlyPatterns.map(uiLimitPatternRow),
    synthesis: limitPatternsOutput.synthesis,
  }

  const matchedNames = new Set(stage1.allPatterns.map(p => p.name))
  const starsByPalaceIndex = stage1.scoringCtx.palaces.map(p => p.majorStars.map(s => String(s)))
  const dslHits = evaluateJsonPatterns({ starsByPalaceIndex, matchedPatternNames: matchedNames })

  // 构建格局调试数据：查找每个格局的星曜所在宫位
  const patterns: UiPatternRow[] = stage1.allPatterns.map(p => {
    const def = getPatternDefinition(p.name)
    const multiplierFromJson = getPatternMultiplier(p.level)

    // 从 pattern_library.json patterns[name].description 提取星曜名称
    const description = def && 'description' in def ? String(def.description) : ''
    const triggerFromJson = def && 'trigger' in def ? String(def.trigger) : ''

    // 从 description 中提取星曜名称（紫微斗数主星+辅星+四化名）
    const starNameRegex = /紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|左辅|右弼|文昌|文曲|天魁|天钺|禄存|擎羊|陀罗|火星|铃星|地空|地劫|化禄|化权|化科|化忌/g
    const extractedStars = Array.from(new Set(description.match(starNameRegex) || []))

    // 从 scoringCtx 查找格局相关星曜的宫位
    const starPalaces: Record<string, string> = {}
    const requiredStars: string[] = extractedStars.length > 0 ? extractedStars : ['（从 pattern_library.json description 中未提取到星曜）']

    // 遍历所有宫位，查找提取到的星曜
    for (const palace of stage1.scoringCtx.palaces) {
      for (const star of palace.stars) {
        if (extractedStars.includes(star.name)) {
          starPalaces[star.name] = palace.diZhi
        }
      }
      for (const ms of palace.majorStars) {
        const starName = String(ms.star)
        if (extractedStars.includes(starName)) {
          starPalaces[starName] = palace.diZhi
        }
      }
    }

    // 构建引动条件说明（优先用 JSON 中的 trigger，否则用 MD 文档说明）
    const triggerCondition = triggerFromJson || '详见 SKILL_宫位原生能级评估_V3.0.md 格局库章节'

    // 吉凶依据：明确说明来源
    const judgmentBasis = `${p.level}（${p.category}类）｜来源：data/pattern_library.json patterns["${p.name}"]｜SKILL_宫位原生能级评估_V3.0.md 格局库「${p.name}」条`

    // 倍率来源：明确说明来源
    const multiplierSource = `data/pattern_library.json → multipliers["${p.level}"] = ${multiplierFromJson}｜SKILL_宫位原生能级评估_V3.0.md：${p.level}格局倍率×${multiplierFromJson}`

    return {
      name: p.name,
      category: p.category || '格局',
      effect: patternLevelToEffect(p.level),
      source: 'natal',
      description: `${p.level}（倍率×${p.multiplier}）`,
      level: p.level,
      debug: {
        requiredStars,
        starPalaces,
        judgmentBasis,
        multiplierSource,
        multiplierValue: p.multiplier,
        triggerCondition,
      },
    }
  })

  // 构建宫位调试数据
  const allPalaces: Record<string, UiPalaceRow> = {}
  for (const ps of stage1.palaceScores) {
    // 找到对应的宫位上下文
    const palaceCtx = stage1.scoringCtx.palaces.find(p => p.diZhi === ps.diZhi)

    // 构建相关宫位（三方四正+夹宫）
    const palaceIndex = stage1.scoringCtx.palaces.findIndex(p => p.diZhi === ps.diZhi)
    const relatedPalaces: Array<{ palace: string; diZhi: string; role: string }> = []

    if (palaceIndex >= 0) {
      const oppositeIdx = (palaceIndex + 6) % 12
      const trine1 = (palaceIndex + 4) % 12
      const trine2 = (palaceIndex + 8) % 12
      const flankLeft = (palaceIndex + 1) % 12
      const flankRight = (palaceIndex - 1 + 12) % 12

      const roles = [
        { idx: palaceIndex, role: '本宫' },
        { idx: oppositeIdx, role: '对宫' },
        { idx: trine1, role: '三合1' },
        { idx: trine2, role: '三合2' },
        { idx: flankLeft, role: '夹宫左' },
        { idx: flankRight, role: '夹宫右' },
      ]

      for (const r of roles) {
        const p = stage1.scoringCtx.palaces[r.idx]
        if (p) {
          relatedPalaces.push({
            palace: p.palaceIndex !== undefined
              ? ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'][p.palaceIndex] || '?'
              : '?',
            diZhi: p.diZhi,
            role: r.role,
          })
        }
      }
    }

    // 构建骨架分来源说明
    const skeletonSource = `SKILL_宫位原生能级评估_V3.0.md 骨架映射库：${ps.palace}·${ps.diZhi} 主星状态→初始基础分${ps.skeletonScore.toFixed(1)}，天花板${ps.ceiling.toFixed(1)}`

    // 构建加分来源明细（从 palaceCtx 的 stars 中提取）
    const bonusBreakdown: Array<{ source: string; value: number; detail: string }> = []
    const penaltyBreakdown: Array<{ source: string; value: number; detail: string }> = []

    // 减分阶段使用 intensityFactor（与 scoring-flow.ts step4 一致）
    const intensityFactor = (() => {
      const map: Record<string, number> = { '旺': 0.3, '旺偏磨炼': 0.5, '平': 0.7, '虚浮': 1.0, '凶危': 1.5 }
      return map[ps.warmCoolLabel] ?? 0.7
    })()

    if (palaceCtx) {
      // 扫描三方四正相关宫位（本宫+对宫+三合）
      const sanfangIndices = [palaceIndex, (palaceIndex + 6) % 12, (palaceIndex + 4) % 12, (palaceIndex + 8) % 12]
      const sanfangRoles = ['本宫', '对宫', '三合1', '三合2']
      const sanfangCoeffs = [1.0, 0.8, 0.7, 0.7]

      for (let i = 0; i < sanfangIndices.length; i++) {
        const idx = sanfangIndices[i]
        const p = stage1.scoringCtx.palaces[idx]
        if (!p) continue

        for (const star of p.stars) {
          const isJi = ['化禄', '左辅', '右弼', '文昌', '文曲', '天魁', '天钺'].includes(star.name)
          const isSha = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '化忌'].includes(star.name)

          if (isJi) {
            const val = 0.5 * sanfangCoeffs[i]
            bonusBreakdown.push({
              source: `${sanfangRoles[i]}·${p.diZhi}`,
              value: val,
              detail: `${star.name}（${star.name === '化禄' ? '四化' : '吉星'}）× ${sanfangCoeffs[i]}衰减 = +${val.toFixed(2)}`,
            })
          } else if (isSha) {
            const baseVal = -0.5 * sanfangCoeffs[i]
            const val = baseVal * intensityFactor
            penaltyBreakdown.push({
              source: `${sanfangRoles[i]}·${p.diZhi}`,
              value: val,
              detail: `${star.name}（煞星）× ${sanfangCoeffs[i]}衰减 × ${intensityFactor}强度 = ${val.toFixed(2)}`,
            })
          }
        }
      }

      // 夹宫处理：只有成对出现时才显示，使用动态衰减系数
      const flankLeftIdx = (palaceIndex + 1) % 12
      const flankRightIdx = (palaceIndex - 1 + 12) % 12
      const leftPalace = stage1.scoringCtx.palaces[flankLeftIdx]
      const rightPalace = stage1.scoringCtx.palaces[flankRightIdx]

      if (leftPalace && rightPalace) {
        const leftStars = new Set(leftPalace.stars.map(s => s.name))
        const rightStars = new Set(rightPalace.stars.map(s => s.name))

        // 计算动态衰减系数
        const selfPalace = stage1.scoringCtx.palaces[palaceIndex]
        const selfBrightness = (selfPalace?.brightness ?? '平') as PalaceBrightness
        const flankBrightness = getWeakerBrightness(
          (leftPalace.brightness ?? '平') as PalaceBrightness,
          (rightPalace.brightness ?? '平') as PalaceBrightness
        )
        const decay = getFlankingDecay(selfBrightness, flankBrightness)

        // 吉夹检查（含反向）
        const jiPairs = [
          { name: '昌曲夹', left: '文昌', right: '文曲' },
          { name: '魁钺夹', left: '天魁', right: '天钺' },
          { name: '左右夹', left: '左辅', right: '右弼' },
          { name: '紫府夹', left: '紫微', right: '天府' },
        ]
        for (const pair of jiPairs) {
          const forward = leftStars.has(pair.left) && rightStars.has(pair.right)
          const reverse = leftStars.has(pair.right) && rightStars.has(pair.left)
          if (forward || reverse) {
            const val = 0.5 * decay // 使用动态衰减系数
            bonusBreakdown.push({
              source: `夹宫·${leftPalace.diZhi}-${rightPalace.diZhi}`,
              value: val,
              detail: `${pair.name}（${forward ? pair.left + '·' + pair.right : pair.right + '·' + pair.left}）× ${decay}衰减 = +${val.toFixed(2)}`,
            })
          }
        }

        // 煞夹检查（含反向）
        const shaPairs = [
          { name: '羊陀夹', left: '擎羊', right: '陀罗' },
          { name: '空劫夹', left: '地空', right: '地劫' },
          { name: '火铃夹', left: '火星', right: '铃星' },
        ]
        for (const pair of shaPairs) {
          const forward = leftStars.has(pair.left) && rightStars.has(pair.right)
          const reverse = leftStars.has(pair.right) && rightStars.has(pair.left)
          if (forward || reverse) {
            const baseVal = -0.5 * decay // 使用动态衰减系数
            const val = baseVal * intensityFactor
            penaltyBreakdown.push({
              source: `夹宫·${leftPalace.diZhi}-${rightPalace.diZhi}`,
              value: val,
              detail: `${pair.name}（${forward ? pair.left + '·' + pair.right : pair.right + '·' + pair.left}）× ${decay}衰减 × ${intensityFactor}强度 = ${val.toFixed(2)}`,
            })
          }
        }
      }
    }

    // 构建禄存加分说明
    if (ps.luCunDelta !== 0) {
      const luCunTier = ps.luCunDelta >= 0.5
        ? '旺宫'
        : ps.luCunDelta >= 0.3
          ? '平宫/旺偏磨炼'
          : '陷宫/虚浮/凶危'
      const luCunDesc = `禄存专项（${luCunTier}）：+${ps.luCunDelta.toFixed(1)}（第五步：旺+0.5/平+0.3/陷+0.1）`
      bonusBreakdown.push({
        source: '禄存专项',
        value: ps.luCunDelta,
        detail: luCunDesc,
      })
    }

    // 锚定宫格局：以该宫为 anchor 时匹配到的格局列表
    const anchorPatterns = palaceIndex >= 0
      ? (stage1.scoringCtx.palacePatterns?.[palaceIndex] ?? [])
      : []

    const patternMultiplierSource = anchorPatterns.length > 0
      ? `锚定宫格局：${anchorPatterns.map(pat => `${pat.name}（${pat.level}×${pat.multiplier}）`).join('、')}｜来源：data/pattern_library.json multipliers + SKILL_宫位原生能级评估_V3.0.md`
      : '无锚定宫格局加成（倍率×1.0）｜来源：data/pattern_library.json multipliers 默认值为1.0'

    // 构建公式说明（SKILL_V3.0：反映实际计算链）
    // 实际计算：scoreStep2 = (S0 + sumBonus) × G；scoreStep4 = (scoreStep2 + sumPenalty) × H
    const sumBonus = Math.round(
      Object.entries(ps.bonusDetails)
        .filter(([k]) => k !== '2.8_吉格倍率')
        .reduce((sum, [, v]) => sum + v, 0) * 100,
    ) / 100
    const sumPenalty = Math.round(
      Object.entries(ps.penaltyDetails)
        .filter(([k]) => k !== '4.8_凶格倍率')
        .reduce((sum, [, v]) => sum + v, 0) * 100,
    ) / 100
    const G = ps.bonusDetails['2.8_吉格倍率']
    const H = ps.penaltyDetails['4.8_凶格倍率']

    const formula = [
      `加分后 = (${ps.skeletonScore.toFixed(1)} + ${sumBonus.toFixed(2)}) × ${G.toFixed(1)} = ${ps.scoreAfterBonus.toFixed(2)}`,
      `减分后 = (${ps.scoreAfterBonus.toFixed(2)} + ${sumPenalty.toFixed(2)}) × ${H.toFixed(1)} = ${ps.scoreAfterPenalty.toFixed(2)}`,
      `禄存后 = ${ps.scoreAfterPenalty.toFixed(2)} + ${ps.luCunDelta.toFixed(1)} = ${ps.scoreAfterLuCun.toFixed(2)}`,
      `最终分 = min(${ps.scoreAfterLuCun.toFixed(2)}, ${ps.ceiling.toFixed(1)}) = ${ps.finalScore.toFixed(2)}`,
    ].join('\n')

    // 构建六步评分流程数据
    const sixSteps = {
      step0_emptyBorrow: {
        isEmpty: ps.majorStars.length === 0,
        borrowedFrom: ps.majorStars.length === 0 ? (palaceCtx ? `对宫${stage1.scoringCtx.palaces[(palaceIndex + 6) % 12]?.diZhi}` : undefined) : undefined,
        borrowDepth: ps.majorStars.length === 0 ? 1 : 0,
        borrowFactor: ps.majorStars.length === 0 ? 0.5 : 1.0,
      },
      step1_skeleton: {
        baseScore: ps.skeletonScore,
        ceiling: ps.ceiling,
        brightness: ps.majorStars.length === 0 ? '空' : (ps.majorStars[0]?.brightness ?? '平'),
      },
      step2_bonus: {
        scoreAfterBonus: ps.scoreAfterBonus,
        details: ps.bonusDetails,
        sumBonus,
        G,
        starList: bonusBreakdown.map(b => ({
          source: b.source,
          starName: b.detail.split('（')[0]?.trim() || b.source,
          value: b.value,
          detail: b.detail,
        })),
      },
      step3_warmCool: {
        label: ps.warmCoolLabel,
      },
      step4_penalty: {
        scoreAfterPenalty: ps.scoreAfterPenalty,
        details: ps.penaltyDetails,
        intensityFactor: (() => {
          const map: Record<string, number> = { '旺': 0.3, '旺偏磨炼': 0.5, '平': 0.7, '虚浮': 1.0, '凶危': 1.5 }
          return map[ps.warmCoolLabel] ?? 0.7
        })(),
        sumPenalty,
        H,
        starList: penaltyBreakdown.map(p => ({
          source: p.source,
          starName: p.detail.split('（')[0]?.trim() || p.source,
          value: p.value,
          detail: p.detail,
        })),
      },
      step5_luCun: {
        scoreAfterLuCun: ps.scoreAfterLuCun,
        delta: ps.luCunDelta,
      },
      step6_ceiling: {
        finalScore: ps.finalScore,
        isAbsoluteFail: ps.isAbsoluteFail,
        specialFlags: ps.specialFlags,
      },
    }

    allPalaces[ps.diZhi] = {
      palace: ps.palace,
      diZhi: ps.diZhi,
      level: ps.tone,
      finalScore: ps.finalScore,
      debug: {
        skeletonScore: ps.skeletonScore,
        skeletonSource,
        ceiling: ps.ceiling,
        bonusTotal: ps.bonusTotal,
        bonusBreakdown,
        penaltyTotal: ps.penaltyTotal,
        penaltyBreakdown,
        luCunDelta: ps.luCunDelta,
        patternMultiplier: ps.patternMultiplier,
        patternMultiplierSource,
        isAbsoluteFail: ps.isAbsoluteFail,
        criticalStatus: ps.criticalStatus,
        subdueLevel: ps.subdueLevel,
        majorStars: ps.majorStars.map(ms => ({ star: String(ms.star), brightness: ms.brightness })),
        allStars: palaceCtx?.stars.map(s => ({
          name: s.name,
          sihua: s.sihua,
          sihuaSource: s.sihuaSource,
        })) ?? [],
        formula,
        relatedPalaces,
        anchorPatterns: anchorPatterns.map(p => ({
          name: p.name,
          level: p.level,
          multiplier: p.multiplier,
        })),
        sixSteps,
      },
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

  // ═══════════════════════════════════════════════════════════════════
  // 新增：整合 Stage1 格局 + 宫位能级 + 三方四正 + 夹宫 到性格分析
  // ═══════════════════════════════════════════════════════════════════

  const mingIdx = 0
  const shenIdx = stage2.shenGongIndex ?? 6
  const taiSuiIdx = stage2.taiSuiIndex ?? 0

  // 1. 三宫能级评分（命宫 + 身宫 + 太岁宫）
  const getScoreLevel = (score: number) => score >= 7 ? '强旺' : score >= 5 ? '中等' : score >= 3 ? '虚浮' : '凶危'
  const getScoreInfluence = (score: number, palaceName: string) => score >= 7
    ? `${palaceName}强旺，性格特质明显且稳定，主见坚定`
    : score >= 5
      ? `${palaceName}中等，性格有发展空间，可塑性强`
      : score >= 3
        ? `${palaceName}虚浮，性格易受外界影响，缺乏核心定力`
        : `${palaceName}凶危，性格存在明显短板，需特别注意`

  const mingGongScore = stage1.palaceScores[mingIdx]?.finalScore ?? 5
  const scoreLevel = getScoreLevel(mingGongScore)
  const scoreInfluence = getScoreInfluence(mingGongScore, '命宫')

  const shenGongScore = stage1.palaceScores[shenIdx]?.finalScore ?? 5
  const shenScoreLevel = getScoreLevel(shenGongScore)
  const shenScoreInfluence = getScoreInfluence(shenGongScore, '身宫')

  const taiSuiScore = stage1.palaceScores[taiSuiIdx]?.finalScore ?? 5
  const taiSuiScoreLevel = getScoreLevel(taiSuiScore)
  const taiSuiScoreInfluence = getScoreInfluence(taiSuiScore, '太岁宫')

  // 三宫能级综合
  const avgScore = (mingGongScore + shenGongScore + taiSuiScore) / 3
  const threePalaceScoreSynthesis = avgScore >= 6.0
    ? `三宫均强旺（命宫${mingGongScore.toFixed(1)} / 身宫${shenGongScore.toFixed(1)} / 太岁宫${taiSuiScore.toFixed(1)}）— 主见坚定，意志力强，性格特质显化程度高`
    : mingGongScore >= 6.0 && (shenGongScore < 4.5 || taiSuiScore < 4.5)
      ? `表强里弱（命宫${mingGongScore.toFixed(1)} / 身宫${shenGongScore.toFixed(1)} / 太岁宫${taiSuiScore.toFixed(1)}）— 外显强势但内核动摇，需加强内在修养`
      : mingGongScore < 4.5 && shenGongScore >= 6.0 && taiSuiScore >= 6.0
        ? `表弱里强（命宫${mingGongScore.toFixed(1)} / 身宫${shenGongScore.toFixed(1)} / 太岁宫${taiSuiScore.toFixed(1)}）— 外显柔和但有韧性，内在潜能充足`
        : avgScore < 4.5
          ? `三宫均弱（命宫${mingGongScore.toFixed(1)} / 身宫${shenGongScore.toFixed(1)} / 太岁宫${taiSuiScore.toFixed(1)}）— 易受外界影响，性格显化程度低，需借助后天努力`
          : `三宫混杂（命宫${mingGongScore.toFixed(1)} / 身宫${shenGongScore.toFixed(1)} / 太岁宫${taiSuiScore.toFixed(1)}）— 逐宫分析，内外层存在落差`

  // 2. 命宫成格格局 → 性格底色影响（命宫锚定格局）
  const mingGongPatterns = stage1.scoringCtx.palacePatterns?.[mingIdx] ?? stage1.allPatterns

  const patternInfluences = mingGongPatterns.length > 0
    ? mingGongPatterns.map(p => {
        const def = getPatternDefinition(p.name)
        const desc = String(def?.description || '')
        const effect = p.level.includes('吉')
          ? `增强${desc.includes('贵') ? '贵气与领导力' : desc.includes('富') ? '财运与圆融' : '正面特质与机遇'}
            ${p.level === '大吉' ? '，影响深远且稳定' : p.level === '中吉' ? '，影响显著' : '，影响温和'}
          `
          : p.level.includes('凶')
            ? `带来${desc.includes('破') ? '破耗与变动' : desc.includes('劫') ? '波折与挑战' : '挑战与考验'}
              ${p.level === '大凶' ? '，影响剧烈需化解' : p.level === '中凶' ? '，影响明显需留意' : '，影响轻微可调和'}
            `
            : '中性影响，需结合其他因素判断'
        return `${p.name}（${p.level}·倍率×${p.multiplier}）：${effect}`
      })
    : ['命宫无成格格局，性格由主星和四化主导']

  // 3. 三方四正星曜交互分析（含主星 + 四化 + 吉煞）
  const trineIndices = [mingIdx, (mingIdx + 4) % 12, (mingIdx + 8) % 12]
  const trineMajorStars = new Set<string>()
  const trineSihuaList: string[] = []
  const auspiciousStarNames = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'])
  const inauspiciousStarNames = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'])
  let trineAuspiciousCount = 0
  let trineInauspiciousCount = 0

  for (const idx of trineIndices) {
    const palace = stage1.scoringCtx.palaces[idx]
    if (!palace) continue
    palace.majorStars.forEach(ms => trineMajorStars.add(String(ms.star)))
    palace.stars.forEach(s => {
      if (s.sihua) trineSihuaList.push(`${s.sihua}${s.name}`)
      if (auspiciousStarNames.has(s.name)) trineAuspiciousCount++
      if (inauspiciousStarNames.has(s.name)) trineInauspiciousCount++
    })
  }

  const trineInteraction = trineMajorStars.size >= 3
    ? `三方会照星曜丰富（${Array.from(trineMajorStars).join('、')}），性格多面且复杂，既有${Array.from(trineMajorStars)[0]}的特质，又受${Array.from(trineMajorStars)[1]}影响，形成独特的复合型性格`
    : `三方会照星曜较少（${Array.from(trineMajorStars).join('、') || '无'}），性格相对单纯，特质集中且明确`

  // 三方四正四化流转
  const trineSihuaFlow = trineSihuaList.length > 0
    ? `三方四正四化流转：${trineSihuaList.join('、')}。${trineSihuaList.some(s => s.includes('化忌')) ? '有化忌介入，性格中存在执念与纠结面' : trineSihuaList.some(s => s.includes('化禄')) ? '有化禄加持，性格圆融通达' : '四化影响中性，性格发展平稳'}`
    : '三方四正无四化介入，性格发展不受四化特殊影响'

  // 三方四正吉煞分布
  const trineAuspiciousInauspicious = trineAuspiciousCount > 0 || trineInauspiciousCount > 0
    ? `三方四正吉星${trineAuspiciousCount}颗，煞星${trineInauspiciousCount}颗。${trineAuspiciousCount > trineInauspiciousCount ? '吉星占优，性格稳定性强，遇事多得助力' : trineInauspiciousCount > trineAuspiciousCount ? '煞星偏多，性格中带有挑战与磨砺特质，抗压能力强但易有波折' : '吉凶平衡，性格中既有圆融面也有磨砺面，发展较为全面'}`
    : '三方四正无特殊吉煞影响'

  // 4. 对宫星曜交互
  const oppositeIdx = (mingIdx + 6) % 12
  const oppositeMajorStars = stage1.scoringCtx.palaces[oppositeIdx]?.majorStars || []
  const oppositeSihua = stage1.scoringCtx.palaces[oppositeIdx]?.stars.filter(s => s.sihua).map(s => `${s.sihua}${s.name}`) ?? []
  const oppositeInteraction = oppositeMajorStars.length > 0
    ? `对宫（迁移/外在）有${oppositeMajorStars.map(ms => `${ms.star}(${ms.brightness})`).join('、')}投射${oppositeSihua.length > 0 ? '，附带' + oppositeSihua.join('、') : ''}，外在表现${oppositeMajorStars.some(ms => ['旺', '庙'].includes(ms.brightness)) ? '强势且自信' : '较为内敛'}，与内在性格形成${oppositeMajorStars.length >= 2 ? '复杂对比' : '一定反差'}`
    : '对宫无主星，外在表现较为直接，与内在性格基本一致'

  // 5. 夹宫影响分析（双侧 + 单侧）
  const leftFlankIdx = (mingIdx + 1) % 12
  const rightFlankIdx = (mingIdx - 1 + 12) % 12
  const leftFlank = stage1.scoringCtx.palaces[leftFlankIdx]
  const rightFlank = stage1.scoringCtx.palaces[rightFlankIdx]

  const flankingInfluence = (() => {
    if (!leftFlank || !rightFlank) return '夹宫数据不完整'

    const leftStars = new Set(leftFlank.stars.map(s => s.name))
    const rightStars = new Set(rightFlank.stars.map(s => s.name))

    // 吉夹
    const jiPairs = [
      { name: '昌曲夹', left: '文昌', right: '文曲', effect: '聪明机智，文采出众，学习能力强，思维敏捷' },
      { name: '魁钺夹', left: '天魁', right: '天钺', effect: '贵人运强，逢凶化吉，人缘极佳，易得助力' },
      { name: '左右夹', left: '左辅', right: '右弼', effect: '辅助力强，人缘极佳，善于协调，团队合作佳' },
      { name: '紫府夹', left: '紫微', right: '天府', effect: '贵气天成，领导力强，稳重有魄力，事业易成' },
    ]
    for (const pair of jiPairs) {
      if ((leftStars.has(pair.left) && rightStars.has(pair.right)) ||
          (leftStars.has(pair.right) && rightStars.has(pair.left))) {
        return `${pair.name}：${pair.effect}`
      }
    }

    // 煞夹
    const shaPairs = [
      { name: '羊陀夹', left: '擎羊', right: '陀罗', effect: '性格急躁，易有波折，行事冲动，需注意情绪管理' },
      { name: '空劫夹', left: '地空', right: '地劫', effect: '思想独特，但易有虚无感，理想主义，需脚踏实地' },
      { name: '火铃夹', left: '火星', right: '铃星', effect: '脾气急躁，行动力强但易冲动，爆发力强但持久性弱' },
    ]
    for (const pair of shaPairs) {
      if ((leftStars.has(pair.left) && rightStars.has(pair.right)) ||
          (leftStars.has(pair.right) && rightStars.has(pair.left))) {
        return `${pair.name}：${pair.effect}`
      }
    }

    return '无特殊夹宫影响，性格发展较为平顺'
  })()

  // 单侧夹宫分析
  const singleFlankingInfluence = (() => {
    if (!leftFlank || !rightFlank) return '夹宫数据不完整'
    const leftStarNames = leftFlank.stars.map(s => s.name)
    const rightStarNames = rightFlank.stars.map(s => s.name)
    const leftHas = leftFlank.majorStars.length > 0 || leftStarNames.length > 0
    const rightHas = rightFlank.majorStars.length > 0 || rightStarNames.length > 0

    if (leftHas && rightHas) return '双侧夹宫均有星曜，已在上文分析'
    if (!leftHas && !rightHas) return '双侧夹宫均无星曜，无单侧夹宫影响'

    const side = leftHas ? '左' : '右'
    const flank = leftHas ? leftFlank : rightFlank
    const stars = [...flank.majorStars.map(ms => ms.star), ...flank.stars.map(s => s.name)]
    const auspicious = flank.stars.some(s => auspiciousStarNames.has(s.name))
    const inauspicious = flank.stars.some(s => inauspiciousStarNames.has(s.name))

    return `${side}侧夹宫有${stars.join('、')}，形成偏夹之势。${auspicious && !inauspicious ? '吉星偏夹，性格中该侧特质较为突出，易得该方向助力' : inauspicious && !auspicious ? '煞星偏夹，性格中该侧易受干扰，需注意该方向挑战' : '吉凶混杂偏夹，性格中该侧特质复杂，既有助力也有挑战'}`
  })()

  // 6. 四化性格特质映射
  const sihuaPersonalityTraits = (() => {
    const traits: string[] = []
    const mingSihua = stage1.scoringCtx.palaces[mingIdx]?.stars.filter(s => s.sihua) ?? []

    for (const s of mingSihua) {
      switch (s.sihua) {
        case '化禄':
          traits.push(`${s.name}化禄：圆融随和，人缘佳，对${s.name}所主事项有天然亲和力`)
          break
        case '化权':
          traits.push(`${s.name}化权：主导意识强，有掌控欲，对${s.name}所主事项追求主导权`)
          break
        case '化科':
          traits.push(`${s.name}化科：注重名誉，有贵人缘，对${s.name}所主事项有解厄能力`)
          break
        case '化忌':
          traits.push(`${s.name}化忌：执着敏感，易有纠结，对${s.name}所主事项需特别注意情绪管理`)
          break
      }
    }

    // 三方四正中的四化也影响性格
    for (const idx of [...trineIndices, oppositeIdx]) {
      const palace = stage1.scoringCtx.palaces[idx]
      if (!palace || idx === mingIdx) continue
      const sihuaStars = palace.stars.filter(s => s.sihua)
      for (const s of sihuaStars) {
        const palaceName = PALACE_NAMES[idx] ?? '未知宫'
        if (s.sihua === '化忌') {
          traits.push(`${s.name}化忌入${palaceName}：性格中对该领域易有执念，影响${palaceName}相关决策`)
        } else if (s.sihua === '化禄') {
          traits.push(`${s.name}化禄入${palaceName}：性格中对该领域较为圆融，${palaceName}发展顺畅`)
        }
      }
    }

    return traits.length > 0 ? traits : ['命宫及三方四正无特殊四化影响']
  })()

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
    // 新增字段 — 命宫能级
    mingGongScore,
    scoreLevel,
    scoreInfluence,
    // 新增字段 — 身宫能级
    shenGongScore,
    shenScoreLevel,
    shenScoreInfluence,
    // 新增字段 — 太岁宫能级
    taiSuiScore,
    taiSuiScoreLevel,
    taiSuiScoreInfluence,
    // 新增字段 — 三宫能级综合
    threePalaceScoreSynthesis,
    // 新增字段 — 格局影响
    patternInfluences,
    // 新增字段 — 三方四正交互
    trineInteraction,
    oppositeInteraction,
    trineSihuaFlow,
    trineAuspiciousInauspicious,
    // 新增字段 — 夹宫影响
    flankingInfluence,
    singleFlankingInfluence,
    // 新增字段 — 四化性格映射
    sihuaPersonalityTraits,
    // ═══════════════════════════════════════════════════════════════════
    // P0: 格局人格特质注入（新增）
    // ═══════════════════════════════════════════════════════════════════
    patternPersonality: stage2.patternPersonality ? {
      personalityBase: stage2.patternPersonality.aggregated.personalityBase,
      behavioralTendency: stage2.patternPersonality.aggregated.behavioralTendency,
      interpersonalStyle: stage2.patternPersonality.aggregated.interpersonalStyle,
      stressResponse: stage2.patternPersonality.aggregated.stressResponse,
      surfaceTraits: stage2.patternPersonality.aggregated.surfaceTraits,
      middleTraits: stage2.patternPersonality.aggregated.middleTraits,
      coreTraits: stage2.patternPersonality.aggregated.coreTraits,
      influences: stage2.patternPersonality.influences.map(inf => ({
        patternName: inf.patternName,
        level: inf.level,
        traits: inf.traits.map(t => t.keyword).join('、'),
        description: `${inf.personalityBase}。行为倾向：${inf.behavioralTendency}`,
      })),
    } : undefined,
    // ═══════════════════════════════════════════════════════════════════
    // P1: 评分原因性格映射（新增）
    // ═══════════════════════════════════════════════════════════════════
    scoreReasonPersonality: stage2.scoreReasonPersonality ? {
      mingProfile: {
        finalScore: stage2.scoreReasonPersonality.mingProfile.finalScore,
        subduePersonality: stage2.scoreReasonPersonality.mingProfile.subduePersonality,
        synthesis: stage2.scoreReasonPersonality.mingProfile.synthesis,
        strengths: stage2.scoreReasonPersonality.mingProfile.bonusReasons
          .filter(r => r.impactLevel === '强')
          .map(r => r.personalityInterpretation),
        challenges: stage2.scoreReasonPersonality.mingProfile.penaltyReasons
          .filter(r => r.impactLevel === '强')
          .map(r => r.personalityInterpretation),
      },
      keyDimensions: stage2.scoreReasonPersonality.keyDimensions,
    } : undefined,
    // ═══════════════════════════════════════════════════════════════════
    // P2: 三宫交叉张力分析（新增）
    // ═══════════════════════════════════════════════════════════════════
    threePalaceCross: stage2.threePalaceCross ? {
      baseTone: stage2.threePalaceCross.baseTone,
      crossTensions: stage2.threePalaceCross.crossTensions,
      synthesis: stage2.threePalaceCross.synthesis,
    } : undefined,
  }

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

  const chartSnapshot = buildChartSnapshotObject(chartData, { birthGan, taiSuiZhi })

  const ir1: IRStage1 = {
    stage: 1,
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    hasParentInfo: stage1.hasParentInfo,
    parentBirthYears: opts.parentBirthYears,
    chartSnapshot,
  }
  const ir2: IRStage2 = {
    stage: 2,
    mingGongTags: stage2.mingGongTags,
    shenGongTags: stage2.shenGongTags,
    taiSuiTags: stage2.taiSuiTags,
    overallTone: stage2.overallTone,
    mingGongHolographic: stage2.mingGongHolographic,
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    chartSnapshot,
  }

  const stage1Ref = {
    palaceScores: stage1.palaceScores,
    allPatterns: stage1.allPatterns,
    mergedSihua: stage1.mergedSihua,
    scoringCtx: stage1.scoringCtx,
  }

  const prompts = {
    stage1: joinPromptPreview(ir1, stage1.knowledgeSnippets.map(s => s.content), '（排盘页调试）', STAGE1_HINT),
    stage2: joinPromptPreview(ir2, stage2.knowledgeSnippets.map(s => s.content), '（排盘页调试）', STAGE2_HINT),
    stage3: joinPromptPreview(
      buildStage3Ir(stage3, chartData, opts.targetYear, stage1Ref),
      stage3.knowledgeSnippets.map(s => s.content),
      `（排盘页调试）${opts.affair}`,
      STAGE3_HINT,
    ),
    stage4: joinPromptPreview(
      buildStage4Ir(stage4, chartData, opts.targetYear, stage1Ref),
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
    limitPatterns,
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
    // 父母四化元数据（供前端展示具体干支和星曜）
    parentSihuaMeta: buildParentSihuaMeta(stage1.scoringCtx, opts.parentBirthYears),
  }
}

/** 构建父母四化元数据（干支 + 化禄/化忌/遁干星名） */
function buildParentSihuaMeta(
  scoringCtx: { fatherGan?: string; fatherTaiSuiZhi?: string; motherGan?: string; motherTaiSuiZhi?: string },
  parentBirthYears?: { father?: number; mother?: number },
) {
  type G = import('@/core/types').TianGan
  type Z = import('@/core/types').DiZhi

  const build = (year: number, gan: string | undefined, zhi: string | undefined) => {
    if (!gan || !zhi) return undefined
    const sn = getShengNianSihua(gan as G)
    const dg = getDunGan(gan as G, zhi as Z)
    const dn = getSihuaTable()[dg as G]
    return {
      year,
      gan,
      zhi,
      zodiac: yearToZodiac(year),
      luStar: String(sn.禄),
      jiStar: String(sn.忌),
      dunGan: dg,
      dunLuStar: dn ? String(dn.禄) : '',
      dunJiStar: dn ? String(dn.忌) : '',
    }
  }

  if (!parentBirthYears?.father && !parentBirthYears?.mother) return undefined
  return {
    father: parentBirthYears.father ? build(parentBirthYears.father, scoringCtx.fatherGan, scoringCtx.fatherTaiSuiZhi) : undefined,
    mother: parentBirthYears.mother ? build(parentBirthYears.mother, scoringCtx.motherGan, scoringCtx.motherTaiSuiZhi) : undefined,
  }
}
