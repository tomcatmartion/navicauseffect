/**
 * 事项限运合参引擎 — 实现 limit_direction.json analysisFlow + compositeScoring
 */

import type {
  Stage3Input,
  Stage3Output,
  PalaceName,
  ProtectionMechanismHit,
  MatterAnalysisSummary,
  DirectionMatrix,
  DaXianQualitativeLevel,
  FourDimensionProjection,
  SecondaryPalaceSnapshot,
} from '@/core/types'
import { PALACE_NAME_TO_INDEX, getDirectionWindow } from '@/core/types'
import {
  getInnateLevelDetail,
  getDaXianQualitativeLevel,
  getScoreThreshold,
  getMatterPersonalityInfluence,
  getTimeDimensions,
  getLimitDirectionMeta,
  getProtectionMechanismDefs,
  computeCompositeScore,
  getMingRegulatorCoefficient,
  getLiuNianTimeWindowMeta,
  getCausalChainTemplate,
  getLuluJiFlowTemplate,
} from '@/core/knowledge-dict/limit-direction'
import { PALACE_NAMES } from '@/core/types'
import { findStarPalaceIndex } from './palace-weight-resolver'
import { evaluateResilience, evaluateLifeTrend, evaluateCapabilityMatch } from './resilience-evaluator'
import { slimEventDescriptions } from './event-description-slimmer'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import { buildThreeLayerTable, calculateDirectionMatrix, resolveLiuNianGan, findCurrentDaXianFromChart } from './fortune-engine'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import {
  buildDaXianScoringContext,
  buildYearlyScoringContext,
  buildLiuYueScoringContext,
  extractMonthlyHoroscope,
} from './limit-scoring-context'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { getAllFlankingPairs } from '@/core/energy-evaluator/jiagong-matcher'
import { injectStage3Knowledge } from '@/core/stages/helpers/knowledge-injector'
import {
  weightedOriginScore,
  matchLiuYueSihuaRule,
} from './palace-weight-resolver'
import { computePalaceFourDimension } from './palace-four-dimension'
import { matchDaXianSihuaRule, matchLiuNianSihuaRule, buildSihuaLandingReport, buildYuanJuTriggerEntries, buildLayerTriggerEntries, buildTriggerEntriesFromMutagen, detectSihuaTriggers, applyTriggerActivationAdjust, getMatterFocusIndices } from './sihua-trigger-engine'
import type { SihuaLandingReport, MutagenLandingRow, SihuaTrigger } from '@/core/types'
import { scorePalacesToBrief, mapToneToBriefLevel } from './limit-layer-scoring'

/** 由实际四维投射生成与 outputTemplate 对齐的焦点文案 */
function buildDynamicFourDimensionFocus(fourDimension: FourDimensionProjection): string[] {
  return [
    `本宫${fourDimension.self.palace}`,
    `对宫${fourDimension.opposite.palace}`,
    `合宫${fourDimension.trine.palaces.join('+')}`,
    `临宫${fourDimension.flanking.palaces.join('+')}`,
  ]
}

function buildSecondaryPalaceSnapshots(
  secondaryPalaces: PalaceName[],
  palaceScores: Stage3Input['stage1']['palaceScores'],
): SecondaryPalaceSnapshot[] {
  return secondaryPalaces.map(palace => {
    const idx = PALACE_NAME_TO_INDEX[palace]
    const score = idx >= 0 ? palaceScores[idx] : undefined
    return {
      palace,
      score: score?.finalScore ?? 0,
      tone: score?.tone ?? '暂无',
    }
  })
}

