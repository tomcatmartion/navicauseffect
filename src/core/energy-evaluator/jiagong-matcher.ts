/**
 * 夹宫成对判定（含命主同源校验）
 *
 * 阶段一：仅实现命主本人同源（生年 + 太岁宫宫干四化视为同一命主来源组）。
 * 父母四化夹宫同源判定留待后续阶段。
 */

import type { PalaceBrightness, SihuaType } from '../types'
import { getDunGanSihua, getShengNianSihua } from '../sihua-calculator'
import { getFlankingDecay } from '../knowledge-dict/query'
import { getScoringParams } from '../knowledge-dict/loader'
import type { JiagongValidPair } from '../knowledge-dict/types'
import type { PalaceForScoring, ScoringContext } from './scoring-flow'

/** 命主同源说明（scoring.json：生年化禄 + 遁干化禄 / 禄存 + 命主化禄 均属同源） */
export const NATIVE_OWNER_SAME_SOURCE_LABEL = '命主同源（生年·太岁宫干）'

/** 夹宫成对计分结果 */
export interface FlankingPairResult {
  pairName: string
  /** 展示别名，如禄存+化禄夹 → 禄夹格 */
  displayName: string
  pairType: '吉夹' | '煞夹'
  leftLabel: string
  rightLabel: string
  /** 动态衰减系数 */
  decay: number
  /** 同源判定说明 */
  sameSourceLabel: string
}

type NativeSihuaSource = '生年' | '太岁宫宫干四化'

interface NativeSihuaHit {
  star: string
  source: NativeSihuaSource
}

const SIHUA_TYPES = new Set<string>(['化禄', '化权', '化科', '化忌'])

function isSihuaType(value: string): value is SihuaType {
  return SIHUA_TYPES.has(value)
}

function palaceHasLuCun(palace: PalaceForScoring): boolean {
  return palace.hasLuCun || palace.stars.some(s => s.name === '禄存')
}

/** 获取某宫命主侧指定四化命中的星（按星名 + 生年/遁干表，不依赖 star.sihua 单标注） */
export function getNativeSihuaHitsInPalace(
  palace: PalaceForScoring,
  ctx: ScoringContext,
  sihuaType: SihuaType,
): NativeSihuaHit[] {
  const keyMap: Record<SihuaType, '禄' | '权' | '科' | '忌'> = {
    化禄: '禄',
    化权: '权',
    化科: '科',
    化忌: '忌',
  }
  const key = keyMap[sihuaType]
  const shengNian = getShengNianSihua(ctx.birthGan)
  const dunGan = getDunGanSihua(ctx.birthGan, ctx.taiSuiZhi)
  const hits: NativeSihuaHit[] = []

  for (const star of palace.stars) {
    if (star.name === shengNian[key]) {
      hits.push({ star: star.name, source: '生年' })
    }
    if (star.name === dunGan[key]) {
      hits.push({ star: star.name, source: '太岁宫宫干四化' })
    }
  }
  return hits
}

function formatNativeSihuaHit(hit: NativeSihuaHit, sihuaType: SihuaType): string {
  const srcLabel = hit.source === '生年'
    ? `生年${sihuaType}`
    : `遁干${sihuaType}`
  return `${hit.star}(${srcLabel})`
}

function getDisplayName(pairName: string): string {
  if (pairName === '禄存+化禄夹') return '禄夹格'
  return pairName
}

function buildPairResult(
  pair: JiagongValidPair,
  leftLabel: string,
  rightLabel: string,
  decay: number,
): FlankingPairResult {
  return {
    pairName: pair.name,
    displayName: getDisplayName(pair.name),
    pairType: pair.type as '吉夹' | '煞夹',
    leftLabel,
    rightLabel,
    decay,
    sameSourceLabel: NATIVE_OWNER_SAME_SOURCE_LABEL,
  }
}

/** 禄存+化禄夹（命主化禄 + 禄存分居两侧） */
function matchLuCunHuaLuJia(
  leftPalace: PalaceForScoring,
  rightPalace: PalaceForScoring,
  ctx: ScoringContext,
  pair: JiagongValidPair,
  decay: number,
): FlankingPairResult | null {
  const leftLuHits = getNativeSihuaHitsInPalace(leftPalace, ctx, '化禄')
  const rightLuHits = getNativeSihuaHitsInPalace(rightPalace, ctx, '化禄')
  const leftHasLuCun = palaceHasLuCun(leftPalace)
  const rightHasLuCun = palaceHasLuCun(rightPalace)

  if (leftHasLuCun && rightLuHits.length > 0) {
    return buildPairResult(
      pair,
      `${leftPalace.diZhi}·禄存`,
      `${rightPalace.diZhi}·${formatNativeSihuaHit(rightLuHits[0]!, '化禄')}`,
      decay,
    )
  }
  if (rightHasLuCun && leftLuHits.length > 0) {
    return buildPairResult(
      pair,
      `${leftPalace.diZhi}·${formatNativeSihuaHit(leftLuHits[0]!, '化禄')}`,
      `${rightPalace.diZhi}·禄存`,
      decay,
    )
  }
  return null
}

