/**
 * 四化引动判定 — 对齐 limit_direction.json sihuaWeights.rules
 * （化星落宫 → 事项/煞宫/吉格/好宫坏宫）
 */

import type {
  PalaceName,
  Stage3Input,
  SihuaLandingReport,
  MutagenLandingRow,
  MutagenLayerDetail,
  DirectionMatrix,
  TriggerSihuaEntry,
  SihuaTrigger,
  SihuaType,
} from '@/core/types'
import { PALACE_NAME_TO_INDEX, PALACE_NAMES } from '@/core/types'
import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import {
  getOppositeIndex,
  getTrineIndices,
} from '@/core/energy-evaluator/scoring-flow'
import { getFlankingIndices } from '@/core/energy-evaluator/jiagong-matcher'
import { getSihuaRuleAdjustment, getSihuaStarBaseAdjustments } from '@/core/knowledge-dict/limit-direction'
import {
  formatTriggerEffect,
  getTriggerEffectTemplate,
  getTriggerSpatialWeight,
} from '@/core/knowledge-dict/sihua-trigger-rules'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import { findStarPalaceIndex } from './palace-weight-resolver'
import type { LiuYueHoroscopeSnapshot } from './limit-scoring-context'
import type { DaXianPalaceMapping } from '@/core/types'

const SIHUA_TYPE_LABELS = ['化禄', '化权', '化科', '化忌'] as const

const SHA_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']

export type PalaceQuality = 'good' | 'bad' | 'neutral'

export interface MatterFocus {
  primaryPalace: PalaceName
  secondaryPalaces: PalaceName[]
}

export interface MutagenHitAnalysis {
  auspiciousInGood: number
  auspiciousInBad: number
  auspiciousInFocus: number
  jiInBad: number
  jiInFocus: number
  /** 吉化落在焦点宫对宫的数量 */
  auspiciousInOpposite: number
  /** 忌化落在焦点宫对宫的数量 */
  jiInOpposite: number
  primaryQuality: PalaceQuality
}

export function getMatterFocusIndices(focus: MatterFocus): number[] {
  const indices = new Set<number>()
  indices.add(PALACE_NAME_TO_INDEX[focus.primaryPalace])
  for (const p of focus.secondaryPalaces) {
    indices.add(PALACE_NAME_TO_INDEX[p])
  }
  indices.add(PALACE_NAME_TO_INDEX['命宫'])
  return [...indices]
}

/** 对宫碰撞检测：四化星是否落在某个焦点宫的对宫 */
export function detectOppositePalaceCollision(
  starPalaceIdx: number | null,
  focusIndices: number[],
): boolean {
  if (starPalaceIdx === null) return false
  for (const focusIdx of focusIndices) {
    const oppIdx = (focusIdx + 6) % 12
    if (starPalaceIdx === oppIdx) return true
  }
  return false
}

export function palaceHasShaOrJi(ctx: ScoringContext, palaceIdx: number): boolean {
  const palace = ctx.palaces[palaceIdx]
  if (!palace) return false
  return palace.stars.some(s => SHA_STARS.includes(s.name) || s.sihua === '化忌')
}

export function palaceHasAuspiciousPattern(
  patterns: Stage3Input['stage1']['palaceScores'][number]['patterns'] | undefined,
): boolean {
  return (patterns ?? []).some(p => p.level.includes('吉'))
}

export function palaceHasInauspiciousPattern(
  patterns: Stage3Input['stage1']['palaceScores'][number]['patterns'] | undefined,
): boolean {
  return (patterns ?? []).some(p => p.level.includes('凶'))
}

export function classifyPalaceQuality(
  palaceIdx: number,
  ctx: ScoringContext,
  palaceScores: Stage3Input['stage1']['palaceScores'],
): PalaceQuality {
  const row = palaceScores[palaceIdx]
  const score = row?.finalScore ?? 5
  if (palaceHasShaOrJi(ctx, palaceIdx) || palaceHasInauspiciousPattern(row?.patterns)) {
    return 'bad'
  }
  if (score >= 5.5 || palaceHasAuspiciousPattern(row?.patterns)) {
    return 'good'
  }
  if (score < 4.5) return 'bad'
  return 'neutral'
}