function detectProtectionMechanisms(
  input: Stage3Input,
  primaryIdx: number,
): ProtectionMechanismHit[] {
  const hits: ProtectionMechanismHit[] = []
  const defs = getProtectionMechanismDefs()
  const ctx = input.stage1.scoringCtx
  const pairs = getAllFlankingPairs(primaryIdx, ctx, '吉夹')

  const doubleLu = pairs.some(
    p => p.pairName.includes('双禄') || p.displayName === '禄夹格',
  )
  if (doubleLu && defs['双禄夹目标宫']) {
    const d = defs['双禄夹目标宫']
    hits.push({ id: '双禄夹目标宫', description: d.description, effect: d.effect, scoreBonus: d.scoreBonus })
  }

  const palace = ctx.palaces[primaryIdx]
  if (palace?.hasLuCun || palace?.stars.some(s => s.name === '禄存')) {
    const d = defs['禄存在目标宫']
    if (d) hits.push({ id: '禄存在目标宫', description: d.description, effect: d.effect, scoreBonus: d.scoreBonus })
  }

  if (input.routeResult.primaryPalace === '财帛' || input.routeResult.secondaryPalaces.includes('财帛')) {
    const caiIdx = PALACE_NAME_TO_INDEX['财帛']
    const cai = ctx.palaces[caiIdx]
    if (cai?.majorStars.some(ms => ms.star === '天府')) {
      const d = defs['天府守财库']
      if (d) hits.push({ id: '天府守财库', description: d.description, effect: d.effect, scoreBonus: d.scoreBonus })
    }
  }

  const patternCount = input.stage1.palaceScores[primaryIdx]?.patterns.length ?? 0
  if (patternCount >= 2 || hits.length >= 2) {
    const d = defs['护佑格局完整']
    if (d && !hits.some(h => h.id === '护佑格局完整')) {
      hits.push({ id: '护佑格局完整', description: d.description, effect: d.effect, scoreBonus: d.scoreBonus })
    }
  }

  return hits
}

function extractLiuNianSihuaPositions(
  threeLayerTable: Stage3Output['threeLayerTable'],
): string[] {
  return threeLayerTable.yearly.palaces.flatMap(p =>
    p.sihua.map(s => `${s.type}${s.star}入${p.name}`),
  )
}

function scorePalaceInLayer(
  ctx: ScoringContext | null,
  palaceName: PalaceName,
): number {
  if (!ctx) return 5
  const scores = evaluateAllPalaces(ctx)
  const idx = PALACE_NAME_TO_INDEX[palaceName]
  return scores[idx]?.finalScore ?? 5
}

/** 动态因果链：保留基调模板 + 注入具体四化落宫数据 + 引动摘要 */
function buildDynamicCausalChain(
  directionMatrix: DirectionMatrix,
  sihuaReport: SihuaLandingReport,
  primaryPalace: PalaceName,
  sihuaTriggers: SihuaTrigger[] = [],
  focusIndices: number[] = [],
): string {
  const base = getCausalChainTemplate(directionMatrix)
  const parts: string[] = [base]

  for (const layer of sihuaReport.layers) {
    if (layer.layer === '流月' && layer.rows.length === 0) continue
    const focusHits = layer.rows.filter(r => r.inMatterFocus)
    const oppHits = layer.rows.filter(r => r.hitsOppositeOfFocus && !r.inMatterFocus)
    const segments: string[] = []

    if (focusHits.length > 0) {
      segments.push(focusHits.map(r =>
        `${r.sihuaType}${r.star}直入${r.palace ?? '?'}宫（${r.palaceQuality}）`,
      ).join('；'))
    }
    if (oppHits.length > 0) {
      segments.push(oppHits.map(r =>
        `${r.sihuaType}${r.star}落${primaryPalace}对宫${r.palace ?? '?'}（${r.palaceQuality}），间接冲击`,
      ).join('；'))
    }
    if (segments.length > 0) {
      parts.push(`${layer.layer}层：${segments.join('。')}。`)
    }
  }

  const focusSet = new Set(focusIndices)
  const triggerLines = sihuaTriggers
    .filter(t => focusSet.has(t.targetPalace))
    .sort((a, b) => {
      const rank = (t: SihuaTrigger) =>
        (t.relation === '双夹' ? 4 : t.type === '忌' ? 3 : 2) * t.weight
      return rank(b) - rank(a)
    })
    .slice(0, 3)
    .map(t => t.effect)

  if (triggerLines.length > 0) {
    parts.push(`引动：${triggerLines.join('；')}。`)
  }

  return parts.join('\n')
}