/** 双禄/双权/双科/双忌夹：左右各有一个命主四化，且同属命主来源组 */
function matchNativeDoubleSihuaJia(
  leftPalace: PalaceForScoring,
  rightPalace: PalaceForScoring,
  ctx: ScoringContext,
  pair: JiagongValidPair,
  sihuaType: SihuaType,
  decay: number,
): FlankingPairResult | null {
  const leftHits = getNativeSihuaHitsInPalace(leftPalace, ctx, sihuaType)
  const rightHits = getNativeSihuaHitsInPalace(rightPalace, ctx, sihuaType)
  if (leftHits.length === 0 || rightHits.length === 0) return null

  return buildPairResult(
    pair,
    `${leftPalace.diZhi}·${formatNativeSihuaHit(leftHits[0]!, sihuaType)}`,
    `${rightPalace.diZhi}·${formatNativeSihuaHit(rightHits[0]!, sihuaType)}`,
    decay,
  )
}

/** 普通星曜夹（昌曲、魁钺、羊陀等，无需同源） */
function matchStarPairJia(
  leftPalace: PalaceForScoring,
  rightPalace: PalaceForScoring,
  pair: JiagongValidPair,
  decay: number,
): FlankingPairResult | null {
  const leftStars = new Set(leftPalace.stars.map(s => s.name))
  const rightStars = new Set(rightPalace.stars.map(s => s.name))

  const forward = leftStars.has(pair.left) && rightStars.has(pair.right)
  const reverse = leftStars.has(pair.right) && rightStars.has(pair.left)
  if (!forward && !reverse) return null

  const leftStar = forward ? pair.left : pair.right
  const rightStar = forward ? pair.right : pair.left

  return {
    pairName: pair.name,
    displayName: getDisplayName(pair.name),
    pairType: pair.type as '吉夹' | '煞夹',
    leftLabel: `${leftPalace.diZhi}·${leftStar}`,
    rightLabel: `${rightPalace.diZhi}·${rightStar}`,
    decay,
    sameSourceLabel: '星曜成对（无需同源）',
  }
}

/**
 * 获取所有成对的夹宫组合（符合 scoring.json jiagongValidPairs + 命主同源）
 */
export function getAllFlankingPairs(
  palaceIdx: number,
  ctx: ScoringContext,
  pairType?: '吉夹' | '煞夹',
): FlankingPairResult[] {
  const [flankLeftIdx, flankRightIdx] = getFlankingIndices(palaceIdx)
  const leftPalace = ctx.palaces[flankLeftIdx]
  const rightPalace = ctx.palaces[flankRightIdx]

  if (!leftPalace || !rightPalace) {
    return []
  }

  const selfBrightness = ctx.palaces[palaceIdx]?.brightness ?? '平'
  const flankBrightness = getWeakerBrightness(leftPalace.brightness, rightPalace.brightness)
  const decay = getFlankingDecay(selfBrightness, flankBrightness)

  const params = getScoringParams()
  const pairs = params.jiagongValidPairs?.pairs ?? []
  const result: FlankingPairResult[] = []

  for (const pair of pairs) {
    if (pairType && pair.type !== pairType) continue

    let matched: FlankingPairResult | null = null

    if (pair.left === '禄存' && pair.right === '化禄') {
      matched = matchLuCunHuaLuJia(leftPalace, rightPalace, ctx, pair, decay)
    } else if (isSihuaType(pair.left) && isSihuaType(pair.right) && pair.left === pair.right) {
      if (pair.sameSourceRequired !== false) {
        matched = matchNativeDoubleSihuaJia(leftPalace, rightPalace, ctx, pair, pair.left, decay)
      }
    } else if (!isSihuaType(pair.left) && !isSihuaType(pair.right)) {
      matched = matchStarPairJia(leftPalace, rightPalace, pair, decay)
    }

    if (matched) {
      result.push(matched)
    }
  }

  return result
}

/** 夹宫左右邻宫索引（逆时针为左，顺时针为右） */
export function getFlankingIndices(idx: number): [number, number] {
  return [(idx + 1) % 12, (idx - 1 + 12) % 12]
}

/** 取两个亮度中较弱的一个（用于夹宫旺弱 → 衰减矩阵） */
export function getWeakerBrightness(a: PalaceBrightness, b: PalaceBrightness): PalaceBrightness {
  const order: PalaceBrightness[] = ['极旺', '旺', '平', '陷', '极弱', '空']
  const idxA = order.indexOf(a)
  const idxB = order.indexOf(b)
  return idxA >= idxB ? a : b
}