/** 分析一层四化（禄权科忌）在原局的落宫与事项焦点 */
export function analyzeMutagenHits(
  mutagen: string[],
  ctx: ScoringContext,
  focus: MatterFocus,
  palaceScores: Stage3Input['stage1']['palaceScores'],
): MutagenHitAnalysis {
  const focusIndices = getMatterFocusIndices(focus)
  const primaryIdx = PALACE_NAME_TO_INDEX[focus.primaryPalace]

  let auspiciousInGood = 0
  let auspiciousInBad = 0
  let auspiciousInFocus = 0
  let auspiciousInOpposite = 0

  for (let i = 0; i < 3; i++) {
    const star = mutagen[i]
    if (!star) continue
    const idx = findStarPalaceIndex(ctx, star)
    if (idx === null) continue
    const q = classifyPalaceQuality(idx, ctx, palaceScores)
    if (focusIndices.includes(idx)) auspiciousInFocus++
    if (detectOppositePalaceCollision(idx, focusIndices)) auspiciousInOpposite++
    if (q === 'good') auspiciousInGood++
    else if (q === 'bad') auspiciousInBad++
  }

  let jiInBad = 0
  let jiInFocus = 0
  let jiInOpposite = 0
  const jiStar = mutagen[3]
  if (jiStar) {
    const jiIdx = findStarPalaceIndex(ctx, jiStar)
    if (jiIdx !== null) {
      if (focusIndices.includes(jiIdx)) jiInFocus++
      if (detectOppositePalaceCollision(jiIdx, focusIndices)) jiInOpposite++
      if (classifyPalaceQuality(jiIdx, ctx, palaceScores) === 'bad') jiInBad++
    }
  }

  return {
    auspiciousInGood,
    auspiciousInBad,
    auspiciousInFocus,
    auspiciousInOpposite,
    jiInBad,
    jiInFocus,
    jiInOpposite,
    primaryQuality: classifyPalaceQuality(primaryIdx, ctx, palaceScores),
  }
}

/** 方向矩阵：按事项焦点宫位评估一层四化落宫得分 */
export function scoreMutagenLayerForDirection(
  mutagen: string[],
  ctx: ScoringContext,
  focus: MatterFocus,
  palaceScores: Stage3Input['stage1']['palaceScores'],
): number {
  const base = getSihuaStarBaseAdjustments()
  const weights = [base.lu, base.quan, base.ke, base.ji]
  const focusIndices = getMatterFocusIndices(focus)
  let score = 0

  for (let i = 0; i < 4; i++) {
    const star = mutagen[i]
    if (!star) continue
    const idx = findStarPalaceIndex(ctx, star)
    if (idx === null) {
      score += weights[i] * 0.15
      continue
    }

    const inFocus = focusIndices.includes(idx)
    const hitsOpposite = detectOppositePalaceCollision(idx, focusIndices)
    const quality = classifyPalaceQuality(idx, ctx, palaceScores)
    // 直中 1.0，对宫冲击 0.45，无关 0.25
    const landFactor = inFocus ? 1 : (hitsOpposite ? 0.45 : 0.25)
    score += weights[i] * landFactor

    if (i === 3 && inFocus && quality === 'bad') {
      score += base.ji * 0.35
    }
    if (i < 3 && inFocus && quality === 'good') {
      score += weights[i] * 0.25
    }
  }

  return score
}

