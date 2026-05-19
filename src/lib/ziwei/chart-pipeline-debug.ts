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
import { evaluateJsonPatterns } from '@/core/adapters/iztro/patterns-dsl'
import { getPatternDefinition, getPatternMultiplier } from '@/core/energy-evaluator/patterns'
import {
  buildPrompt,
  STAGE1_HINT,
  STAGE2_HINT,
  STAGE3_HINT,
  STAGE4_HINT,
} from '@/core/llm-wrapper/prompt-builder'
import { getDunGan } from '@/core/sihua-calculator/tables'
import type { TianGan, DiZhi, PalaceBrightness } from '@/core/types'
import type { VirtualChart } from '@/core/tai-sui-rua-gua/virtual-chart'
import { getWeakerBrightness } from '@/core/energy-evaluator/scoring-flow'
import { getFlankingDecay } from '@/core/knowledge-dict/query'

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
    /** 六步评分流程（基于 scoring_formula.json v1.3） */
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

  // 构建格局调试数据：查找每个格局的星曜所在宫位
  const patterns: UiPatternRow[] = stage1.allPatterns.map(p => {
    const def = getPatternDefinition(p.name)
    const multiplierFromJson = getPatternMultiplier(p.level)

    // 从 patterns.json definitions[name].description 提取星曜名称
    const description = def && 'description' in def ? String(def.description) : ''
    const triggerFromJson = def && 'trigger' in def ? String(def.trigger) : ''

    // 从 description 中提取星曜名称（紫微斗数主星+辅星+四化名）
    const starNameRegex = /紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|左辅|右弼|文昌|文曲|天魁|天钺|禄存|擎羊|陀罗|火星|铃星|地空|地劫|化禄|化权|化科|化忌/g
    const extractedStars = Array.from(new Set(description.match(starNameRegex) || []))

    // 从 scoringCtx 查找格局相关星曜的宫位
    const starPalaces: Record<string, string> = {}
    const requiredStars: string[] = extractedStars.length > 0 ? extractedStars : ['（从 patterns.json description 中未提取到星曜）']

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
    const judgmentBasis = `${p.level}（${p.category}类）｜来源：data/patterns.json definitions["${p.name}"].level="${p.level}"，category="${p.category}"｜SKILL_宫位原生能级评估_V3.0.md 格局库「${p.name}」条`

    // 倍率来源：明确说明来源
    const multiplierSource = `data/patterns.json → multipliers["${p.level}"] = ${multiplierFromJson}｜SKILL_宫位原生能级评估_V3.0.md：${p.level}格局倍率×${multiplierFromJson}`

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
            const val = -0.5 * sanfangCoeffs[i]
            penaltyBreakdown.push({
              source: `${sanfangRoles[i]}·${p.diZhi}`,
              value: val,
              detail: `${star.name}（煞星）× ${sanfangCoeffs[i]}衰减 = ${val.toFixed(2)}`,
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
            const val = -0.5 * decay // 使用动态衰减系数
            penaltyBreakdown.push({
              source: `夹宫·${leftPalace.diZhi}-${rightPalace.diZhi}`,
              value: val,
              detail: `${pair.name}（${forward ? pair.left + '·' + pair.right : pair.right + '·' + pair.left}）× ${decay}衰减 = ${val.toFixed(2)}`,
            })
          }
        }
      }
    }

    // 构建禄存加分说明
    if (ps.luCunDelta !== 0) {
      const luCunDesc = ps.luCunDelta > 0
        ? `禄存在旺宫/极旺：+${ps.luCunDelta.toFixed(1)}（SKILL_V3.0 第五步：旺宫+0.3）`
        : `禄存在陷宫/空宫：${ps.luCunDelta.toFixed(1)}（SKILL_V3.0 第五步：陷宫-0.3）`
      bonusBreakdown.push({
        source: '禄存专项',
        value: ps.luCunDelta,
        detail: luCunDesc,
      })
    }

    // 构建格局倍率来源说明
    // 注意：pattern.category 是格局分类（如"紫微"），不是宫位名称
    // 正确的匹配逻辑：检查该宫位是否参与了格局的成格条件
    const palaceName = ps.palace
    const palaceDiZhi = ps.diZhi
    
    // 从 stage1.scoringCtx 查找与该宫位相关的格局
    // 一个宫位如果包含格局所需的星曜，则认为该格局影响此宫
    const relatedPatterns = stage1.allPatterns.filter(pat => {
      const def = getPatternDefinition(pat.name)
      if (!def) return false
      
      // 从 description 中提取星曜名称
      const desc = String(def.description || '')
      const starNameRegex = /紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|左辅|右弼|文昌|文曲|天魁|天钺|禄存|擎羊|陀罗|火星|铃星|地空|地劫|化禄|化权|化科|化忌/g
      const requiredStars = Array.from(new Set(desc.match(starNameRegex) || []))
      
      // 检查该宫位是否包含格局所需的任何星曜
      const palaceCtx = stage1.scoringCtx.palaces.find(p => p.diZhi === palaceDiZhi)
      if (!palaceCtx) return false
      
      const palaceStars = palaceCtx.stars.map(s => s.name)
      const palaceMajorStars = palaceCtx.majorStars.map(ms => String(ms.star))
      const allPalaceStars = [...palaceStars, ...palaceMajorStars]
      
      return requiredStars.some(star => allPalaceStars.includes(star))
    })
    
    const patternMultiplierSource = relatedPatterns.length > 0
      ? `格局加成：${relatedPatterns.map(pat => `${pat.name}（${pat.level}×${pat.multiplier}）`).join('、')}｜来源：data/patterns.json multipliers + SKILL_宫位原生能级评估_V3.0.md 格局库「${relatedPatterns.map(p => p.name).join('、')}」条`
      : '无格局加成（倍率×1.0）｜来源：data/patterns.json multipliers 默认值为1.0'

    // 构建公式说明（SKILL_V3.0：骨架分 + 加分×倍率 + 减分 + 禄存）
    const formula = `最终分 = min(${ps.skeletonScore.toFixed(1)} + (${ps.bonusTotal.toFixed(2)} × ${ps.patternMultiplier.toFixed(1)}) + ${ps.penaltyTotal.toFixed(2)} + ${ps.luCunDelta.toFixed(1)}, ${ps.ceiling.toFixed(1)}) = ${ps.finalScore.toFixed(2)}`

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
