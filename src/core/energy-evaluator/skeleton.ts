/**
 * M2: 宫位评分 — 骨架映射库
 *
 * P01-P12：12种骨架（以紫微所在宫位命名）
 * 每种骨架定义12地支对应的主星和旺弱等级
 *
 * 数据来源：data/palace_innate_skeleton.json（支持热加载）
 */

import type { DiZhi, PalaceBrightness } from '../types'
import { getPalaceInnateSkeleton } from '../knowledge-dict/loader'

/** 骨架条目 */
export interface SkeletonEntry {
  /** 骨架序号 */
  id: string
  /** 命宫描述（紫微+地支） */
  description: string
  /** 12地支 → 旺弱等级 */
  brightnessMap: Record<DiZhi, PalaceBrightness>
  /** 12地支 → 主星 */
  majorMap: Record<string, string>
}

// ═══════════════════════════════════════════════════════════════════
// 骨架 ID 到 JSON 键的映射
// ═══════════════════════════════════════════════════════════════════

/** P01 → P01_紫微在子 */
const SKELETON_KEYS: Record<string, string> = {
  P01: 'P01_紫微在子',
  P02: 'P02_紫破在丑',
  P03: 'P03_紫府在寅',
  P04: 'P04_紫贪在卯',
  P05: 'P05_紫相在辰',
  P06: 'P06_紫杀在巳',
  P07: 'P07_紫微在午',
  P08: 'P08_紫破在未',
  P09: 'P09_紫府在申',
  P10: 'P10_紫贪在酉',
  P11: 'P11_紫相在戌',
  P12: 'P12_紫杀在亥',
}

/** 从 JSON 键提取描述（去掉 P01_ 前缀） */
function extractDescription(jsonKey: string): string {
  const underscoreIdx = jsonKey.indexOf('_')
  return underscoreIdx >= 0 ? jsonKey.slice(underscoreIdx + 1) : jsonKey
}

/**
 * 从 JSON 构建骨架条目
 *
 * 每次调用都从 JSON 读取（支持热加载），
 * 但结果会被上层评分逻辑缓存（同一请求内 scoringCtx 不变）
 */
function buildSkeletonEntry(id: string): SkeletonEntry | null {
  const jsonKey = SKELETON_KEYS[id]
  if (!jsonKey) return null

  const skeletonData = getPalaceInnateSkeleton()
  const data = skeletonData[jsonKey]
  if (!data) return null

  const brightnessMap: Record<string, PalaceBrightness> = {}
  const majorMap: Record<string, string> = {}

  for (const [diZhi, entry] of Object.entries(data)) {
    brightnessMap[diZhi] = (entry.brightness || '平') as PalaceBrightness
    majorMap[diZhi] = entry.major || ''
  }

  return {
    id,
    description: extractDescription(jsonKey),
    brightnessMap: brightnessMap as Record<DiZhi, PalaceBrightness>,
    majorMap,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 兼容旧 API：SKELETON_MAP 导出（懒加载，首次访问时从 JSON 构建）
// ═══════════════════════════════════════════════════════════════════

let cachedMap: SkeletonEntry[] | null = null

/** 骨架映射库 P01-P12（从 JSON 加载） */
export const SKELETON_MAP: SkeletonEntry[] = new Proxy([] as SkeletonEntry[], {
  get(_target, prop) {
    if (!cachedMap) {
      cachedMap = Object.keys(SKELETON_KEYS)
        .map(id => buildSkeletonEntry(id))
        .filter((e): e is SkeletonEntry => e !== null)
    }
    const val = (cachedMap as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof val === 'function') return (val as Function).bind(cachedMap)
    return val
  },
})

/**
 * 获取骨架条目
 */
export function getSkeleton(skeletonId: string): SkeletonEntry | null {
  return buildSkeletonEntry(skeletonId)
}

/**
 * 根据骨架和地支获取旺弱等级
 */
export function getSkeletonBrightness(skeletonId: string, diZhi: DiZhi): PalaceBrightness {
  const entry = buildSkeletonEntry(skeletonId)
  if (!entry) return '平'
  return entry.brightnessMap[diZhi]
}

/**
 * 根据骨架和地支获取主星
 */
export function getSkeletonMajor(skeletonId: string, diZhi: string): string {
  const entry = buildSkeletonEntry(skeletonId)
  if (!entry) return ''
  return entry.majorMap[diZhi] ?? ''
}