function detectLuluJiFlow(
  currentDaXian: Stage3Output['allDaXianMappings'][number] | undefined,
  primaryPalace: PalaceName,
  ctx: import('@/core/energy-evaluator/scoring-flow').ScoringContext,
  liuNianMutagen?: string[],
): string[] {
  const flows: string[] = []
  const template = getLuluJiFlowTemplate()

  // 大限层级禄随忌走
  if (currentDaXian?.mutagen?.length) {
    const luStar = currentDaXian.mutagen[0]
    const jiStar = currentDaXian.mutagen[3]
    if (luStar && jiStar) {
      const luIdx = findStarPalaceIndex(ctx, luStar)
      const jiIdx = findStarPalaceIndex(ctx, jiStar)
      if (luIdx !== null && jiIdx !== null) {
        const luPalace = PALACE_NAMES[luIdx] as PalaceName
        const jiPalace = PALACE_NAMES[jiIdx] as PalaceName
        // 方向1：化禄入主宫 + 化忌在外 → 资源流入但被分流
        if (luPalace === primaryPalace && jiPalace !== primaryPalace) {
          flows.push(template
            .replace(/\{\{primary\}\}/g, primaryPalace)
            .replace(/\{\{jiPalace\}\}/g, jiPalace))
        }
        // 方向2：化忌入主宫 + 化禄在外 → 资源被拉走
        if (jiPalace === primaryPalace && luPalace !== primaryPalace) {
          flows.push(`【忌锁主宫】大限化忌${jiStar}直锁${primaryPalace}，化禄${luStar}却飞入${luPalace}，能量被分流到${luPalace}所主领域，${primaryPalace}方面投入不足。`)
        }
      }
    }
  }

  // 流年层级禄随忌走
  if (liuNianMutagen?.length) {
    const luStar = liuNianMutagen[0]
    const jiStar = liuNianMutagen[3]
    if (luStar && jiStar) {
      const luIdx = findStarPalaceIndex(ctx, luStar)
      const jiIdx = findStarPalaceIndex(ctx, jiStar)
      if (luIdx !== null && jiIdx !== null) {
        const luPalace = PALACE_NAMES[luIdx] as PalaceName
        const jiPalace = PALACE_NAMES[jiIdx] as PalaceName
        if (luPalace === primaryPalace && jiPalace !== primaryPalace) {
          flows.push(`【流年禄随忌走】流年化禄${luStar}飞入${primaryPalace}，但流年化忌${jiStar}落${jiPalace}，短期机会伴随${jiPalace}领域隐患。`)
        }
        if (jiPalace === primaryPalace && luPalace !== primaryPalace) {
          flows.push(`【流年忌冲主宫】流年化忌${jiStar}直冲${primaryPalace}，化禄${luStar}落${luPalace}，今年${primaryPalace}受压，${luPalace}领域反有短期红利。`)
        }
      }
    }
  }

  return flows
}

function buildDaXianTimeline(
  input: Stage3Input,
  mappings: Stage3Output['allDaXianMappings'],
  currentDaXian: Stage3Output['allDaXianMappings'][number] | undefined,
  primaryPalace: PalaceName,
  hasProtection: boolean,
): Stage3Output['daXianTimeline'] {
  const natalCtx = input.stage1.scoringCtx
  const currentIdx = currentDaXian
    ? mappings.findIndex(m => m.index === currentDaXian.index)
    : 0
  const start = Math.max(0, Math.min(currentIdx > 0 ? currentIdx - 1 : 0, mappings.length - 3))
  return mappings.slice(start, start + 3).map(d => {
    const daXianCtx = buildDaXianScoringContext(d, natalCtx)
    const palaceScore = scorePalaceInLayer(daXianCtx, primaryPalace)
    const rule = matchDaXianSihuaRule(input, d.mutagen, hasProtection)
    return {
      index: d.index,
      ageRange: `${d.ageRange[0]}–${d.ageRange[1]}岁`,
      qualitative: getDaXianQualitativeLevel(palaceScore + rule.adjustment),
      isCurrent: currentDaXian?.index === d.index,
      mingPalaceName: d.mingPalaceName,
      daXianGan: d.daXianGan,
    }
  })
}