export function matchDaXianSihuaRule(
  input: Stage3Input,
  daXianMutagen: string[],
  hasProtection: boolean,
): { ruleKey: string; adjustment: number } {
  const ctx = input.stage1.scoringCtx
  const palaceScores = input.stage1.palaceScores
  const focus: MatterFocus = {
    primaryPalace: input.routeResult.primaryPalace,
    secondaryPalaces: input.routeResult.secondaryPalaces,
  }

  const jiStar = daXianMutagen[3]
  if (jiStar) {
    const jiIdx = findStarPalaceIndex(ctx, jiStar)
    if (jiIdx !== null && palaceHasShaOrJi(ctx, jiIdx)) {
      return {
        ruleKey: '忌化引动原局煞宫',
        adjustment: getSihuaRuleAdjustment('daXianSihua', '忌化引动原局煞宫'),
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const star = daXianMutagen[i]
    if (!star) continue
    const idx = findStarPalaceIndex(ctx, star)
    if (idx === null) continue
    if (palaceHasAuspiciousPattern(palaceScores[idx]?.patterns)) {
      return {
        ruleKey: '吉化引动原局吉格',
        adjustment: getSihuaRuleAdjustment('daXianSihua', '吉化引动原局吉格'),
      }
    }
  }

  const hits = analyzeMutagenHits(daXianMutagen, ctx, focus, palaceScores)
  if (hits.auspiciousInFocus >= 1 && hits.primaryQuality === 'good') {
    return {
      ruleKey: '吉化引动原局吉格',
      adjustment: getSihuaRuleAdjustment('daXianSihua', '吉化引动原局吉格'),
    }
  }

  if (hasProtection) {
    return {
      ruleKey: '原局有护佑格局',
      adjustment: getSihuaRuleAdjustment('daXianSihua', '原局有护佑格局'),
    }
  }
  return {
    ruleKey: '原局无护佑格局',
    adjustment: getSihuaRuleAdjustment('daXianSihua', '原局无护佑格局'),
  }
}

export function matchLiuNianSihuaRule(
  input: Stage3Input,
  liuNianGan: string,
  hasProtection: boolean,
  daXianPositive: boolean,
): { ruleKey: string; adjustment: number } {
  const mapping = getSihuaTable()[liuNianGan as keyof ReturnType<typeof getSihuaTable>]
  if (!mapping) {
    return { ruleKey: '忌化多+忌化入坏宫', adjustment: 0 }
  }

  const mutagen = [mapping.禄, mapping.权, mapping.科, mapping.忌]
  const ctx = input.stage1.scoringCtx
  const palaceScores = input.stage1.palaceScores
  const focus: MatterFocus = {
    primaryPalace: input.routeResult.primaryPalace,
    secondaryPalaces: input.routeResult.secondaryPalaces,
  }
  const hits = analyzeMutagenHits(mutagen, ctx, focus, palaceScores)

  const auspiciousRich = hits.auspiciousInFocus >= 1 || hits.auspiciousInGood + hits.auspiciousInBad >= 2

  if (auspiciousRich && hits.auspiciousInGood >= 1 && hits.primaryQuality !== 'bad') {
    return {
      ruleKey: '吉化多+吉化入好宫',
      adjustment: getSihuaRuleAdjustment('liuNianSihua', '吉化多+吉化入好宫'),
    }
  }

  if (auspiciousRich && (hits.auspiciousInBad >= 1 || hits.primaryQuality === 'bad')) {
    return {
      ruleKey: '吉化多+吉化入坏宫',
      adjustment: getSihuaRuleAdjustment('liuNianSihua', '吉化多+吉化入坏宫'),
    }
  }

  if (hits.jiInBad >= 1 || (hits.jiInFocus >= 1 && hits.primaryQuality === 'bad')) {
    if (hasProtection || daXianPositive) {
      return {
        ruleKey: '忌化多+有好的大限支持',
        adjustment: getSihuaRuleAdjustment('liuNianSihua', '忌化多+有好的大限支持'),
      }
    }
    return {
      ruleKey: '忌化多+忌化入坏宫',
      adjustment: getSihuaRuleAdjustment('liuNianSihua', '忌化多+忌化入坏宫'),
    }
  }

  if (hits.auspiciousInGood >= 1) {
    return {
      ruleKey: '吉化多+吉化入好宫',
      adjustment: getSihuaRuleAdjustment('liuNianSihua', '吉化多+吉化入好宫'),
    }
  }

  return {
    ruleKey: '吉化多+吉化入坏宫',
    adjustment: getSihuaRuleAdjustment('liuNianSihua', '吉化多+吉化入坏宫'),
  }
}

export function directionFromLayerScore(score: number): '吉' | '凶' {
  if (score > 0) return '吉'
  if (score < 0) return '凶'
  return '吉'
}

/** 构建单层四化落宫行（禄权科忌） */
export function buildMutagenLandingRows(
  mutagen: string[],
  ctx: ScoringContext,
  focus: MatterFocus,
  palaceScores: Stage3Input['stage1']['palaceScores'],
): MutagenLandingRow[] {
  const focusIndices = getMatterFocusIndices(focus)
  const rows: MutagenLandingRow[] = []

  for (let i = 0; i < 4; i++) {
    const star = mutagen[i]
    if (!star) continue
    const idx = findStarPalaceIndex(ctx, star)
    const palace = idx !== null ? PALACE_NAMES[idx] : null
    const quality = idx !== null ? classifyPalaceQuality(idx, ctx, palaceScores) : 'unknown'
    const hitsOpposite = detectOppositePalaceCollision(idx, focusIndices)

    rows.push({
      sihuaType: SIHUA_TYPE_LABELS[i],
      star,
      palace,
      inMatterFocus: idx !== null && focusIndices.includes(idx),
      hitsOppositeOfFocus: hitsOpposite,
      palaceQuality: quality,
      triggersShaPalace: idx !== null ? palaceHasShaOrJi(ctx, idx) : undefined,
      hasAuspiciousPattern: idx !== null
        ? palaceHasAuspiciousPattern(palaceScores[idx]?.patterns)
        : undefined,
    })
  }

  return rows
}

export interface BuildSihuaLandingReportParams {
  input: Stage3Input
  directionMatrix: DirectionMatrix
  currentDaXian?: DaXianPalaceMapping
  daXianRule: { ruleKey: string; adjustment: number }
  liuNianGan: string
  liuNianRule: { ruleKey: string; adjustment: number }
  liuYueRule: { ruleKey: string; adjustment: number }
  liuYueDataAvailable: boolean
  monthlyHoroscope: LiuYueHoroscopeSnapshot | null
}

/** Stage3 合参用化星落宫明细（供 debug 面板） */
export function buildSihuaLandingReport(params: BuildSihuaLandingReportParams): SihuaLandingReport {
  const {
    input,
    directionMatrix,
    currentDaXian,
    daXianRule,
    liuNianGan,
    liuNianRule,
    liuYueRule,
    liuYueDataAvailable,
    monthlyHoroscope,
  } = params

  const ctx = input.stage1.scoringCtx
  const palaceScores = input.stage1.palaceScores
  const focus: MatterFocus = {
    primaryPalace: input.routeResult.primaryPalace,
    secondaryPalaces: input.routeResult.secondaryPalaces,
  }
  const focusPalaces = getMatterFocusIndices(focus).map(idx => PALACE_NAMES[idx])

  const layers: MutagenLayerDetail[] = []

  if (currentDaXian) {
    const mutagen = currentDaXian.mutagen
    const layerScore = scoreMutagenLayerForDirection(mutagen, ctx, focus, palaceScores)
    layers.push({
      layer: '大限',
      stemLabel: `大限 ${currentDaXian.daXianGan}（${currentDaXian.mingPalaceName}）`,
      direction: directionFromLayerScore(layerScore),
      layerScore,
      ruleKey: daXianRule.ruleKey,
      ruleAdjustment: daXianRule.adjustment,
      rows: buildMutagenLandingRows(mutagen, ctx, focus, palaceScores),
    })
  }

  const liuNianMapping = getSihuaTable()[liuNianGan as keyof ReturnType<typeof getSihuaTable>]
  if (liuNianMapping) {
    const mutagen = [liuNianMapping.禄, liuNianMapping.权, liuNianMapping.科, liuNianMapping.忌]
    const layerScore = scoreMutagenLayerForDirection(mutagen, ctx, focus, palaceScores)
    layers.push({
      layer: '流年',
      stemLabel: `流年 ${liuNianGan}`,
      direction: directionFromLayerScore(layerScore),
      layerScore,
      ruleKey: liuNianRule.ruleKey,
      ruleAdjustment: liuNianRule.adjustment,
      rows: buildMutagenLandingRows(mutagen, ctx, focus, palaceScores),
    })
  }

  if (liuYueDataAvailable && monthlyHoroscope) {
    const layerScore = scoreMutagenLayerForDirection(monthlyHoroscope.mutagen, ctx, focus, palaceScores)
    layers.push({
      layer: '流月',
      stemLabel: `流月 ${monthlyHoroscope.heavenlyStem}`,
      direction: directionFromLayerScore(layerScore),
      layerScore,
      ruleKey: liuYueRule.ruleKey,
      ruleAdjustment: liuYueRule.adjustment,
      rows: buildMutagenLandingRows(monthlyHoroscope.mutagen, ctx, focus, palaceScores),
    })
  } else {
    layers.push({
      layer: '流月',
      stemLabel: '流月（数据缺失）',
      direction: '吉',
      layerScore: 0,
      ruleKey: liuYueRule.ruleKey,
      ruleAdjustment: liuYueRule.adjustment,
      rows: [],
    })
  }

  return {
    focusPalaces,
    directionMatrix,
    layers,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 三代四化引动（sihua_trigger_rules.json）
// ═══════════════════════════════════════════════════════════════════

const YUAN_JU_SIHUA_SOURCES = new Set(['生年', '太岁宫宫干四化'])

function sihuaTypeToShort(type: SihuaType): TriggerSihuaEntry['type'] {
  if (type === '化禄') return '禄'
  if (type === '化权') return '权'
  if (type === '化科') return '科'
  return '忌'
}

function triggerKey(t: SihuaTrigger): string {
  return `${t.triggerLevel}|${t.targetLevel}|${t.type}|${t.relation}|${t.targetPalace}`
}

function getSpatialRelation(p1: number, p2: number): SihuaTrigger['relation'] | null {
  if (p1 === p2) return '本宫'
  if (getOppositeIndex(p1) === p2) return '对宫'
  const [t1, t2] = getTrineIndices(p1)
  if (p2 === t1 || p2 === t2) return '三合'
  return null
}

function buildEffectText(
  type: TriggerSihuaEntry['type'],
  relation: SihuaTrigger['relation'],
  triggerLevel: SihuaTrigger['triggerLevel'],
  targetLevel: SihuaTrigger['targetLevel'],
): string {
  const template = getTriggerEffectTemplate(type, relation)
  return formatTriggerEffect(template, triggerLevel, targetLevel)
}

/** 从原局 ctx 提取生年+太岁四化落宫 */
export function buildYuanJuTriggerEntries(ctx: ScoringContext): TriggerSihuaEntry[] {
  const entries: TriggerSihuaEntry[] = []
  for (let palaceIndex = 0; palaceIndex < ctx.palaces.length; palaceIndex++) {
    const palace = ctx.palaces[palaceIndex]
    for (const star of palace.stars) {
      if (!star.sihua || !star.sihuaSource || !YUAN_JU_SIHUA_SOURCES.has(star.sihuaSource)) continue
      entries.push({
        starName: star.name,
        palaceIndex,
        type: sihuaTypeToShort(star.sihua),
      })
    }
  }
  return entries
}

/** 从大限/流年 scoring ctx 提取该层四化落宫 */
export function buildLayerTriggerEntries(
  ctx: ScoringContext | null,
  layer: 'daXian' | 'liuNian',
): TriggerSihuaEntry[] {
  if (!ctx) return []
  const sourceLabel = layer === 'daXian' ? '大限' : '流年'
  const entries: TriggerSihuaEntry[] = []
  for (let palaceIndex = 0; palaceIndex < ctx.palaces.length; palaceIndex++) {
    const palace = ctx.palaces[palaceIndex]
    for (const star of palace.stars) {
      if (!star.sihua || star.sihuaSource !== sourceLabel) continue
      entries.push({
        starName: star.name,
        palaceIndex,
        type: sihuaTypeToShort(star.sihua),
      })
    }
  }
  return entries
}

/**
 * 从 mutagen 数组直接构建引动条目 — 不依赖 scoring context 中的 sihuaSource 标注。
 * 解决大限天干与原局天干相同时，buildDaXianScoringContext 的 !star.sihua 检查阻止覆写的问题。
 */
export function buildTriggerEntriesFromMutagen(
  mutagen: string[],
  ctx: ScoringContext,
): TriggerSihuaEntry[] {
  const types: TriggerSihuaEntry['type'][] = ['禄', '权', '科', '忌']
  const entries: TriggerSihuaEntry[] = []
  for (let i = 0; i < 4; i++) {
    const starName = mutagen[i]
    if (!starName) continue
    const idx = findStarPalaceIndex(ctx, starName)
    if (idx === null) continue
    entries.push({
      starName,
      palaceIndex: idx,
      type: types[i],
    })
  }
  return entries
}

/** 检测三代四化引动 */
export function detectSihuaTriggers(
  yuanJuSihua: TriggerSihuaEntry[],
  daXianSihua: TriggerSihuaEntry[],
  liuNianSihua: TriggerSihuaEntry[],
): SihuaTrigger[] {
  const triggers: SihuaTrigger[] = []
  const seen = new Set<string>()

  function pushTrigger(trigger: SihuaTrigger) {
    const key = triggerKey(trigger)
    if (seen.has(key)) return
    seen.add(key)
    triggers.push(trigger)
  }

  // 大限 → 原局（本/对/三合）
  for (const d of daXianSihua) {
    for (const y of yuanJuSihua) {
      if (d.type !== y.type) continue
      const relation = getSpatialRelation(d.palaceIndex, y.palaceIndex)
      if (!relation) continue
      pushTrigger({
        triggerLevel: 'daXian',
        targetLevel: 'yuanJu',
        type: d.type,
        relation,
        triggerStars: [d.starName],
        targetStar: y.starName,
        triggerPalaces: [d.palaceIndex],
        targetPalace: y.palaceIndex,
        effect: buildEffectText(d.type, relation, 'daXian', 'yuanJu'),
        weight: getTriggerSpatialWeight(relation),
      })
    }
  }

  // 大限 → 原局（双夹）
  for (const y of yuanJuSihua) {
    const [left, right] = getFlankingIndices(y.palaceIndex)
    const leftMatch = daXianSihua.find(d => d.type === y.type && d.palaceIndex === left)
    const rightMatch = daXianSihua.find(d => d.type === y.type && d.palaceIndex === right)
    if (leftMatch && rightMatch) {
      pushTrigger({
        triggerLevel: 'daXian',
        targetLevel: 'yuanJu',
        type: y.type,
        relation: '双夹',
        triggerStars: [leftMatch.starName, rightMatch.starName],
        targetStar: y.starName,
        triggerPalaces: [left, right],
        targetPalace: y.palaceIndex,
        effect: buildEffectText(y.type, '双夹', 'daXian', 'yuanJu'),
        weight: getTriggerSpatialWeight('双夹'),
      })
    }
  }

  // 流年 → 大限（本/对/三合）
  for (const l of liuNianSihua) {
    for (const d of daXianSihua) {
      if (l.type !== d.type) continue
      const relation = getSpatialRelation(l.palaceIndex, d.palaceIndex)
      if (!relation) continue
      pushTrigger({
        triggerLevel: 'liuNian',
        targetLevel: 'daXian',
        type: l.type,
        relation,
        triggerStars: [l.starName],
        targetStar: d.starName,
        triggerPalaces: [l.palaceIndex],
        targetPalace: d.palaceIndex,
        effect: buildEffectText(l.type, relation, 'liuNian', 'daXian'),
        weight: getTriggerSpatialWeight(relation),
      })
    }
  }

  // 流年 → 大限（双夹）
  for (const d of daXianSihua) {
    const [left, right] = getFlankingIndices(d.palaceIndex)
    const leftMatch = liuNianSihua.find(l => l.type === d.type && l.palaceIndex === left)
    const rightMatch = liuNianSihua.find(l => l.type === d.type && l.palaceIndex === right)
    if (leftMatch && rightMatch) {
      pushTrigger({
        triggerLevel: 'liuNian',
        targetLevel: 'daXian',
        type: d.type,
        relation: '双夹',
        triggerStars: [leftMatch.starName, rightMatch.starName],
        targetStar: d.starName,
        triggerPalaces: [left, right],
        targetPalace: d.palaceIndex,
        effect: buildEffectText(d.type, '双夹', 'liuNian', 'daXian'),
        weight: getTriggerSpatialWeight('双夹'),
      })
    }
  }

  return triggers
}

/** 引动权重微调大限/流年 activation（仅事项焦点宫） */
export function applyTriggerActivationAdjust(
  triggers: SihuaTrigger[],
  focusIndices: number[],
  daXianActivation: number,
  liuNianActivation: number,
): { daXianActivation: number; liuNianActivation: number } {
  const focusSet = new Set(focusIndices)
  let daXian = daXianActivation
  let liuNian = liuNianActivation

  for (const t of triggers) {
    if (!focusSet.has(t.targetPalace)) continue
    const delta = t.type === '忌'
      ? -0.15 * t.weight
      : 0.1 * t.weight
    if (t.triggerLevel === 'daXian') {
      daXian += delta
    } else {
      liuNian += delta
    }
  }

  return {
    daXianActivation: Math.max(0, daXian),
    liuNianActivation: Math.max(0, liuNian),
  }
}