export function executeMatterLimitAnalysis(input: Stage3Input): Omit<Stage3Output, 'matterType'> {
  const { stage1, stage2, routeResult, chartData, targetYear } = input
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990

  const personalityAnchor = stage2.personalityTriad?.synthesis ?? stage2.overallTone

  const { table: threeLayerTable, daXianMappings: allDaXianMappings } =
    buildThreeLayerTable(stage1.scoringCtx, chartData, targetYear)

  const currentDaXian = findCurrentDaXianFromChart(allDaXianMappings, targetYear, birthYear, chartData)

  const directionMatrix: DirectionMatrix = calculateDirectionMatrix(
    currentDaXian,
    targetYear,
    stage1.scoringCtx,
    chartData,
    {
      primaryPalace: routeResult.primaryPalace,
      secondaryPalaces: routeResult.secondaryPalaces,
    },
    stage1.palaceScores,
  )
  const directionWindow = getDirectionWindow(directionMatrix)
  const dirMeta = getLimitDirectionMeta(directionMatrix)
  const windowMeta = getLiuNianTimeWindowMeta(directionWindow)

  const primaryIdx = PALACE_NAME_TO_INDEX[routeResult.primaryPalace]
  const primaryScore = primaryIdx >= 0 ? stage1.palaceScores[primaryIdx] : null
  const mingScore = stage1.palaceScores[PALACE_NAME_TO_INDEX['命宫']]?.finalScore ?? 5
  const innateDetail = getInnateLevelDetail(mingScore)
  const fourDimension = primaryIdx >= 0
    ? computePalaceFourDimension(primaryIdx, stage1.palaceScores)
    : null

  const protectionMechanisms = detectProtectionMechanisms(input, primaryIdx)
  const protectionBonus = protectionMechanisms.reduce((s, m) => s + m.scoreBonus, 0)
  const hasProtection = protectionMechanisms.length > 0

  const originWeighted = weightedOriginScore(input.matterType, stage1.scoringCtx, stage1.palaceScores)
  const mingRegulator = getMingRegulatorCoefficient(innateDetail.level)
  const originBase = originWeighted * mingRegulator + protectionBonus * 0.3

  const daXianCtx = currentDaXian
    ? buildDaXianScoringContext(currentDaXian, stage1.scoringCtx)
    : null
  const yearlyCtx = buildYearlyScoringContext(targetYear, stage1.scoringCtx)

  const daXianPalaceScores = scorePalacesToBrief(daXianCtx)
  const liuNianPalaceScores = scorePalacesToBrief(yearlyCtx)

  const daXianPalaceScore = scorePalaceInLayer(daXianCtx, routeResult.primaryPalace)
  const daXianRule = currentDaXian
    ? matchDaXianSihuaRule(input, currentDaXian.mutagen, hasProtection)
    : { ruleKey: '原局无护佑格局', adjustment: 0 }
  let daXianActivation = Math.max(0, (daXianPalaceScore + daXianRule.adjustment) * 0.5)

  const yearlyPalaceScore = scorePalaceInLayer(yearlyCtx, routeResult.primaryPalace)
  const daXianPositive = daXianRule.adjustment >= 0
  const liuNianGan = resolveLiuNianGan(chartData, targetYear)
  const liuNianRule = matchLiuNianSihuaRule(input, liuNianGan, hasProtection, daXianPositive)
  let liuNianActivation = Math.max(0, (yearlyPalaceScore + liuNianRule.adjustment) * 0.3)

  // 三代四化引动检测
  const yuanJuTriggerEntries = buildYuanJuTriggerEntries(stage1.scoringCtx)
  // 优先从 context 标注提取；大限天干与原局相同时 fallback 到 mutagen 直接构建
  let daXianTriggerEntries = buildLayerTriggerEntries(daXianCtx, 'daXian')
  if (daXianTriggerEntries.length === 0 && currentDaXian?.mutagen) {
    daXianTriggerEntries = buildTriggerEntriesFromMutagen(currentDaXian.mutagen, stage1.scoringCtx)
  }
  let liuNianTriggerEntries = buildLayerTriggerEntries(yearlyCtx, 'liuNian')
  if (liuNianTriggerEntries.length === 0) {
    const liuNianMapping = getSihuaTable()[liuNianGan as keyof ReturnType<typeof getSihuaTable>]
    if (liuNianMapping) {
      liuNianTriggerEntries = buildTriggerEntriesFromMutagen(
        [liuNianMapping.禄, liuNianMapping.权, liuNianMapping.科, liuNianMapping.忌],
        stage1.scoringCtx,
      )
    }
  }
  const sihuaTriggers = detectSihuaTriggers(
    yuanJuTriggerEntries,
    daXianTriggerEntries,
    liuNianTriggerEntries,
  )

  const focusIndices = getMatterFocusIndices({
    primaryPalace: routeResult.primaryPalace,
    secondaryPalaces: routeResult.secondaryPalaces,
  })

  const triggerAdjust = applyTriggerActivationAdjust(
    sihuaTriggers,
    focusIndices,
    daXianActivation,
    liuNianActivation,
  )
  daXianActivation = triggerAdjust.daXianActivation
  liuNianActivation = triggerAdjust.liuNianActivation

  const mingIdx = PALACE_NAME_TO_INDEX['命宫']
  const shenIdx = stage1.scoringCtx.shenGongIndex ?? mingIdx
  const mingLevel = mapToneToBriefLevel(stage1.palaceScores[mingIdx]?.tone ?? '磨炼')
  const shenLevel = mapToneToBriefLevel(stage1.palaceScores[shenIdx]?.tone ?? '磨炼')
  const lifeTrend = evaluateLifeTrend(mingLevel, shenLevel)
  const daXianMingBrief = currentDaXian
    ? daXianPalaceScores.find(p => p.palaceIndex === currentDaXian.palaceIndex)
    : undefined
  const capabilityMatch = evaluateCapabilityMatch(mingLevel, daXianMingBrief?.level ?? '平')

  const monthlyHoroscope = extractMonthlyHoroscope(chartData)
  const liuYueDataAvailable = monthlyHoroscope !== null
  const liuYueCtx = monthlyHoroscope
    ? buildLiuYueScoringContext(monthlyHoroscope, stage1.scoringCtx)
    : null
  const liuYueScore = scorePalaceInLayer(liuYueCtx, routeResult.primaryPalace)
  const liuYueRule = matchLiuYueSihuaRule(routeResult.primaryPalace, stage1.scoringCtx, monthlyHoroscope)
  const liuYueActivation = liuYueDataAvailable
    ? Math.max(0, (liuYueScore + liuYueRule.adjustment) * 0.2)
    : Math.max(0, 5 * 0.2)

  const compositeScore = Math.min(
    10,
    Math.max(0, computeCompositeScore(originBase, daXianActivation, liuNianActivation, liuYueActivation)),
  )
  const threshold = getScoreThreshold(compositeScore)

  const currentDaXianQualitative: DaXianQualitativeLevel = currentDaXian
    ? getDaXianQualitativeLevel(daXianPalaceScore + daXianRule.adjustment)
    : '转机期'

  const fourDimensionFocus = fourDimension
    ? buildDynamicFourDimensionFocus(fourDimension)
    : [`本宫${routeResult.primaryPalace}`]

  const primaryAnalysis: Stage3Output['primaryAnalysis'] = {
    palace: routeResult.primaryPalace,
    fourDimensionResult: fourDimension
      ? fourDimension.summary
      : primaryScore
        ? `${primaryScore.tone}，${primaryScore.finalScore.toFixed(1)}分`
        : '暂无数据',
    mingGongRegulation: `${stage2.overallTone}（命宫${innateDetail.level}，调节×${mingRegulator.toFixed(1)}）`,
    protectionStatus: protectionMechanisms.length
      ? protectionMechanisms.map(m => `${m.id}：${m.effect}`).join('；')
      : '无特殊护佑机制',
    innateLevel: innateDetail.level,
    innateLevelDetail: innateDetail,
  }

  const analysisSummary: MatterAnalysisSummary = {
    innateBase: `原局${innateDetail.level}（${innateDetail.description}）；事项主宫${routeResult.primaryPalace}；四维合参：${fourDimensionFocus.join('、')}`,
    fortuneTrend: currentDaXian
      ? `第${currentDaXian.index}限 ${currentDaXian.ageRange[0]}–${currentDaXian.ageRange[1]}岁，大限命宫${currentDaXian.mingPalaceName}（${currentDaXian.daXianGan}），${currentDaXianQualitative}；四化规则：${daXianRule.ruleKey}；人生趋势：${lifeTrend}；能力匹配：${capabilityMatch}`
      : `暂无大限数据；人生趋势：${lifeTrend}；能力匹配：${capabilityMatch}`,
    yearlyTrigger: `流年规则：${liuNianRule.ruleKey}；窗口：${directionWindow}${windowMeta ? `（${windowMeta.action}）` : ''}${liuYueDataAvailable ? `；流月：${liuYueRule.ruleKey}` : '；流月数据缺失（流月层按中性分估算）'}`,
    compositeConclusion: `综合分 ${compositeScore.toFixed(1)}，${threshold.label}，建议${threshold.action}`,
    riskAdvice: dirMeta
      ? `${dirMeta.judgment}：${dirMeta.suggestion}`
      : innateDetail.advice,
  }

  const knowledgeSnippets = injectStage3Knowledge(
    routeResult.primaryPalace,
    routeResult.secondaryPalaces,
    stage1.palaceScores,
    allDaXianMappings,
    input.matterType,
    targetYear,
    birthYear,
    chartData,
  )

  if (personalityAnchor) {
    knowledgeSnippets.push({
      source: '性格三宫',
      key: '性格锚点',
      content: personalityAnchor,
    })
  }
  if (dirMeta?.judgment) {
    knowledgeSnippets.push({
      source: '限运方向',
      key: `限运方向_${directionMatrix}`,
      content: `大限×流年「${directionMatrix}」：${dirMeta.judgment}。建议：${dirMeta.suggestion}。${dirMeta.description}`,
    })
  }

  const liuNianSihuaPositions = extractLiuNianSihuaPositions(threeLayerTable)

  const sihuaLandingReport = buildSihuaLandingReport({
    input,
    directionMatrix,
    currentDaXian,
    daXianRule,
    liuNianGan,
    liuNianRule,
    liuYueRule,
    liuYueDataAvailable,
    monthlyHoroscope,
  })

  const causalChain = buildDynamicCausalChain(
    directionMatrix,
    sihuaLandingReport,
    routeResult.primaryPalace,
    sihuaTriggers,
    focusIndices,
  )
  // 流年四化用于禄随忌走检测
  const liuNianMapping = getSihuaTable()[liuNianGan as keyof ReturnType<typeof getSihuaTable>]
  const liuNianMutagen = liuNianMapping ? [liuNianMapping.禄, liuNianMapping.权, liuNianMapping.科, liuNianMapping.忌] : undefined
  const luluJiFlow = detectLuluJiFlow(currentDaXian, routeResult.primaryPalace, stage1.scoringCtx, liuNianMutagen)
  const resilience = evaluateResilience(mingScore, directionMatrix, primaryScore?.finalScore, hasProtection)
  const slimmedDescriptions = slimEventDescriptions(
    input.matterType,
    routeResult.primaryPalace,
    routeResult.secondaryPalaces,
    stage1.palaceScores,
  )
  const daXianTimeline = buildDaXianTimeline(
    input,
    allDaXianMappings,
    currentDaXian,
    routeResult.primaryPalace,
    hasProtection,
  )
  const secondaryPalaceSnapshots = buildSecondaryPalaceSnapshots(
    routeResult.secondaryPalaces,
    stage1.palaceScores,
  )
  const timeDimensions = getTimeDimensions(input.matterType).map(label => {
    if (label.startsWith('大限')) return `大限${routeResult.primaryPalace}`
    if (label.startsWith('流年')) return `流年${routeResult.primaryPalace}`
    if (label.startsWith('流月')) return `流月${routeResult.primaryPalace}`
    return label
  })
  const personalityInfluence = getMatterPersonalityInfluence(input.matterType)
  const currentDaXianDetail = currentDaXian
    ? {
        index: currentDaXian.index,
        ageRange: currentDaXian.ageRange,
        mingPalaceName: currentDaXian.mingPalaceName,
        daXianGan: currentDaXian.daXianGan,
        qualitative: currentDaXianQualitative,
      }
    : undefined
  const scoreBreakdown = {
    originBase,
    daXianActivation,
    liuNianActivation,
    liuYueActivation,
  }

  return {
    primaryAnalysis,
    allDaXianMappings,
    threeLayerTable,
    directionMatrix,
    directionWindow,
    knowledgeSnippets,
    compositeScore,
    scoreLabel: threshold.label,
    scoreAction: threshold.action,
    personalityAnchor,
    currentDaXianQualitative,
    protectionMechanisms,
    liuNianSihuaPositions,
    liuYueDataAvailable,
    analysisSummary,
    sihuaLandingReport,
    fourDimension: fourDimension ?? undefined,
    scoreBreakdown,
    causalChain,
    luluJiFlow,
    resilience,
    daXianTimeline,
    secondaryPalaceSnapshots,
    timeDimensions,
    personalityInfluence,
    currentDaXianDetail,
    fourDimensionFocus,
    slimmedDescriptions,
    sihuaTriggers,
    daXianPalaceScores,
    liuNianPalaceScores,
    lifeTrend,
    capabilityMatch,
  }
}
